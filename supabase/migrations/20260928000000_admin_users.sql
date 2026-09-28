-- Admin access registry. This migration is prepared but must be reviewed and
-- applied manually. It deliberately creates no administrator records.
CREATE TABLE public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin' CHECK (role = 'admin'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Clients may only read their own active admin record. No client write grants
-- or write policies are provided; administrator provisioning is a trusted,
-- manual database operation.
REVOKE ALL PRIVILEGES ON TABLE public.admin_users FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.admin_users TO authenticated;

CREATE POLICY admin_users_read_own_active
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND role = 'admin'
    AND is_active = true
  );
