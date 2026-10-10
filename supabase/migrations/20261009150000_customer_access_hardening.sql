-- LOCAL REVIEW ONLY. Snapshot live policies/ACLs and verify migration history
-- before authorized staging/production application. No customer data changes.
-- Apply after 20261009140000. Reentrant final ACL/RLS reconciliation for all
-- four customer tables; retains the latest payment/admin race-safe RPC bodies.
BEGIN;
DO $$
DECLARE r record; t text; cols text;
BEGIN
  IF NOT EXISTS (SELECT FROM pg_proc WHERE oid=to_regprocedure('public.nrs_is_active_admin()')
    AND prosecdef AND prorettype='boolean'::regtype) THEN
    RAISE EXCEPTION 'Review existing active-admin predicate first';
  END IF;
  IF to_regprocedure('public.nrs_admin_update_order_status(uuid,text)') IS NULL
    OR to_regprocedure('public.nrs_finalize_payment(jsonb,text)') IS NULL THEN
    RAISE EXCEPTION 'Apply preceding order/payment hardening first';
  END IF;
  FOR r IN SELECT * FROM (VALUES ('profiles','id','uuid'),('wishlist','user_id','uuid'),
    ('wishlist','product_id','text'),('orders','id','uuid'),('orders','user_id','uuid'),
    ('order_items','order_id','uuid')) required(t,c,typ) LOOP
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public'
      AND table_name=r.t AND column_name=r.c AND udt_name=r.typ AND domain_name IS NULL) THEN
      RAISE EXCEPTION 'Customer schema mismatch: %.%',r.t,r.c;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public'
    AND table_name='wishlist' AND column_name='id') THEN
    RAISE EXCEPTION 'Expected existing wishlist.id';
  END IF;
  FOR r IN SELECT * FROM (VALUES ('first_name'),('last_name'),('phone'),('email')) required(c) LOOP
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public'
      AND table_name='profiles' AND column_name=r.c AND data_type IN ('text','character varying')
      AND domain_name IS NULL) THEN RAISE EXCEPTION 'Review profile field %',r.c; END IF;
  END LOOP;
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='public.profiles'::regclass AND contype='p'
    AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='public.profiles'::regclass AND attname='id')]) THEN
    RAISE EXCEPTION 'Expected profiles.id primary key for existing signup upsert';
  END IF;
  -- Do not invent defaults, change IDs, or repair existing legacy rows.
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public'
    AND table_name IN ('profiles','wishlist') AND is_nullable='NO' AND column_default IS NULL
    AND is_identity='NO' AND is_generated='NEVER' AND NOT (
      (table_name='profiles' AND column_name IN ('id','first_name','last_name','phone','email')) OR
      (table_name='wishlist' AND column_name IN ('user_id','product_id')))) THEN
    RAISE EXCEPTION 'Required customer column without default: review existing insert compatibility';
  END IF;
  FOREACH t IN ARRAY ARRAY['profiles','wishlist','orders','order_items'] LOOP
    -- Permissive policies OR together: remove old public ALL/true policies too.
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      RAISE NOTICE 'Replacing policy %.%',t,r.policyname;
      EXECUTE format('DROP POLICY %I ON public.%I',r.policyname,t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
    SELECT string_agg(quote_ident(attname),',') INTO cols FROM pg_attribute
      WHERE attrelid=format('public.%I',t)::regclass AND attnum>0 AND NOT attisdropped;
    EXECUTE format('REVOKE SELECT (%s), INSERT (%s), UPDATE (%s), REFERENCES (%s) ON public.%I FROM PUBLIC,anon,authenticated',cols,cols,cols,cols,t);
  END LOOP;
  -- Serial wishlist IDs, when present, need USAGE for the existing insert.
  -- No arbitrary sequence grant, no sequence UPDATE, no ID/schema conversion.
  t:=pg_get_serial_sequence('public.wishlist','id');
  IF t IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC,anon,authenticated',t);
    EXECUTE format('GRANT USAGE ON SEQUENCE %s TO authenticated',t);
  END IF;
END $$;
GRANT SELECT ON public.profiles,public.wishlist TO authenticated;
GRANT SELECT ON public.orders,public.order_items TO authenticated;
GRANT INSERT (id,first_name,last_name,phone,email) ON public.profiles TO authenticated;
GRANT UPDATE (first_name,last_name,phone) ON public.profiles TO authenticated;
GRANT INSERT (user_id,product_id) ON public.wishlist TO authenticated;
GRANT DELETE ON public.wishlist TO authenticated;
CREATE POLICY nrs_customer_profile_read ON public.profiles FOR SELECT TO authenticated
  USING (id=(SELECT auth.uid()));
CREATE POLICY nrs_customer_profile_insert ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id=(SELECT auth.uid()));
CREATE POLICY nrs_customer_profile_update ON public.profiles FOR UPDATE TO authenticated
  USING (id=(SELECT auth.uid())) WITH CHECK (id=(SELECT auth.uid()));
CREATE POLICY nrs_active_admin_profile_read ON public.profiles FOR SELECT TO authenticated
  USING ((SELECT public.nrs_is_active_admin()));
CREATE POLICY nrs_customer_wishlist_read ON public.wishlist FOR SELECT TO authenticated
  USING (user_id=(SELECT auth.uid()));
CREATE POLICY nrs_customer_wishlist_insert ON public.wishlist FOR INSERT TO authenticated
  WITH CHECK (user_id=(SELECT auth.uid()));
CREATE POLICY nrs_customer_wishlist_delete ON public.wishlist FOR DELETE TO authenticated
  USING (user_id=(SELECT auth.uid()));
CREATE POLICY nrs_active_admin_wishlist_read ON public.wishlist FOR SELECT TO authenticated
  USING ((SELECT public.nrs_is_active_admin()));
CREATE POLICY nrs_customer_order_read ON public.orders FOR SELECT TO authenticated
  USING (user_id=(SELECT auth.uid()));
CREATE POLICY nrs_active_admin_order_read ON public.orders FOR SELECT TO authenticated
  USING ((SELECT public.nrs_is_active_admin()));
CREATE POLICY nrs_customer_order_item_read ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id=order_id AND o.user_id=(SELECT auth.uid())));
CREATE POLICY nrs_active_admin_order_item_read ON public.order_items FOR SELECT TO authenticated
  USING ((SELECT public.nrs_is_active_admin()));
COMMIT;
