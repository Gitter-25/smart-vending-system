-- ============================================================
-- SmartVend
-- External Payment Refund Confirmation
--
-- Finalizes an external payment refund only after the backend
-- has confirmation that the refund was completed.
--
-- Inventory is NOT restored here because it was already
-- restored when the failed dispense was recorded.
-- ============================================================


CREATE OR REPLACE FUNCTION public.confirm_external_vending_refund (
  p_transaction_id uuid,
  p_refund_reference text,
  p_provider_event text DEFAULT 'REFUND_COMPLETED'
)
RETURNS TABLE (
  transaction_id     uuid,
  transaction_code   text,
  transaction_status text,
  payment_status     text,
  dispense_status    text,
  refund_status      text,
  refund_reference   text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$

declare
  v_transaction_id uuid;
  v_transaction_code text;

  v_status text;
  v_payment_status text;
  v_dispense_status text;
  v_refund_status text;
  v_refund_reference text;

  v_student_id uuid;
  v_payment_provider text;

begin

  /*
   * 1. Validate input.
   */
  if p_transaction_id is null then
    raise exception
      'Transaction ID is required';
  end if;

  if p_refund_reference is null
     or trim(p_refund_reference) = '' then
    raise exception
      'Refund reference is required';
  end if;


  /*
   * 2. Find and lock transaction.
   *
   * Prevents two refund-confirmation requests from finalizing
   * the same transaction simultaneously.
   */
  select
    vt.id,
    vt.transaction_code,
    vt.status,
    vt.payment_status,
    vt.dispense_status,
    vt.refund_status,
    vt.refund_reference,
    vt.student_id,
    vt.payment_provider
  into
    v_transaction_id,
    v_transaction_code,
    v_status,
    v_payment_status,
    v_dispense_status,
    v_refund_status,
    v_refund_reference,
    v_student_id,
    v_payment_provider
  from public.vending_transactions vt
  where vt.id = p_transaction_id
  for update;

  if not found then
    raise exception
      'Transaction not found';
  end if;


  /*
   * 3. This RPC is for external payments only.
   *
   * Student-wallet refunds are handled atomically by
   * complete_vending_dispense().
   */
  if v_student_id is not null then
    raise exception
      'External refund confirmation is not valid for student wallet payments';
  end if;

  if v_payment_provider is null
     or trim(v_payment_provider) = '' then
    raise exception
      'External payment provider is missing';
  end if;


  /*
   * 4. Idempotent handling.
   *
   * If this refund was already completed, return the existing
   * state instead of applying it again.
   */
  if v_status = 'refunded'
     and v_payment_status = 'refunded'
     and v_refund_status = 'completed'
  then

    /*
     * A retry must not attempt to replace the recorded refund
     * reference with a different one.
     */
    if v_refund_reference is not null
       and v_refund_reference <> trim(p_refund_reference)
    then
      raise exception
        'Refund reference conflicts with completed refund';
    end if;

    return query
    select
      v_transaction_id,
      v_transaction_code,
      v_status,
      v_payment_status,
      v_dispense_status,
      v_refund_status,
      v_refund_reference;

    return;
  end if;


  /*
   * 5. Validate refund eligibility.
   */
  if v_status <> 'pending' then
    raise exception
      'Transaction is not awaiting refund';
  end if;

  if v_payment_status <> 'paid' then
    raise exception
      'Payment is not in paid state';
  end if;

  if v_dispense_status <> 'failed' then
    raise exception
      'Dispense failure has not been recorded';
  end if;

  if v_refund_status not in (
    'required',
    'processing',
    'failed'
  ) then
    raise exception
      'Transaction is not awaiting external refund';
  end if;


  /*
   * 6. Finalize confirmed external refund.
   *
   * Do NOT modify vending_slots here.
   * Inventory was restored when the dispense failure was
   * originally recorded.
   */
  update public.vending_transactions
  set
    status = 'refunded',
    payment_status = 'refunded',

    refund_status = 'completed',
    refund_reference = trim(p_refund_reference),
    refund_requested_at =
      coalesce(
        refund_requested_at,
        now()
      ),
    refund_completed_at = now(),
    refund_failure_reason = null,
    refund_last_attempt_at = now(),

    refunded_at = now(),

    payment_last_event =
      coalesce(
        nullif(
          trim(p_provider_event),
          ''
        ),
        'REFUND_COMPLETED'
      ),
    payment_last_event_at = now(),

    completed_at = now()

  where id = v_transaction_id;


  /*
   * 7. Return finalized state.
   */
  v_status := 'refunded';
  v_payment_status := 'refunded';
  v_refund_status := 'completed';
  v_refund_reference := trim(p_refund_reference);

  return query
  select
    v_transaction_id,
    v_transaction_code,
    v_status,
    v_payment_status,
    v_dispense_status,
    v_refund_status,
    v_refund_reference;

end;
$function$;


-- ============================================================
-- Security
--
-- Only trusted server-side service-role code may confirm that
-- an external payment was refunded.
-- ============================================================

REVOKE ALL ON FUNCTION
public.confirm_external_vending_refund(uuid, text, text)
FROM PUBLIC;

REVOKE ALL ON FUNCTION
public.confirm_external_vending_refund(uuid, text, text)
FROM anon;

REVOKE ALL ON FUNCTION
public.confirm_external_vending_refund(uuid, text, text)
FROM authenticated;

GRANT EXECUTE ON FUNCTION
public.confirm_external_vending_refund(uuid, text, text)
TO service_role;