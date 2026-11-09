CREATE TABLE IF NOT EXISTS public.business_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  business_name text NOT NULL DEFAULT 'VIP Bar',
  opening_hours text NOT NULL DEFAULT 'Horario no configurado',
  address text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  map_url text NOT NULL DEFAULT '',
  currency text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'MXN', 'COP', 'PEN', 'EUR')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.business_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;
