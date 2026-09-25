create or replace function public.confirm_qr_vending_payment(
  p_transaction_id uuid,
  p_payment_reference text,
  p_provider_event text default 'PAYMENT_SUCCESS'
)
returns table (
  transaction_id uuid,
  transaction_code text,
  status text,
  payment_status text,
  dispense_status text,
  already_confirmed boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_transaction public.vending_transactions%rowtype;
  v_already_confirmed boolean := false;
begin
  if p_transaction_id is null then
    raise exception 'Transaction ID is required';
  end if;

  if p_payment_reference is null
     or trim(p_payment_reference) = '' then
    raise exception 'Payment reference is required';
  end if;

  /*
   * Lock the transaction so duplicate/concurrent webhook
   * deliveries cannot confirm the same payment twice.
   */
  select *
  into v_transaction
  from public.vending_transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'Vending transaction not found';
  end if;

  /*
   * This RPC is only for Maya QR transactions.
   */
  if v_transaction.payment_method <> 'qr'
     or v_transaction.payment_provider <> 'maya' then
    raise exception 'Transaction is not a Maya QR payment';
  end if;

  /*
   * The payment ID independently retrieved from Maya must
   * match the payment ID stored when the QR was created.
   */
  if v_transaction.payment_reference is null then
    raise exception 'Transaction has no Maya payment reference';
  end if;

  if v_transaction.payment_reference <> trim(p_payment_reference) then
    raise exception 'Maya payment reference does not match transaction';
  end if;

  /*
   * Successful retry:
   * Maya may deliver the same successful event more than once.
   */
  if v_transaction.payment_status = 'paid' then
    v_already_confirmed := true;

    return query
    select
      v_transaction.id,
      v_transaction.transaction_code,
      v_transaction.status,
      v_transaction.payment_status,
      v_transaction.dispense_status,
      v_already_confirmed;

    return;
  end if;

  /*
   * Never resurrect a finalized/refunded/failed transaction.
   */
  if v_transaction.status <> 'pending' then
    raise exception
      'Transaction is already finalized with status %',
      v_transaction.status;
  end if;

  if v_transaction.payment_status <> 'pending' then
    raise exception
      'Payment cannot be confirmed from status %',
      v_transaction.payment_status;
  end if;

  if v_transaction.dispense_status <> 'not_started' then
    raise exception
      'Dispense has already started';
  end if;

  /*
   * Mark the provider payment as paid.
   *
   * Do NOT set transaction status to success here.
   * The physical dispense has not happened yet.
   */
  update public.vending_transactions
  set
    payment_status = 'paid',
    paid_at = coalesce(paid_at, now()),
    payment_last_event =
      coalesce(
        nullif(trim(p_provider_event), ''),
        'PAYMENT_SUCCESS'
      ),
    payment_last_event_at = now()
  where id = v_transaction.id
  returning *
  into v_transaction;

  return query
  select
    v_transaction.id,
    v_transaction.transaction_code,
    v_transaction.status,
    v_transaction.payment_status,
    v_transaction.dispense_status,
    false;
end;
$function$;


/*
 * The browser, authenticated users and vending devices must
 * not be able to declare a QR payment successful themselves.
 *
 * Only trusted server-side code using the service-role client
 * may execute this function.
 */
revoke execute
on function public.confirm_qr_vending_payment(
  uuid,
  text,
  text
)
from public;

revoke execute
on function public.confirm_qr_vending_payment(
  uuid,
  text,
  text
)
from anon;

revoke execute
on function public.confirm_qr_vending_payment(
  uuid,
  text,
  text
)
from authenticated;

grant execute
on function public.confirm_qr_vending_payment(
  uuid,
  text,
  text
)
to service_role;