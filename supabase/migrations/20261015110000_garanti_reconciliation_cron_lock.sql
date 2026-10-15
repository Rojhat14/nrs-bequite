BEGIN;

-- One global lease serializes scheduled reconciliation across overlapping
-- Vercel invocations. The payment/order state remains owned by the existing
-- reconciliation and finalize RPCs.
CREATE TABLE IF NOT EXISTS public.garanti_reconciliation_cron_locks (
  lock_name text PRIMARY KEY CHECK (lock_name = 'expired-pending-orders'),
  lease_token uuid,
  lease_expires_at timestamptz,
  CHECK ((lease_token IS NULL) = (lease_expires_at IS NULL))
);
INSERT INTO public.garanti_reconciliation_cron_locks(lock_name)
VALUES ('expired-pending-orders') ON CONFLICT (lock_name) DO NOTHING;
ALTER TABLE public.garanti_reconciliation_cron_locks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.garanti_reconciliation_cron_locks FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.garanti_reconciliation_cron_locks TO service_role;

CREATE OR REPLACE FUNCTION public.nrs_acquire_garanti_reconciliation_cron_lock(p_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE acquired boolean := false;
BEGIN
  IF NOT public.nrs_garanti_service_role_request() OR p_token IS NULL THEN
    RAISE EXCEPTION 'service role and lease token required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.garanti_reconciliation_cron_locks
    SET lease_token = p_token, lease_expires_at = now() + interval '2 minutes'
    WHERE lock_name = 'expired-pending-orders'
      AND (lease_expires_at IS NULL OR lease_expires_at <= now())
    RETURNING true INTO acquired;
  RETURN coalesce(acquired, false);
END $$;
REVOKE ALL ON FUNCTION public.nrs_acquire_garanti_reconciliation_cron_lock(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nrs_acquire_garanti_reconciliation_cron_lock(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.nrs_release_garanti_reconciliation_cron_lock(p_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE released boolean := false;
BEGIN
  IF NOT public.nrs_garanti_service_role_request() OR p_token IS NULL THEN
    RAISE EXCEPTION 'service role and lease token required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.garanti_reconciliation_cron_locks
    SET lease_token = NULL, lease_expires_at = NULL
    WHERE lock_name = 'expired-pending-orders' AND lease_token = p_token
    RETURNING true INTO released;
  RETURN coalesce(released, false);
END $$;
REVOKE ALL ON FUNCTION public.nrs_release_garanti_reconciliation_cron_lock(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nrs_release_garanti_reconciliation_cron_lock(uuid) TO service_role;

COMMIT;
