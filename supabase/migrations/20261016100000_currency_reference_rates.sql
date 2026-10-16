CREATE TABLE IF NOT EXISTS public.currency_reference_rates (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  base_currency text NOT NULL CHECK (base_currency = 'USD'),
  quote_currency text NOT NULL CHECK (quote_currency = 'TRY'),
  usd_try numeric(20, 10) NOT NULL CHECK (usd_try > 0),
  provider text NOT NULL CHECK (provider = 'ecb-euro-reference'),
  fetched_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS currency_reference_rates_latest_idx
  ON public.currency_reference_rates (base_currency, quote_currency, fetched_at DESC);

ALTER TABLE public.currency_reference_rates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.currency_reference_rates FROM anon, authenticated;
GRANT ALL ON public.currency_reference_rates TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.currency_reference_rates_id_seq TO service_role;
