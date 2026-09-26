-- ============================================================
-- SmartVend
-- External Payment Refund Tracking
--
-- Adds explicit refund lifecycle fields for external payment
-- methods such as Maya QR.
--
-- Important:
-- payment_status remains 'paid' until the external payment
-- provider actually confirms that the refund succeeded.
-- ============================================================


-- ============================================================
-- 1. Add refund tracking columns
-- ============================================================

alter table public.vending_transactions
add column if not exists refund_status text not null default 'not_required',
add column if not exists refund_reference text,
add column if not exists refund_requested_at timestamp with time zone,
add column if not exists refund_completed_at timestamp with time zone,
add column if not exists refund_failure_reason text,
add column if not exists refund_last_attempt_at timestamp with time zone;


-- ============================================================
-- 2. Restrict refund lifecycle values
-- ============================================================

alter table public.vending_transactions
drop constraint if exists vending_transactions_refund_status_check;

alter table public.vending_transactions
add constraint vending_transactions_refund_status_check
check (
  refund_status in (
    'not_required',
    'required',
    'processing',
    'completed',
    'failed'
  )
);


-- ============================================================
-- 3. Refund completion consistency
--
-- A completed external refund must have a completion timestamp.
-- Other states must not claim a completed refund.
-- ============================================================

alter table public.vending_transactions
drop constraint if exists vending_transactions_refund_completed_check;

alter table public.vending_transactions
add constraint vending_transactions_refund_completed_check
check (
  (
    refund_status = 'completed'
    and refund_completed_at is not null
  )
  or
  (
    refund_status <> 'completed'
    and refund_completed_at is null
  )
);


-- ============================================================
-- 4. Refund-required timestamp consistency
--
-- Once refund processing has started or completed, there must
-- be a record of when the refund was requested.
-- ============================================================

alter table public.vending_transactions
drop constraint if exists vending_transactions_refund_requested_check;

alter table public.vending_transactions
add constraint vending_transactions_refund_requested_check
check (
  refund_status in ('not_required', 'required')
  or refund_requested_at is not null
);


-- ============================================================
-- 5. Index transactions requiring refund recovery
--
-- This allows the backend/admin system to efficiently find
-- external payments that still need attention.
-- ============================================================

create index if not exists
  idx_vending_transactions_refund_recovery
on public.vending_transactions (refund_status)
where refund_status in (
  'required',
  'processing',
  'failed'
);