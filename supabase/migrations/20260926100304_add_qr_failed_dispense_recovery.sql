-- ============================================================
-- SmartVend
-- QR Failed Dispense Recovery
--
-- Extends complete_vending_dispense() so external QR payments
-- can safely record a failed dispense without falsely claiming
-- that the external payment has already been refunded.
--
-- Student-wallet purchases:
--   failed dispense -> immediate wallet refund
--
-- External QR purchases:
--   failed dispense -> restore stock -> mark refund required
--   -> external provider refund happens separately
-- ============================================================

CREATE OR REPLACE FUNCTION public.complete_vending_dispense (
  p_transaction_id   uuid,
  p_machine_code     text,
  p_dispense_success boolean,
  p_failure_reason   text DEFAULT NULL::text
)
RETURNS TABLE (
  transaction_id     uuid,
  transaction_code   text,
  transaction_status text,
  payment_status     text,
  dispense_status    text,
  balance_after      numeric,
  remaining_stock    integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$

declare
  v_transaction_id uuid;
  v_transaction_code text;

  v_student_id uuid;
  v_machine_id uuid;
  v_transaction_machine_id uuid;
  v_slot_id uuid;

  v_amount numeric(10,2);

  v_status text;
  v_payment_status text;
  v_dispense_status text;
  v_refund_status text;

  v_balance_before numeric(12,2);
  v_balance_after numeric(12,2);

  v_remaining_stock integer;

begin

  /*
   * 1. Validate input.
   */
  if p_transaction_id is null then
    raise exception
      'Transaction ID is required';
  end if;

  if p_machine_code is null
     or trim(p_machine_code) = '' then
    raise exception
      'Machine code is required';
  end if;


  /*
   * 2. Find machine.
   */
  select
    m.id
  into
    v_machine_id
  from public.machines m
  where
    m.machine_code = trim(p_machine_code);

  if not found then
    raise exception
      'Vending machine not found';
  end if;


  /*
   * 3. Find and lock transaction.
   *
   * The row lock prevents simultaneous result requests from
   * restoring inventory or refunding more than once.
   */
  select
    vt.id,
    vt.transaction_code,
    vt.student_id,
    vt.machine_id,
    vt.slot_id,
    vt.amount,
    vt.status,
    vt.payment_status,
    vt.dispense_status,
    vt.refund_status
  into
    v_transaction_id,
    v_transaction_code,
    v_student_id,
    v_transaction_machine_id,
    v_slot_id,
    v_amount,
    v_status,
    v_payment_status,
    v_dispense_status,
    v_refund_status
  from public.vending_transactions vt
  where vt.id = p_transaction_id
  for update;

  if not found then
    raise exception
      'Transaction not found';
  end if;


  /*
   * 4. Verify machine ownership.
   */
  if v_transaction_machine_id <> v_machine_id then
    raise exception
      'Transaction does not belong to this machine';
  end if;


  /*
   * 5. Handle already finalized student-wallet transactions.
   */
  if v_status in ('success', 'refunded') then

    if
      (
        v_status = 'success'
        and p_dispense_success = false
      )
      or
      (
        v_status = 'refunded'
        and p_dispense_success = true
      )
    then
      raise exception
        'Dispense result conflicts with finalized transaction';
    end if;

    if v_student_id is not null then

      select
        s.balance
      into
        v_balance_after
      from public.students s
      where s.id = v_student_id;

    else
      v_balance_after := null;
    end if;

    select
      vs.quantity
    into
      v_remaining_stock
    from public.vending_slots vs
    where vs.id = v_slot_id;

    return query
    select
      v_transaction_id,
      v_transaction_code,
      v_status,
      v_payment_status,
      v_dispense_status,
      v_balance_after,
      v_remaining_stock;

    return;
  end if;


  /*
   * 6. Handle an already-recorded external payment
   *    dispense failure.
   *
   * The first failure report restores inventory and changes
   * dispense_status to failed.
   *
   * A retry of the same failure report must NOT restore stock
   * again.
   */
  if v_student_id is null
     and v_dispense_status = 'failed'
     and v_refund_status in (
       'required',
       'processing',
       'failed',
       'completed'
     )
  then

    if p_dispense_success = true then
      raise exception
        'Dispense result conflicts with recorded failure';
    end if;

    select
      vs.quantity
    into
      v_remaining_stock
    from public.vending_slots vs
    where vs.id = v_slot_id;

    v_balance_after := null;

    return query
    select
      v_transaction_id,
      v_transaction_code,
      v_status,
      v_payment_status,
      v_dispense_status,
      v_balance_after,
      v_remaining_stock;

    return;
  end if;


  /*
   * 7. Transaction must still be pending.
   */
  if v_status <> 'pending' then
    raise exception
      'Transaction cannot be finalized';
  end if;


  /*
   * 8. Payment must already be confirmed.
   */
  if v_payment_status <> 'paid' then
    raise exception
      'Payment is not confirmed';
  end if;


  /*
   * 9. Machine must have started dispensing.
   */
  if v_dispense_status <> 'dispensing' then
    raise exception
      'Dispensing has not started';
  end if;


  /*
   * 10A. DISPENSE SUCCESS
   */
  if p_dispense_success = true then

    update public.vending_transactions
    set
      status = 'success',
      dispense_status = 'dispensed',
      dispense_completed_at = now(),
      dispense_failure_reason = null,
      completed_at = now()
    where id = v_transaction_id;

    v_status := 'success';
    v_dispense_status := 'dispensed';

    if v_student_id is not null then

      select
        s.balance
      into
        v_balance_after
      from public.students s
      where s.id = v_student_id;

    else
      v_balance_after := null;
    end if;

    /*
     * Inventory was already reserved during purchase/payment,
     * so successful dispensing does not deduct it again.
     */
    select
      vs.quantity
    into
      v_remaining_stock
    from public.vending_slots vs
    where vs.id = v_slot_id;


  /*
   * 10B. DISPENSE FAILURE
   */
  else

    /*
     * --------------------------------------------------------
     * EXTERNAL / QR PAYMENT
     * --------------------------------------------------------
     *
     * We cannot claim that Maya refunded the customer here.
     *
     * Instead:
     *   1. restore reserved inventory,
     *   2. record the dispense failure,
     *   3. mark the refund as required,
     *   4. leave payment_status = paid.
     *
     * A separate backend refund operation will contact the
     * payment provider and only then mark the payment refunded.
     */
    if v_student_id is null then

      update public.vending_slots
      set
        quantity = quantity + 1,
        updated_at = now()
      where id = v_slot_id
      returning
        quantity
      into
        v_remaining_stock;


      update public.vending_transactions
      set
        dispense_status = 'failed',
        dispense_completed_at = now(),

        dispense_failure_reason =
          coalesce(
            nullif(
              trim(p_failure_reason),
              ''
            ),
            'Dispensing failed'
          ),

        refund_status = 'required',
        refund_reference = null,
        refund_requested_at = null,
        refund_completed_at = null,
        refund_failure_reason = null,
        refund_last_attempt_at = null,

        payment_last_event = 'refund_required',
        payment_last_event_at = now()

      where id = v_transaction_id;


      /*
       * Transaction remains pending because customer money is
       * still with the external provider until refund succeeds.
       */
      v_status := 'pending';
      v_payment_status := 'paid';
      v_dispense_status := 'failed';
      v_balance_after := null;


    /*
     * --------------------------------------------------------
     * STUDENT WALLET PAYMENT
     * --------------------------------------------------------
     */
    else

      /*
       * Lock the student's wallet before refunding.
       */
      select
        s.balance
      into
        v_balance_before
      from public.students s
      where s.id = v_student_id
      for update;

      if not found then
        raise exception
          'Student account not found';
      end if;


      v_balance_after :=
        v_balance_before + v_amount;


      /*
       * Restore wallet balance.
       */
      update public.students
      set
        balance = v_balance_after,
        updated_at = now()
      where id = v_student_id;


      /*
       * Restore reserved inventory.
       */
      update public.vending_slots
      set
        quantity = quantity + 1,
        updated_at = now()
      where id = v_slot_id
      returning
        quantity
      into
        v_remaining_stock;


      /*
       * Record wallet refund in audit trail.
       */
      insert into public.balance_transactions (
        student_id,
        vending_transaction_id,
        transaction_type,
        amount,
        balance_before,
        balance_after,
        description
      )
      values (
        v_student_id,
        v_transaction_id,
        'refund',
        v_amount,
        v_balance_before,
        v_balance_after,
        'Automatic refund - dispensing failed'
      );


      /*
       * Wallet refund happens atomically in this function,
       * therefore this transaction can immediately become
       * fully refunded.
       */
      update public.vending_transactions
      set
        status = 'refunded',
        payment_status = 'refunded',
        refunded_at = now(),

        dispense_status = 'failed',
        dispense_completed_at = now(),

        dispense_failure_reason =
          coalesce(
            nullif(
              trim(p_failure_reason),
              ''
            ),
            'Dispensing failed'
          ),

        completed_at = now()

      where id = v_transaction_id;


      v_status := 'refunded';
      v_payment_status := 'refunded';
      v_dispense_status := 'failed';

    end if;

  end if;


  /*
   * 11. Return current/final result.
   */
  return query
  select
    v_transaction_id,
    v_transaction_code,
    v_status,
    v_payment_status,
    v_dispense_status,
    v_balance_after,
    v_remaining_stock;

end;
$function$;


-- ============================================================
-- Security
--
-- complete_vending_dispense is a SECURITY DEFINER function.
-- Only trusted server-side service-role code may execute it.
-- ============================================================

REVOKE ALL ON FUNCTION
public.complete_vending_dispense(uuid, text, boolean, text)
FROM PUBLIC;

REVOKE ALL ON FUNCTION
public.complete_vending_dispense(uuid, text, boolean, text)
FROM anon;

REVOKE ALL ON FUNCTION
public.complete_vending_dispense(uuid, text, boolean, text)
FROM authenticated;

GRANT EXECUTE ON FUNCTION
public.complete_vending_dispense(uuid, text, boolean, text)
TO service_role;