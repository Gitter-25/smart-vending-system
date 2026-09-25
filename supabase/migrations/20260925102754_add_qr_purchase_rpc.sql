-- ============================================================
-- SmartVend QR Purchase RPC
-- ============================================================
-- Provides atomic QR purchase reservation and safe cancellation.
--
-- Trusted server-side use only through Supabase Edge Functions.
-- ============================================================


-- ============================================================
-- 1. CREATE QR VENDING PURCHASE
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
  -- Find active vending machine
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

  IF v_machine.status <> 'active' THEN
    RAISE EXCEPTION 'Machine is not active';
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
  -- Get active product
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
  -- Reserve inventory
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
-- 2. CANCEL / EXPIRE QR PURCHASE
-- ============================================================
-- Releases reserved inventory when:
--
--   * provider QR creation fails
--   * customer cancels before payment
--   * QR expires before payment
--
-- This function is idempotent. Repeating cancellation does not
-- restore inventory more than once.
-- ============================================================

CREATE OR REPLACE FUNCTION public.cancel_qr_vending_purchase(
  p_transaction_id uuid,
  p_reason text DEFAULT 'QR payment cancelled'
)
RETURNS TABLE (
  transaction_id uuid,
  status text,
  payment_status text,
  stock_released boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_transaction public.vending_transactions%ROWTYPE;
  v_stock_released boolean := false;
BEGIN

  IF p_transaction_id IS NULL THEN
    RAISE EXCEPTION 'Transaction ID is required';
  END IF;


  -- ----------------------------------------------------------
  -- Lock transaction
  -- ----------------------------------------------------------

  SELECT *
  INTO v_transaction
  FROM public.vending_transactions
  WHERE id = p_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;


  -- ----------------------------------------------------------
  -- Only QR transactions are supported
  -- ----------------------------------------------------------

  IF v_transaction.payment_method <> 'qr' THEN
    RAISE EXCEPTION
      'Transaction is not a QR payment';
  END IF;


  -- ----------------------------------------------------------
  -- Never cancel a confirmed payment here
  -- ----------------------------------------------------------

  IF v_transaction.payment_status IN (
    'authorized',
    'paid',
    'refunded'
  ) THEN
    RAISE EXCEPTION
      'Confirmed payment cannot be cancelled';
  END IF;


  -- ----------------------------------------------------------
  -- Already cancelled/expired/failed
  --
  -- Return current state without restoring stock again.
  -- ----------------------------------------------------------

  IF v_transaction.payment_status IN (
    'failed',
    'expired'
  ) THEN

    RETURN QUERY
    SELECT
      v_transaction.id,
      v_transaction.status,
      v_transaction.payment_status,
      false;

    RETURN;

  END IF;


  -- ----------------------------------------------------------
  -- Transaction must still be waiting for payment
  -- ----------------------------------------------------------

  IF v_transaction.status <> 'pending'
     OR v_transaction.payment_status <> 'pending'
     OR v_transaction.dispense_status <> 'not_started' THEN

    RAISE EXCEPTION
      'QR transaction cannot be cancelled in its current state';

  END IF;


  -- ----------------------------------------------------------
  -- Restore reserved inventory
  -- ----------------------------------------------------------

  IF v_transaction.slot_id IS NOT NULL THEN

    UPDATE public.vending_slots
    SET
      quantity = quantity + 1,
      updated_at = now()
    WHERE id = v_transaction.slot_id;

    v_stock_released := true;

  END IF;


  -- ----------------------------------------------------------
  -- Mark QR transaction as failed/expired
  -- ----------------------------------------------------------

  UPDATE public.vending_transactions
  SET
    status = 'failed',

    payment_status =
      CASE
        WHEN payment_expires_at IS NOT NULL
             AND payment_expires_at <= now()
          THEN 'expired'
        ELSE 'failed'
      END,

    failure_reason =
      COALESCE(
        NULLIF(trim(p_reason), ''),
        'QR payment cancelled'
      ),

    payment_last_event =
      CASE
        WHEN payment_expires_at IS NOT NULL
             AND payment_expires_at <= now()
          THEN 'expired'
        ELSE 'cancelled'
      END,

    payment_last_event_at = now(),

    completed_at = now()

  WHERE id = v_transaction.id;


  -- ----------------------------------------------------------
  -- Return finalized state
  -- ----------------------------------------------------------

  RETURN QUERY
  SELECT
    vt.id,
    vt.status,
    vt.payment_status,
    v_stock_released
  FROM public.vending_transactions vt
  WHERE vt.id = v_transaction.id;

END;
$function$;



-- ============================================================
-- 3. SECURITY
-- ============================================================
-- Both RPCs are server-side only.
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


REVOKE ALL ON FUNCTION
public.cancel_qr_vending_purchase(
  uuid,
  text
)
FROM PUBLIC;

REVOKE ALL ON FUNCTION
public.cancel_qr_vending_purchase(
  uuid,
  text
)
FROM anon;

REVOKE ALL ON FUNCTION
public.cancel_qr_vending_purchase(
  uuid,
  text
)
FROM authenticated;

GRANT EXECUTE ON FUNCTION
public.cancel_qr_vending_purchase(
  uuid,
  text
)
TO service_role;