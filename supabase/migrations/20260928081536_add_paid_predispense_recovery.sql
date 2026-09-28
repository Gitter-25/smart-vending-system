/*
 * SmartVend
 * Paid Pre-Dispense Transaction Recovery
 *
 * Recovers transactions where payment was completed
 * but dispensing never started.
 */

create or replace function public.recover_paid_vending_transaction(
  p_transaction_id uuid,
  p_machine_code text,
  p_failure_reason text default null
)
returns table (
  transaction_id uuid,
  transaction_code text,
  transaction_status text,
  payment_status text,
  dispense_status text,
  refund_status text,
  balance_after numeric,
  remaining_stock integer,
  already_recovered boolean
)
language plpgsql
security definer
set search_path = ''
as $function$

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

  v_already_recovered boolean := false;

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
   * FOR UPDATE prevents two recovery requests
   * from processing the same transaction concurrently.
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
  where
    vt.id = p_transaction_id
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
   * 5. Idempotent recovery.
   *
   * Student wallet recovery:
   *   status = refunded
   *   payment_status = refunded
   *   dispense_status = failed
   *
   * External payment recovery:
   *   dispense_status = failed
   *   refund_status = required/processing/failed/completed
   *
   * If recovery has already occurred, simply return
   * the current state without restoring inventory or
   * wallet balance again.
   */

  if
    (
      v_student_id is not null
      and v_status = 'refunded'
      and v_payment_status = 'refunded'
      and v_dispense_status = 'failed'
    )
    or
    (
      v_student_id is null
      and v_dispense_status = 'failed'
      and v_refund_status in (
        'required',
        'processing',
        'failed',
        'completed'
      )
    )
  then

    if v_student_id is not null then

      select
        s.balance
      into
        v_balance_after
      from public.students s
      where
        s.id = v_student_id;

    else

      v_balance_after := null;

    end if;

    select
      vs.quantity
    into
      v_remaining_stock
    from public.vending_slots vs
    where
      vs.id = v_slot_id;

    v_already_recovered := true;

    return query
    select
      v_transaction_id,
      v_transaction_code,
      v_status,
      v_payment_status,
      v_dispense_status,
      v_refund_status,
      v_balance_after,
      v_remaining_stock,
      v_already_recovered;

    return;

  end if;


  /*
   * 6. Transaction must still be pending.
   */

  if v_status <> 'pending' then
    raise exception
      'Transaction cannot be recovered';
  end if;


  /*
   * 7. Payment must already be confirmed.
   */

  if v_payment_status <> 'paid' then
    raise exception
      'Payment is not confirmed';
  end if;


  /*
   * 8. Dispensing must never have started.
   *
   * Transactions already in "dispensing" must instead
   * use complete_vending_dispense().
   */

  if v_dispense_status <> 'not_started' then
    raise exception
      'Transaction cannot use pre-dispense recovery';
  end if;


  /*
   * 9. Restore reserved inventory.
   */

  update public.vending_slots
  set
    quantity = quantity + 1,
    updated_at = now()
  where
    id = v_slot_id
  returning
    quantity
  into
    v_remaining_stock;

  if not found then
    raise exception
      'Vending slot not found';
  end if;


  /*
   * 10A. External payment recovery.
   *
   * Inventory is restored immediately.
   *
   * The payment remains "paid" because SmartVend must
   * not claim an external refund until the provider
   * confirms that refund.
   */

  if v_student_id is null then

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
          'Paid transaction recovered before dispensing started'
        ),

      refund_status = 'required',

      refund_reference = null,

      refund_requested_at = null,

      refund_completed_at = null,

      refund_failure_reason = null,

      refund_last_attempt_at = null,

      payment_last_event = 'refund_required',

      payment_last_event_at = now()

    where
      id = v_transaction_id;

    v_status := 'pending';
    v_payment_status := 'paid';
    v_dispense_status := 'failed';
    v_refund_status := 'required';
    v_balance_after := null;


  /*
   * 10B. Student wallet recovery.
   *
   * SmartVend owns the wallet balance, so the refund
   * can be performed atomically in this transaction.
   */

  else

    /*
     * Lock the student wallet.
     */

    select
      s.balance
    into
      v_balance_before
    from public.students s
    where
      s.id = v_student_id
    for update;

    if not found then
      raise exception
        'Student account not found';
    end if;


    /*
     * Calculate restored balance.
     */

    v_balance_after :=
      v_balance_before + v_amount;


    /*
     * Restore wallet balance.
     */

    update public.students
    set
      balance = v_balance_after,
      updated_at = now()
    where
      id = v_student_id;


    /*
     * Record refund in balance audit trail.
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
      'Automatic refund - paid transaction recovered before dispensing'
    );


    /*
     * Finalize wallet transaction.
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
          'Paid transaction recovered before dispensing started'
        ),

      completed_at = now()

    where
      id = v_transaction_id;

    v_status := 'refunded';
    v_payment_status := 'refunded';
    v_dispense_status := 'failed';

    /*
     * Student wallet transactions do not require
     * an external provider refund.
     */
    v_refund_status := null;

  end if;


  /*
   * 11. Return recovery result.
   */

  return query
  select
    v_transaction_id,
    v_transaction_code,
    v_status,
    v_payment_status,
    v_dispense_status,
    v_refund_status,
    v_balance_after,
    v_remaining_stock,
    v_already_recovered;

end;

$function$;


/*
 * Security:
 *
 * This privileged lifecycle function must not be
 * callable directly by browser users.
 */

revoke all
on function public.recover_paid_vending_transaction(
  uuid,
  text,
  text
)
from public;

revoke all
on function public.recover_paid_vending_transaction(
  uuid,
  text,
  text
)
from anon;

revoke all
on function public.recover_paid_vending_transaction(
  uuid,
  text,
  text
)
from authenticated;

grant execute
on function public.recover_paid_vending_transaction(
  uuid,
  text,
  text
)
to service_role;