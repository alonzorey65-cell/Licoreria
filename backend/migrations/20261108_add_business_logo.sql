ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS logo_url text NOT NULL DEFAULT '';
