ALTER TABLE public.promociones
  ADD COLUMN IF NOT EXISTS precio numeric(12, 2)
    CHECK (precio IS NULL OR precio >= 0);
