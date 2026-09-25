-- ============================================================
-- SmartVend QR Payment Support
-- ============================================================
-- Adds provider-independent QR payment information to existing
-- vending transactions.
--
-- Sensitive payment creation and webhook processing will happen
-- through Supabase Edge Functions, never directly from React or
-- the vending device.
-- ============================================================


-- ------------------------------------------------------------
-- QR payment metadata
-- ------------------------------------------------------------

ALTER TABLE public.vending_transactions
ADD COLUMN IF NOT EXISTS payment_checkout_id text,
ADD COLUMN IF NOT EXISTS payment_qr_data text,
ADD COLUMN IF NOT EXISTS payment_expires_at timestamptz,
ADD COLUMN IF NOT EXISTS payment_last_event text,
ADD COLUMN IF NOT EXISTS payment_last_event_at timestamptz;


-- ------------------------------------------------------------
-- Prevent duplicate provider checkout/payment IDs
-- ------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS
vending_transactions_payment_checkout_id_key
ON public.vending_transactions (
  payment_provider,
  payment_checkout_id
)
WHERE payment_checkout_id IS NOT NULL;


-- ------------------------------------------------------------
-- Lookup index used by payment webhooks
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS
vending_transactions_payment_reference_idx
ON public.vending_transactions (
  payment_reference
)
WHERE payment_reference IS NOT NULL;


-- ------------------------------------------------------------
-- Lookup active QR transactions by expiration
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS
vending_transactions_qr_expiration_idx
ON public.vending_transactions (
  payment_expires_at
)
WHERE payment_method = 'qr'
  AND payment_status = 'pending';


-- ------------------------------------------------------------
-- QR transaction consistency
-- ------------------------------------------------------------

ALTER TABLE public.vending_transactions
DROP CONSTRAINT IF EXISTS vending_qr_requires_provider;

ALTER TABLE public.vending_transactions
ADD CONSTRAINT vending_qr_requires_provider
CHECK (
  payment_method <> 'qr'
  OR payment_provider IS NOT NULL
);


ALTER TABLE public.vending_transactions
DROP CONSTRAINT IF EXISTS vending_qr_requires_expiration;

ALTER TABLE public.vending_transactions
ADD CONSTRAINT vending_qr_requires_expiration
CHECK (
  payment_method <> 'qr'
  OR payment_expires_at IS NOT NULL
);


-- ------------------------------------------------------------
-- QR payments must not be treated as successful before payment
-- confirmation has been received from the provider.
-- ------------------------------------------------------------

ALTER TABLE public.vending_transactions
DROP CONSTRAINT IF EXISTS vending_qr_success_requires_paid;

ALTER TABLE public.vending_transactions
ADD CONSTRAINT vending_qr_success_requires_paid
CHECK (
  payment_method <> 'qr'
  OR status <> 'success'
  OR payment_status = 'paid'
);