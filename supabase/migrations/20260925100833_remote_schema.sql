SET local check_function_bodies = off;

CREATE TABLE "public"."admin_profiles" (
  "id"         uuid                     NOT NULL,
  "full_name"  text                     NOT NULL DEFAULT 'Administrator'::text,
  "role"       text                     NOT NULL DEFAULT 'admin'::text,
  "status"     text                     NOT NULL DEFAULT 'active'::text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "admin_profiles_pkey" PRIMARY KEY (id),
  CONSTRAINT "admin_profiles_role_check" CHECK ((role = 'admin'::text)),
  CONSTRAINT "admin_profiles_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'disabled'::text])))
);

ALTER TABLE "public"."admin_profiles"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."balance_transactions" (
  "id"                     uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "student_id"             uuid                     NOT NULL,
  "vending_transaction_id" uuid,
  "transaction_type"       text                     NOT NULL,
  "amount"                 numeric(12,2)            NOT NULL,
  "balance_before"         numeric(12,2)            NOT NULL,
  "balance_after"          numeric(12,2)            NOT NULL,
  "description"            text,
  "created_at"             timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "balance_transactions_amount_check" CHECK ((amount > (0)::numeric)),
  CONSTRAINT "balance_transactions_pkey" PRIMARY KEY (id),
  CONSTRAINT "balance_transactions_transaction_type_check" CHECK ((transaction_type = ANY (ARRAY['top_up'::text, 'purchase'::text, 'refund'::text, 'adjustment'::text])))
);

ALTER TABLE "public"."balance_transactions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."machine_events" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "machine_id" uuid                     NOT NULL,
  "event_type" text                     NOT NULL,
  "severity"   text                     NOT NULL DEFAULT 'info'::text,
  "message"    text                     NOT NULL,
  "slot_id"    uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "machine_events_pkey" PRIMARY KEY (id),
  CONSTRAINT "machine_events_severity_check" CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'error'::text])))
);

ALTER TABLE "public"."machine_events"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."machines" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "machine_code"   text                     NOT NULL,
  "name"           text                     NOT NULL,
  "location"       text,
  "status"         text                     NOT NULL DEFAULT 'offline'::text,
  "last_heartbeat" timestamp with time zone,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "machines_machine_code_key" UNIQUE (machine_code),
  CONSTRAINT "machines_pkey" PRIMARY KEY (id),
  CONSTRAINT "machines_status_check" CHECK ((status = ANY (ARRAY['online'::text, 'offline'::text, 'maintenance'::text])))
);

ALTER TABLE "public"."machines"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."products" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"       text                     NOT NULL,
  "category"   text                     NOT NULL,
  "price"      numeric(10,2)            NOT NULL,
  "status"     text                     NOT NULL DEFAULT 'active'::text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "products_pkey" PRIMARY KEY (id),
  CONSTRAINT "products_price_check" CHECK ((price >= (0)::numeric)),
  CONSTRAINT "products_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);

ALTER TABLE "public"."products"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."student_cards" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "student_id" uuid                     NOT NULL,
  "card_uid"   text                     NOT NULL,
  "status"     text                     NOT NULL DEFAULT 'active'::text,
  "issued_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "student_cards_card_uid_key" UNIQUE (card_uid),
  CONSTRAINT "student_cards_pkey" PRIMARY KEY (id),
  CONSTRAINT "student_cards_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'blocked'::text, 'lost'::text, 'replaced'::text])))
);

ALTER TABLE "public"."student_cards"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."students" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "student_number" text                     NOT NULL,
  "full_name"      text                     NOT NULL,
  "balance"        numeric(12,2)            NOT NULL DEFAULT 0,
  "status"         text                     NOT NULL DEFAULT 'active'::text,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "students_balance_check" CHECK ((balance >= (0)::numeric)),
  CONSTRAINT "students_pkey" PRIMARY KEY (id),
  CONSTRAINT "students_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text]))),
  CONSTRAINT "students_student_number_key" UNIQUE (student_number)
);

ALTER TABLE "public"."students"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."system_settings" (
  "id"                         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "machine_id"                 uuid                     NOT NULL,
  "currency"                   text                     NOT NULL DEFAULT 'PHP'::text,
  "low_stock_threshold"        integer                  NOT NULL DEFAULT 3,
  "require_active_card"        boolean                  NOT NULL DEFAULT true,
  "prevent_negative_balance"   boolean                  NOT NULL DEFAULT true,
  "low_stock_alerts"           boolean                  NOT NULL DEFAULT true,
  "machine_offline_alerts"     boolean                  NOT NULL DEFAULT true,
  "transaction_failure_alerts" boolean                  NOT NULL DEFAULT true,
  "updated_at"                 timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "system_settings_low_stock_threshold_check" CHECK ((low_stock_threshold >= 0)),
  CONSTRAINT "system_settings_machine_id_key" UNIQUE (machine_id),
  CONSTRAINT "system_settings_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."system_settings"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."vending_slots" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "machine_id"   uuid                     NOT NULL,
  "product_id"   uuid,
  "slot_code"    text                     NOT NULL,
  "motor_number" integer                  NOT NULL,
  "quantity"     integer                  NOT NULL DEFAULT 0,
  "capacity"     integer                  NOT NULL DEFAULT 10,
  "status"       text                     NOT NULL DEFAULT 'ready'::text,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "vending_slots_capacity_check" CHECK ((capacity > 0)),
  CONSTRAINT "vending_slots_check" CHECK ((quantity <= capacity)),
  CONSTRAINT "vending_slots_machine_id_motor_number_key" UNIQUE (machine_id, motor_number),
  CONSTRAINT "vending_slots_machine_id_slot_code_key" UNIQUE (machine_id, slot_code),
  CONSTRAINT "vending_slots_motor_number_check" CHECK ((motor_number > 0)),
  CONSTRAINT "vending_slots_pkey" PRIMARY KEY (id),
  CONSTRAINT "vending_slots_quantity_check" CHECK ((quantity >= 0)),
  CONSTRAINT "vending_slots_status_check" CHECK ((status = ANY (ARRAY['ready'::text, 'error'::text, 'disabled'::text])))
);

ALTER TABLE "public"."vending_slots"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."vending_transactions" (
  "id"                      uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "transaction_code"        text                     NOT NULL,
  "student_id"              uuid,
  "card_id"                 uuid,
  "machine_id"              uuid,
  "slot_id"                 uuid,
  "product_id"              uuid,
  "product_name"            text                     NOT NULL,
  "amount"                  numeric(10,2)            NOT NULL,
  "payment_method"          text                     NOT NULL DEFAULT 'student_id'::text,
  "status"                  text                     NOT NULL DEFAULT 'pending'::text,
  "failure_reason"          text,
  "created_at"              timestamp with time zone NOT NULL DEFAULT now(),
  "completed_at"            timestamp with time zone,
  "request_id"              text,
  "request_card_uid"        text,
  "request_machine_code"    text,
  "request_slot_code"       text,
  "dispense_status"         text                     NOT NULL DEFAULT 'not_started'::text,
  "dispense_started_at"     timestamp with time zone,
  "dispense_completed_at"   timestamp with time zone,
  "dispense_failure_reason" text,
  "payment_provider"        text,
  "payment_reference"       text,
  "payment_status"          text                     NOT NULL DEFAULT 'pending'::text,
  "payment_created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "paid_at"                 timestamp with time zone,
  "refunded_at"             timestamp with time zone,
  CONSTRAINT "vending_refund_requires_refunded_payment" CHECK (((status <> 'refunded'::text) OR (payment_status = 'refunded'::text))),
  CONSTRAINT "vending_success_requires_payment" CHECK (((status <> 'success'::text) OR (payment_status = 'paid'::text))),
  CONSTRAINT "vending_transactions_amount_check" CHECK ((amount >= (0)::numeric)),
  CONSTRAINT "vending_transactions_dispense_status_check" CHECK ((dispense_status = ANY (ARRAY['not_started'::text, 'dispensing'::text, 'dispensed'::text, 'failed'::text]))),
  CONSTRAINT "vending_transactions_payment_status_check"
    CHECK ((payment_status = ANY (ARRAY['pending'::text, 'authorized'::text, 'paid'::text, 'failed'::text, 'expired'::text, 'refunded'::text]))),
  CONSTRAINT "vending_transactions_pkey" PRIMARY KEY (id),
  CONSTRAINT "vending_transactions_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'success'::text, 'failed'::text, 'refunded'::text]))),
  CONSTRAINT "vending_transactions_transaction_code_key" UNIQUE (transaction_code)
);

ALTER TABLE "public"."vending_transactions"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.complete_vending_dispense (
  p_transaction_id   uuid,
  p_machine_code     text,
  p_dispense_success boolean,
  p_failure_reason   text    DEFAULT NULL::text
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
    m.machine_code =
      trim(p_machine_code);

  if not found then
    raise exception
      'Vending machine not found';
  end if;


  /*
   * 3. Find and lock transaction.
   *
   * This prevents two dispense-result requests
   * from finalizing/refunding simultaneously.
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
    vt.dispense_status
  into
    v_transaction_id,
    v_transaction_code,
    v_student_id,
    v_transaction_machine_id,
    v_slot_id,
    v_amount,
    v_status,
    v_payment_status,
    v_dispense_status
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
  if v_transaction_machine_id
     <> v_machine_id then

    raise exception
      'Transaction does not belong to this machine';

  end if;


  /*
   * 5. Handle already finalized transactions.
   *
   * This makes result reporting idempotent.
   */
  if v_status in ('success', 'refunded') then

    /*
     * Reject a contradictory retry.
     *
     * Example:
     * Original result = success
     * Retry result    = failure
     */
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
   * 6. Transaction must still be pending.
   */
  if v_status <> 'pending' then
    raise exception
      'Transaction cannot be finalized';
  end if;


  /*
   * 7. Payment must already be confirmed.
   */
  if v_payment_status <> 'paid' then
    raise exception
      'Payment is not confirmed';
  end if;


  /*
   * 8. Machine must have started dispensing.
   */
  if v_dispense_status <> 'dispensing' then
    raise exception
      'Dispensing has not started';
  end if;


  /*
   * 9A. DISPENSE SUCCESS
   */
  if p_dispense_success = true then

    update public.vending_transactions
    set
      status = 'success',
      dispense_status = 'dispensed',
      dispense_completed_at = now(),
      dispense_failure_reason = null,
      completed_at = now()
    where
      id = v_transaction_id;


    v_status := 'success';
    v_dispense_status := 'dispensed';


    /*
     * Card payment has a student balance.
     * QR guest payments may not.
     */
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


    /*
     * Stock was already reserved during
     * payment authorization, so do NOT
     * deduct inventory again.
     */
    select
      vs.quantity
    into
      v_remaining_stock
    from public.vending_slots vs
    where
      vs.id = v_slot_id;


  /*
   * 9B. DISPENSE FAILURE
   */
  else

    /*
     * Current automatic refund implementation
     * supports student-wallet purchases.
     *
     * QR provider refunds will be implemented
     * separately through the payment provider.
     */
    if v_student_id is null then
      raise exception
        'Automatic refund is not available for this payment method';
    end if;


    /*
     * Lock student wallet before refunding.
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
     * Restore reserved inventory.
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


    /*
     * Record refund in wallet audit trail.
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
     * Finalize transaction as refunded.
     *
     * payment_status must become refunded
     * because of our lifecycle constraint.
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

    where
      id = v_transaction_id;


    v_status := 'refunded';
    v_payment_status := 'refunded';
    v_dispense_status := 'failed';

  end if;


  /*
   * 10. Return final result.
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

CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (
    select 1
    from public.admin_profiles
    where id = auth.uid()
      and role = 'admin'
      and status = 'active'
  );
$function$;

CREATE OR REPLACE FUNCTION public.lock_vending_request (
  p_request_id text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if p_request_id is null
     or trim(p_request_id) = '' then
    raise exception 'Request ID is required';
  end if;

  /*
   * Transaction-scoped advisory lock.
   *
   * Requests using the same request_id are serialized.
   * Different request IDs can continue concurrently.
   */
  perform pg_advisory_xact_lock(
    hashtextextended(
      trim(p_request_id),
      0
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.purchase_from_vending_machine (
  p_card_uid     text,
  p_machine_code text,
  p_slot_code    text
)
  RETURNS TABLE (
    transaction_id   uuid,
    transaction_code text,
    student_number   text,
    product_name     text,
    amount           numeric,
    balance_after    numeric,
    remaining_stock  integer
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_student_id uuid;
  v_card_id uuid;
  v_student_number text;
  v_student_balance numeric(12,2);

  v_machine_id uuid;

  v_slot_id uuid;
  v_product_id uuid;
  v_product_name text;
  v_product_price numeric(10,2);
  v_quantity integer;

  v_transaction_id uuid;
  v_transaction_code text;
  v_new_balance numeric(12,2);
begin
  /*
   * 1. Find and lock the student/card.
   */
  select
    s.id,
    sc.id,
    s.student_number,
    s.balance
  into
    v_student_id,
    v_card_id,
    v_student_number,
    v_student_balance
  from public.student_cards sc
  join public.students s
    on s.id = sc.student_id
  where upper(sc.card_uid) = upper(trim(p_card_uid))
    and sc.status = 'active'
    and s.status = 'active'
  for update of s;

  if not found then
    raise exception 'Card is not registered or active';
  end if;

  /*
   * 2. Find the vending machine.
   */
  select m.id
  into v_machine_id
  from public.machines m
  where m.machine_code = p_machine_code;

  if not found then
    raise exception 'Vending machine not found';
  end if;

  /*
   * 3. Find and lock the vending slot/product.
   */
  select
    vs.id,
    vs.product_id,
    p.name,
    p.price,
    vs.quantity
  into
    v_slot_id,
    v_product_id,
    v_product_name,
    v_product_price,
    v_quantity
  from public.vending_slots vs
  join public.products p
    on p.id = vs.product_id
  where vs.machine_id = v_machine_id
    and vs.slot_code = p_slot_code
    and vs.status = 'ready'
    and p.status = 'active'
  for update of vs;

  if not found then
    raise exception 'Slot or product is unavailable';
  end if;

  /*
   * 4. Verify inventory.
   */
  if v_quantity <= 0 then
    raise exception 'Product is out of stock';
  end if;

  /*
   * 5. Verify balance.
   */
  if v_student_balance < v_product_price then
    raise exception 'Insufficient balance';
  end if;

  v_new_balance :=
    v_student_balance - v_product_price;

  /*
   * 6. Generate transaction code.
   */
  v_transaction_code :=
    'TXN-' ||
    to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') ||
    '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  /*
   * 7. Create successful vending transaction.
   */
  insert into public.vending_transactions (
    transaction_code,
    student_id,
    card_id,
    machine_id,
    slot_id,
    product_id,
    product_name,
    amount,
    payment_method,
    status,
    completed_at
  )
  values (
    v_transaction_code,
    v_student_id,
    v_card_id,
    v_machine_id,
    v_slot_id,
    v_product_id,
    v_product_name,
    v_product_price,
    'student_id',
    'success',
    now()
  )
  returning id
  into v_transaction_id;

  /*
   * 8. Deduct student balance.
   */
  update public.students
  set
    balance = v_new_balance,
    updated_at = now()
  where id = v_student_id;

  /*
   * 9. Reduce slot inventory.
   */
  update public.vending_slots
  set
    quantity = quantity - 1,
    updated_at = now()
  where id = v_slot_id;

  /*
   * 10. Add balance audit record.
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
    'purchase',
    v_product_price,
    v_student_balance,
    v_new_balance,
    'Vending purchase - ' || v_product_name
  );

  /*
   * 11. Return purchase result.
   */
  return query
  select
    v_transaction_id,
    v_transaction_code,
    v_student_number,
    v_product_name,
    v_product_price,
    v_new_balance,
    v_quantity - 1;
end;
$function$;

CREATE OR REPLACE FUNCTION public.purchase_from_vending_machine (
  p_card_uid     text,
  p_machine_code text,
  p_slot_code    text,
  p_request_id   text
)
  RETURNS TABLE (
    transaction_id   uuid,
    transaction_code text,
    student_number   text,
    product_name     text,
    amount           numeric,
    balance_after    numeric,
    remaining_stock  integer
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$

declare
  v_student_id uuid;
  v_card_id uuid;
  v_student_number text;
  v_student_balance numeric(12,2);

  v_machine_id uuid;

  v_slot_id uuid;
  v_product_id uuid;
  v_product_name text;
  v_product_price numeric(10,2);
  v_quantity integer;

  v_transaction_id uuid;
  v_transaction_code text;
  v_new_balance numeric(12,2);

  v_existing_card_uid text;
  v_existing_machine_code text;
  v_existing_slot_code text;

begin

  /*
   * 1. Require request ID.
   */
  if p_request_id is null
     or trim(p_request_id) = '' then
    raise exception 'Request ID is required';
  end if;


  /*
   * 2. Serialize identical request IDs.
   */
  perform public.lock_vending_request(
    trim(p_request_id)
  );


  /*
   * 3. Check whether request already exists.
   *
   * Pending transactions are included because
   * payment may already have been completed while
   * dispensing has not happened yet.
   */
  select
    vt.id,
    vt.transaction_code,
    vt.student_id,
    vt.product_name,
    vt.amount,
    vt.request_card_uid,
    vt.request_machine_code,
    vt.request_slot_code
  into
    v_transaction_id,
    v_transaction_code,
    v_student_id,
    v_product_name,
    v_product_price,
    v_existing_card_uid,
    v_existing_machine_code,
    v_existing_slot_code
  from public.vending_transactions vt
  where vt.request_id = trim(p_request_id)
    and vt.status in (
      'pending',
      'success',
      'refunded'
    );


  if found then

    /*
     * Reject request-ID reuse with different
     * purchase details.
     */
    if
      upper(
        coalesce(
          v_existing_card_uid,
          ''
        )
      ) <> upper(trim(p_card_uid))

      or coalesce(
        v_existing_machine_code,
        ''
      ) <> trim(p_machine_code)

      or coalesce(
        v_existing_slot_code,
        ''
      ) <> trim(p_slot_code)

    then
      raise exception
        'Request ID has already been used for a different purchase';
    end if;


    /*
     * Legitimate retry.
     *
     * Return original payment transaction.
     */
    return query
    select
      vt.id,
      vt.transaction_code,
      s.student_number,
      vt.product_name,
      vt.amount,
      bt.balance_after,
      vs.quantity
    from public.vending_transactions vt

    join public.students s
      on s.id = vt.student_id

    join public.vending_slots vs
      on vs.id = vt.slot_id

    left join public.balance_transactions bt
      on bt.vending_transaction_id = vt.id
     and bt.transaction_type = 'purchase'

    where vt.id = v_transaction_id;

    return;

  end if;


  /*
   * 4. Find and lock active student/card.
   */
  select
    s.id,
    sc.id,
    s.student_number,
    s.balance
  into
    v_student_id,
    v_card_id,
    v_student_number,
    v_student_balance
  from public.student_cards sc

  join public.students s
    on s.id = sc.student_id

  where
    upper(sc.card_uid)
      = upper(trim(p_card_uid))

    and sc.status = 'active'
    and s.status = 'active'

  for update of s;


  if not found then
    raise exception
      'Card is not registered or active';
  end if;


  /*
   * 5. Find machine.
   */
  select
    m.id
  into
    v_machine_id
  from public.machines m
  where
    m.machine_code =
      trim(p_machine_code);


  if not found then
    raise exception
      'Vending machine not found';
  end if;


  /*
   * 6. Find and lock slot/product.
   */
  select
    vs.id,
    vs.product_id,
    p.name,
    p.price,
    vs.quantity
  into
    v_slot_id,
    v_product_id,
    v_product_name,
    v_product_price,
    v_quantity
  from public.vending_slots vs

  join public.products p
    on p.id = vs.product_id

  where
    vs.machine_id = v_machine_id

    and vs.slot_code =
      trim(p_slot_code)

    and vs.status = 'ready'

    and p.status = 'active'

  for update of vs;


  if not found then
    raise exception
      'Slot or product is unavailable';
  end if;


  /*
   * 7. Verify stock.
   */
  if v_quantity <= 0 then
    raise exception
      'Product is out of stock';
  end if;


  /*
   * 8. Verify wallet balance.
   */
  if v_student_balance <
     v_product_price then
    raise exception
      'Insufficient balance';
  end if;


  /*
   * 9. Calculate wallet balance.
   */
  v_new_balance :=
    v_student_balance -
    v_product_price;


  /*
   * 10. Generate transaction code.
   */
  v_transaction_code :=
    'TXN-' ||

    to_char(
      clock_timestamp(),
      'YYYYMMDDHH24MISSMS'
    )

    || '-' ||

    upper(
      substr(
        replace(
          gen_random_uuid()::text,
          '-',
          ''
        ),
        1,
        6
      )
    );


  /*
   * 11. Create PAID but PENDING transaction.
   *
   * Important:
   * Payment succeeded, but physical dispensing
   * has NOT yet been confirmed.
   */
  insert into public.vending_transactions (
    transaction_code,
    request_id,

    request_card_uid,
    request_machine_code,
    request_slot_code,

    student_id,
    card_id,
    machine_id,
    slot_id,
    product_id,

    product_name,
    amount,

    payment_method,
    payment_status,
    paid_at,

    status,

    dispense_status
  )
  values (
    v_transaction_code,
    trim(p_request_id),

    upper(trim(p_card_uid)),
    trim(p_machine_code),
    trim(p_slot_code),

    v_student_id,
    v_card_id,
    v_machine_id,
    v_slot_id,
    v_product_id,

    v_product_name,
    v_product_price,

    'student_id',
    'paid',
    now(),

    'pending',

    'not_started'
  )
  returning id
  into v_transaction_id;


  /*
   * 12. Deduct wallet balance.
   */
  update public.students
  set
    balance = v_new_balance,
    updated_at = now()
  where
    id = v_student_id;


  /*
   * 13. Reserve one inventory item.
   *
   * We reduce available stock at authorization
   * time so another customer cannot buy the
   * same last item.
   *
   * If dispensing later fails, the refund
   * process will restore this quantity.
   */
  update public.vending_slots
  set
    quantity = quantity - 1,
    updated_at = now()
  where
    id = v_slot_id;


  /*
   * 14. Record wallet purchase audit.
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
    'purchase',
    v_product_price,
    v_student_balance,
    v_new_balance,
    'Vending purchase authorization - ' ||
      v_product_name
  );


  /*
   * 15. Return authorization result.
   */
  return query
  select
    v_transaction_id,
    v_transaction_code,
    v_student_number,
    v_product_name,
    v_product_price,
    v_new_balance,
    v_quantity - 1;

end;
$function$;

CREATE OR REPLACE FUNCTION public.start_vending_dispense (
  p_transaction_id uuid,
  p_machine_code   text
)
  RETURNS TABLE (
    transaction_id     uuid,
    transaction_code   text,
    transaction_status text,
    payment_status     text,
    dispense_status    text,
    slot_code          text,
    motor_number       integer,
    product_name       text
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$

declare
  v_transaction_id uuid;
  v_transaction_code text;

  v_machine_id uuid;
  v_transaction_machine_id uuid;

  v_slot_id uuid;
  v_slot_code text;
  v_motor_number integer;

  v_product_name text;

  v_status text;
  v_payment_status text;
  v_dispense_status text;

begin

  /*
   * 1. Validate transaction ID.
   */
  if p_transaction_id is null then
    raise exception
      'Transaction ID is required';
  end if;


  /*
   * 2. Validate machine code.
   */
  if p_machine_code is null
     or trim(p_machine_code) = '' then
    raise exception
      'Machine code is required';
  end if;


  /*
   * 3. Find machine.
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
   * 4. Find and lock transaction.
   */
  select
    vt.id,
    vt.transaction_code,
    vt.machine_id,
    vt.slot_id,
    vt.product_name,
    vt.status,
    vt.payment_status,
    vt.dispense_status
  into
    v_transaction_id,
    v_transaction_code,
    v_transaction_machine_id,
    v_slot_id,
    v_product_name,
    v_status,
    v_payment_status,
    v_dispense_status
  from public.vending_transactions vt
  where
    vt.id = p_transaction_id
  for update;


  if not found then
    raise exception
      'Transaction not found';
  end if;


  /*
   * 5. Ensure transaction belongs to
   *    the requesting machine.
   */
  if v_transaction_machine_id
     <> v_machine_id then

    raise exception
      'Transaction does not belong to this machine';

  end if;


  /*
   * 6. Payment must already be confirmed.
   */
  if v_payment_status <> 'paid' then
    raise exception
      'Payment is not confirmed';
  end if;


  /*
   * 7. Transaction must still be pending.
   */
  if v_status <> 'pending' then
    raise exception
      'Transaction is not pending';
  end if;


  /*
   * 8. Handle idempotent retry.
   *
   * If the machine already started dispensing
   * this transaction, return the same state
   * instead of starting it again.
   */
  if v_dispense_status = 'dispensing' then

    select
      vs.slot_code,
      vs.motor_number
    into
      v_slot_code,
      v_motor_number
    from public.vending_slots vs
    where
      vs.id = v_slot_id;


    return query
    select
      v_transaction_id,
      v_transaction_code,
      v_status,
      v_payment_status,
      v_dispense_status,
      v_slot_code,
      v_motor_number,
      v_product_name;

    return;

  end if;


  /*
   * 9. Dispensing can only start from
   *    not_started.
   */
  if v_dispense_status <> 'not_started' then
    raise exception
      'Transaction cannot start dispensing';
  end if;


  /*
   * 10. Retrieve physical slot/motor.
   */
  select
    vs.slot_code,
    vs.motor_number
  into
    v_slot_code,
    v_motor_number
  from public.vending_slots vs
  where
    vs.id = v_slot_id;


  if not found then
    raise exception
      'Vending slot not found';
  end if;


  /*
   * 11. Mark dispensing as started.
   */
  update public.vending_transactions
  set
    dispense_status = 'dispensing',
    dispense_started_at = now(),
    dispense_failure_reason = null
  where
    id = v_transaction_id;


  v_dispense_status := 'dispensing';


  /*
   * 12. Return the dispense instruction.
   *
   * Later the ESP32-S3 will use motor_number
   * to operate the correct physical motor.
   */
  return query
  select
    v_transaction_id,
    v_transaction_code,
    v_status,
    v_payment_status,
    v_dispense_status,
    v_slot_code,
    v_motor_number,
    v_product_name;

end;
$function$;

CREATE OR REPLACE FUNCTION public.top_up_student_balance (
  p_student_id  uuid,
  p_amount      numeric,
  p_description text    DEFAULT 'Admin top-up'::text
)
  RETURNS TABLE (
    student_id       uuid,
    previous_balance numeric,
    new_balance      numeric,
    transaction_id   uuid
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_previous_balance numeric(12,2);
  v_new_balance numeric(12,2);
  v_transaction_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Top-up amount must be greater than zero';
  end if;

  select balance
  into v_previous_balance
  from public.students
  where id = p_student_id
  for update;

  if not found then
    raise exception 'Student not found';
  end if;

  v_new_balance :=
    v_previous_balance + round(p_amount, 2);

  update public.students
  set
    balance = v_new_balance,
    updated_at = now()
  where id = p_student_id;

  insert into public.balance_transactions (
    student_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    description
  )
  values (
    p_student_id,
    'top_up',
    round(p_amount, 2),
    v_previous_balance,
    v_new_balance,
    p_description
  )
  returning id into v_transaction_id;

  return query
  select
    p_student_id,
    v_previous_balance,
    v_new_balance,
    v_transaction_id;
end;
$function$;

ALTER TABLE "public"."admin_profiles"
  ADD CONSTRAINT "admin_profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."machine_events"
  ADD CONSTRAINT "machine_events_machine_id_fkey" FOREIGN KEY (machine_id) REFERENCES public.machines(id) ON DELETE CASCADE;

ALTER TABLE "public"."balance_transactions"
  ADD CONSTRAINT "balance_transactions_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE RESTRICT;

ALTER TABLE "public"."student_cards"
  ADD CONSTRAINT "student_cards_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE "public"."system_settings"
  ADD CONSTRAINT "system_settings_machine_id_fkey" FOREIGN KEY (machine_id) REFERENCES public.machines(id) ON DELETE CASCADE;

ALTER TABLE "public"."vending_slots"
  ADD CONSTRAINT "vending_slots_machine_id_fkey" FOREIGN KEY (machine_id) REFERENCES public.machines(id) ON DELETE CASCADE;

ALTER TABLE "public"."machine_events"
  ADD CONSTRAINT "machine_events_slot_id_fkey" FOREIGN KEY (slot_id) REFERENCES public.vending_slots(id) ON DELETE SET NULL;

ALTER TABLE "public"."vending_slots"
  ADD CONSTRAINT "vending_slots_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE "public"."vending_transactions"
  ADD CONSTRAINT "vending_transactions_card_id_fkey" FOREIGN KEY (card_id) REFERENCES public.student_cards(id) ON DELETE SET NULL;

ALTER TABLE "public"."vending_transactions"
  ADD CONSTRAINT "vending_transactions_machine_id_fkey" FOREIGN KEY (machine_id) REFERENCES public.machines(id) ON DELETE SET NULL;

ALTER TABLE "public"."balance_transactions"
  ADD CONSTRAINT "balance_transactions_vending_transaction_id_fkey" FOREIGN KEY (vending_transaction_id) REFERENCES public.vending_transactions(id) ON DELETE SET NULL;

ALTER TABLE "public"."vending_transactions"
  ADD CONSTRAINT "vending_transactions_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE "public"."vending_transactions"
  ADD CONSTRAINT "vending_transactions_slot_id_fkey" FOREIGN KEY (slot_id) REFERENCES public.vending_slots(id) ON DELETE SET NULL;

ALTER TABLE "public"."vending_transactions"
  ADD CONSTRAINT "vending_transactions_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX vending_transactions_payment_reference_key ON public.vending_transactions USING btree (payment_provider, payment_reference)
  WHERE (payment_reference IS NOT NULL);

CREATE UNIQUE INDEX vending_transactions_request_id_key ON public.vending_transactions USING btree (request_id)
  WHERE (request_id IS NOT NULL);

CREATE POLICY "Admins can read admin profiles" ON "public"."admin_profiles"
  FOR SELECT
  TO "authenticated"
  USING (public.is_admin());

CREATE POLICY "Admins can manage balance transactions" ON "public"."balance_transactions"
  FOR ALL
  TO "authenticated"
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can manage machine events" ON "public"."machine_events"
  FOR ALL
  TO "authenticated"
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can manage machines" ON "public"."machines"
  FOR ALL
  TO "authenticated"
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can manage products" ON "public"."products"
  FOR ALL
  TO "authenticated"
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can manage student cards" ON "public"."student_cards"
  FOR ALL
  TO "authenticated"
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can manage students" ON "public"."students"
  FOR ALL
  TO "authenticated"
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can manage system settings" ON "public"."system_settings"
  FOR ALL
  TO "authenticated"
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can manage vending slots" ON "public"."vending_slots"
  FOR ALL
  TO "authenticated"
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can manage vending transactions" ON "public"."vending_transactions"
  FOR ALL
  TO "authenticated"
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT EXECUTE ON FUNCTION "public"."complete_vending_dispense"(uuid, text, boolean, text) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."is_admin"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."is_admin"() TO "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."lock_vending_request"(text) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."purchase_from_vending_machine"(text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."purchase_from_vending_machine"(text, text, text) TO "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."purchase_from_vending_machine"(text, text, text, text) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."start_vending_dispense"(uuid, text) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."top_up_student_balance"(uuid, numeric, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."top_up_student_balance"(uuid, numeric, text) TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."admin_profiles" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."balance_transactions" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."machine_events" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."machines" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."products" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."student_cards" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."students" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."system_settings" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."vending_slots" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."vending_transactions" TO "anon", "authenticated", "postgres", "service_role";

