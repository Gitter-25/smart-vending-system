-- SmartVend vending RPC security hardening
--
-- Vending transaction RPCs must not be callable directly by
-- anonymous or normal authenticated Supabase clients.
--
-- These operations are exposed through trusted Edge Functions,
-- which authenticate the vending device and invoke the RPCs
-- using the service role.

-- ============================================================
-- Purchase authorization
-- ============================================================

REVOKE ALL ON FUNCTION
public.purchase_from_vending_machine(text, text, text, text)
FROM PUBLIC;

REVOKE ALL ON FUNCTION
public.purchase_from_vending_machine(text, text, text, text)
FROM anon;

REVOKE ALL ON FUNCTION
public.purchase_from_vending_machine(text, text, text, text)
FROM authenticated;

GRANT EXECUTE ON FUNCTION
public.purchase_from_vending_machine(text, text, text, text)
TO service_role;


-- ============================================================
-- Request idempotency lock
-- ============================================================

REVOKE ALL ON FUNCTION
public.lock_vending_request(text)
FROM PUBLIC;

REVOKE ALL ON FUNCTION
public.lock_vending_request(text)
FROM anon;

REVOKE ALL ON FUNCTION
public.lock_vending_request(text)
FROM authenticated;

GRANT EXECUTE ON FUNCTION
public.lock_vending_request(text)
TO service_role;


-- ============================================================
-- Start physical dispensing
-- ============================================================

REVOKE ALL ON FUNCTION
public.start_vending_dispense(uuid, text)
FROM PUBLIC;

REVOKE ALL ON FUNCTION
public.start_vending_dispense(uuid, text)
FROM anon;

REVOKE ALL ON FUNCTION
public.start_vending_dispense(uuid, text)
FROM authenticated;

GRANT EXECUTE ON FUNCTION
public.start_vending_dispense(uuid, text)
TO service_role;


-- ============================================================
-- Complete physical dispensing / refund handling
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


-- ============================================================
-- Legacy 3-argument purchase RPC
-- ============================================================

REVOKE ALL ON FUNCTION
public.purchase_from_vending_machine(text, text, text)
FROM PUBLIC;

REVOKE ALL ON FUNCTION
public.purchase_from_vending_machine(text, text, text)
FROM anon;

REVOKE ALL ON FUNCTION
public.purchase_from_vending_machine(text, text, text)
FROM authenticated;

-- Keep service-role access only if legacy server-side code still
-- needs this overload.
GRANT EXECUTE ON FUNCTION
public.purchase_from_vending_machine(text, text, text)
TO service_role;