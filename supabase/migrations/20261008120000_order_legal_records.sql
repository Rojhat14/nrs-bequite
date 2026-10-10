-- PREPARED ONLY: inspect live schema/policies before applying. No existing table
-- or policy is altered. UUID is evidenced by the existing admin order RPC;
-- preflight aborts if actual schema differs. No IP/user-agent collection.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.orders') IS NULL THEN
    RAISE EXCEPTION 'Expected existing public.orders is missing; inspect schema.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'id' AND udt_name = 'uuid')
    OR NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'user_id' AND udt_name = 'uuid') THEN
    RAISE EXCEPTION 'orders.id/user_id types differ; inspect live schema before applying.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
    AND table_name = 'orders' AND column_name IN ('contract_accepted', 'contract_version', 'pre_information_version', 'accepted_at')) THEN
    RAISE EXCEPTION 'Existing order legal fields detected; reuse/review them before creating duplicate storage.';
  END IF;
  IF to_regclass('public.order_legal_records') IS NOT NULL THEN
    RAISE EXCEPTION 'Legal record storage already exists; inspect and reuse it.';
  END IF;
END;
$$;

CREATE TABLE public.order_legal_records (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE RESTRICT,
  contract_accepted boolean NOT NULL CHECK (contract_accepted = true),
  contract_version text NOT NULL CHECK (length(trim(contract_version)) > 0),
  pre_information_version text NOT NULL CHECK (length(trim(pre_information_version)) > 0),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  document_hash text NOT NULL CHECK (document_hash ~ '^[0-9a-f]{64}$'),
  summary_hash text NOT NULL CHECK (summary_hash ~ '^[0-9a-f]{64}$'),
  order_summary jsonb NOT NULL CHECK (jsonb_typeof(order_summary) = 'object')
);

COMMENT ON TABLE public.order_legal_records IS
  'Immutable accepted document versions plus compact, server-verified order snapshot. Write atomically with the future order transaction; never accept client prices or timestamps.';

ALTER TABLE public.order_legal_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_legal_records FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.order_legal_records TO authenticated;
GRANT SELECT, INSERT ON public.order_legal_records TO service_role;

CREATE POLICY nrs_order_legal_records_owner_read
  ON public.order_legal_records FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders AS o
    WHERE o.id = order_legal_records.order_id AND o.user_id = (SELECT auth.uid())));

-- No client INSERT/UPDATE/DELETE policy. Accepted snapshots are not rewritten.
CREATE FUNCTION public.nrs_prevent_legal_record_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Accepted legal records cannot be updated or deleted.' USING ERRCODE = '42501';
END;
$$;
REVOKE ALL ON FUNCTION public.nrs_prevent_legal_record_update() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER nrs_order_legal_records_immutable
  BEFORE UPDATE OR DELETE ON public.order_legal_records
  FOR EACH ROW EXECUTE FUNCTION public.nrs_prevent_legal_record_update();

COMMIT;
