-- ============================================================
-- Fix QR vending purchase machine status validation
-- ============================================================
-- SmartVend machine statuses:
--   online
--   offline
--   maintenance
--
-- QR purchases are allowed only while the machine is online.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_qr_vending_purchase(
  p_machine_code text,
  p_slot_code text,
  p_request_id text,
  p_payment_provider text DEFAULT 'maya'
)
RETURNS TABLE (
  transaction_id uuid,
  transaction_code text,
  product_name text,
  amount numeric,
  machine_code text,
  slot_code text,
  request_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_machine public.machines%ROWTYPE;
  v_slot public.vending_slots%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_existing public.vending_transactions%ROWTYPE;

  v_transaction_id uuid;
  v_transaction_code text;
BEGIN

  -- ----------------------------------------------------------
  -- Validate request
  -- ----------------------------------------------------------

  IF p_request_id IS NULL
     OR trim(p_request_id) = '' THEN
    RAISE EXCEPTION 'Request ID is required';
  END IF;

  IF p_machine_code IS NULL
     OR trim(p_machine_code) = '' THEN
    RAISE EXCEPTION 'Machine code is required';
  END IF;

  IF p_slot_code IS NULL
     OR trim(p_slot_code) = '' THEN
    RAISE EXCEPTION 'Slot code is required';
  END IF;

  IF p_payment_provider IS NULL
     OR trim(p_payment_provider) = '' THEN
    RAISE EXCEPTION 'Payment provider is required';
  END IF;


  -- ----------------------------------------------------------
  -- Lock request ID for idempotency
  -- ----------------------------------------------------------

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      trim(p_request_id),
      0
    )
  );


  -- ----------------------------------------------------------
  -- Handle retry of an existing request
  -- ----------------------------------------------------------

  SELECT *
  INTO v_existing
  FROM public.vending_transactions
  WHERE vending_transactions.request_id =
        trim(p_request_id)
  LIMIT 1;

  IF FOUND THEN

    IF v_existing.payment_method <> 'qr'
       OR v_existing.request_machine_code <>
          trim(p_machine_code)
       OR v_existing.request_slot_code <>
          trim(p_slot_code)
       OR v_existing.payment_provider <>
          trim(p_payment_provider) THEN

      RAISE EXCEPTION
        'Request ID conflicts with an existing transaction';

    END IF;

    RETURN QUERY
    SELECT
      v_existing.id,
      v_existing.transaction_code,
      v_existing.product_name,
      v_existing.amount,
      v_existing.request_machine_code,
      v_existing.request_slot_code,
      v_existing.request_id;

    RETURN;

  END IF;


  -- ----------------------------------------------------------
  -- Find vending machine
  -- ----------------------------------------------------------

  SELECT *
  INTO v_machine
  FROM public.machines
  WHERE machines.machine_code =
        trim(p_machine_code)
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Machine not found';
  END IF;


  -- ----------------------------------------------------------
  -- Machine must be online
  -- ----------------------------------------------------------

  IF v_machine.status <> 'online' THEN
    RAISE EXCEPTION 'Machine is not online';
  END IF;


  -- ----------------------------------------------------------
  -- Lock vending slot
  -- ----------------------------------------------------------

  SELECT *
  INTO v_slot
  FROM public.vending_slots
  WHERE vending_slots.machine_id = v_machine.id
    AND vending_slots.slot_code =
        trim(p_slot_code)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vending slot not found';
  END IF;

  IF v_slot.status <> 'ready' THEN
    RAISE EXCEPTION 'Vending slot is not ready';
  END IF;

  IF v_slot.product_id IS NULL THEN
    RAISE EXCEPTION
      'No product assigned to vending slot';
  END IF;

  IF v_slot.quantity <= 0 THEN
    RAISE EXCEPTION 'Product is out of stock';
  END IF;


  -- ----------------------------------------------------------
  -- Get product
  -- ----------------------------------------------------------

  SELECT *
  INTO v_product
  FROM public.products
  WHERE products.id = v_slot.product_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF v_product.status <> 'active' THEN
    RAISE EXCEPTION 'Product is not active';
  END IF;


  -- ----------------------------------------------------------
  -- Generate transaction identifiers
  -- ----------------------------------------------------------

  v_transaction_id := gen_random_uuid();

  v_transaction_code :=
    'QR-' ||
    to_char(
      clock_timestamp(),
      'YYYYMMDDHH24MISSMS'
    ) ||
    '-' ||
    upper(
      substr(
        replace(
          v_transaction_id::text,
          '-',
          ''
        ),
        1,
        6
      )
    );


  -- ----------------------------------------------------------
  -- Create pending QR transaction
  -- ----------------------------------------------------------

  INSERT INTO public.vending_transactions (
    id,
    transaction_code,

    student_id,
    card_id,

    machine_id,
    slot_id,
    product_id,

    product_name,
    amount,

    payment_method,
    payment_provider,
    payment_status,

    status,
    dispense_status,

    request_id,
    request_machine_code,
    request_slot_code,

    payment_expires_at
  )
  VALUES (
    v_transaction_id,
    v_transaction_code,

    NULL,
    NULL,

    v_machine.id,
    v_slot.id,
    v_product.id,

    v_product.name,
    v_product.price,

    'qr',
    trim(p_payment_provider),
    'pending',

    'pending',
    'not_started',

    trim(p_request_id),
    trim(p_machine_code),
    trim(p_slot_code),

    now() + interval '1 hour'
  );


  -- ----------------------------------------------------------
  -- Reserve one item
  -- ----------------------------------------------------------

  UPDATE public.vending_slots
  SET
    quantity = quantity - 1,
    updated_at = now()
  WHERE id = v_slot.id;


  RETURN QUERY
  SELECT
    v_transaction_id,
    v_transaction_code,
    v_product.name,
    v_product.price,
    trim(p_machine_code),
    trim(p_slot_code),
    trim(p_request_id);

END;
$function$;


-- ============================================================
-- Preserve server-side-only permissions
-- ============================================================

REVOKE ALL ON FUNCTION
public.create_qr_vending_purchase(
  text,
  text,
  text,
  text
)
FROM PUBLIC;

REVOKE ALL ON FUNCTION
public.create_qr_vending_purchase(
  text,
  text,
  text,
  text
)
FROM anon;

REVOKE ALL ON FUNCTION
public.create_qr_vending_purchase(
  text,
  text,
  text,
  text
)
FROM authenticated;

GRANT EXECUTE ON FUNCTION
public.create_qr_vending_purchase(
  text,
  text,
  text,
  text
)
TO service_role;