CREATE UNIQUE INDEX IF NOT EXISTS currency_reference_rates_daily_key
  ON public.currency_reference_rates (base_currency, quote_currency, rate_date);
