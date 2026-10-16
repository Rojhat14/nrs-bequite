ALTER TABLE public.currency_reference_rates
  ADD COLUMN IF NOT EXISTS rate_date date;

UPDATE public.currency_reference_rates
SET rate_date = (fetched_at AT TIME ZONE 'UTC')::date
WHERE rate_date IS NULL;

ALTER TABLE public.currency_reference_rates
  ALTER COLUMN rate_date SET NOT NULL;

CREATE INDEX IF NOT EXISTS currency_reference_rates_source_date_idx
  ON public.currency_reference_rates (base_currency, quote_currency, rate_date DESC, fetched_at DESC);
