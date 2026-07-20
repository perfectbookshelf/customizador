ALTER TABLE public.quote_leads
  ADD COLUMN IF NOT EXISTS marketing_opt_in_level text,
  ADD COLUMN IF NOT EXISTS marketing_consent_state text,
  ADD COLUMN IF NOT EXISTS marketing_consent_updated_at timestamptz;