ALTER TABLE public.promociones
  ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0);

CREATE TABLE IF NOT EXISTS public.reserva_promociones (
  reserva_id bigint NOT NULL REFERENCES public.reservas(id) ON DELETE CASCADE,
  promocion_id bigint NOT NULL REFERENCES public.promociones(id) ON DELETE RESTRICT,
  cantidad integer NOT NULL CHECK (cantidad > 0),
  devuelta boolean NOT NULL DEFAULT false,
  PRIMARY KEY (reserva_id, promocion_id)
);
ALTER TABLE public.reserva_promociones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reserva_promociones FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reservar_stock_promociones()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  item record;
  promo public.promociones%ROWTYPE;
BEGIN
  FOR item IN
    SELECT (v->>'id')::bigint AS id, SUM((v->>'qty')::integer)::integer AS cantidad,
           MIN((v->>'price')::numeric) AS precio_min, MAX((v->>'price')::numeric) AS precio_max
    FROM jsonb_array_elements(NEW.items::jsonb) v
    WHERE v->>'type' = 'promotion'
    GROUP BY (v->>'id')::bigint ORDER BY id
  LOOP
    SELECT * INTO promo FROM public.promociones WHERE id = item.id FOR UPDATE;
    IF NOT FOUND OR promo.activa IS NOT TRUE OR promo.precio IS NULL
      OR promo.stock < item.cantidad OR item.cantidad <= 0
      OR promo.precio <> item.precio_min OR promo.precio <> item.precio_max
      OR NEW.currency <> 'PEN'
      OR (promo.vigente_hasta IS NOT NULL AND promo.vigente_hasta < (now() AT TIME ZONE 'America/Lima')::date)
    THEN
      RAISE EXCEPTION 'La promoción cambió, venció o no tiene stock suficiente. Actualiza el carrito.'
        USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.promociones SET stock = stock - item.cantidad WHERE id = item.id;
    INSERT INTO public.reserva_promociones(reserva_id, promocion_id, cantidad)
      VALUES (NEW.id, item.id, item.cantidad);
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.liberar_stock_promociones()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  item record;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'Cancelado' AND NEW.status <> 'Cancelado'
      AND EXISTS (SELECT 1 FROM public.reserva_promociones WHERE reserva_id = OLD.id) THEN
      RAISE EXCEPTION 'Un pedido con promociones cancelado no se puede reactivar; crea un nuevo pedido.' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.items::jsonb IS DISTINCT FROM OLD.items::jsonb
      AND (EXISTS (SELECT 1 FROM public.reserva_promociones WHERE reserva_id = OLD.id)
        OR (jsonb_typeof(NEW.items::jsonb) = 'array'
          AND jsonb_path_exists(NEW.items::jsonb, '$[*] ? (@.type == "promotion")'))) THEN
      RAISE EXCEPTION 'No se pueden editar productos de un pedido con promociones. Cancélalo y crea uno nuevo.' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.status <> 'Cancelado' OR OLD.status = 'Cancelado' THEN RETURN NEW; END IF;
  ELSIF OLD.status NOT IN ('Recibido', 'Cancelado')
    AND EXISTS (SELECT 1 FROM public.reserva_promociones WHERE reserva_id = OLD.id) THEN
    RAISE EXCEPTION 'No se puede eliminar un pedido con promociones en preparación o entregado.' USING ERRCODE = 'P0001';
  END IF;
  FOR item IN SELECT promocion_id, cantidad FROM public.reserva_promociones
    WHERE reserva_id = OLD.id AND NOT devuelta ORDER BY promocion_id FOR UPDATE
  LOOP
    UPDATE public.promociones SET stock = stock + item.cantidad WHERE id = item.promocion_id;
    UPDATE public.reserva_promociones SET devuelta = true
      WHERE reserva_id = OLD.id AND promocion_id = item.promocion_id;
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reservas_reservar_promociones ON public.reservas;
CREATE TRIGGER reservas_reservar_promociones AFTER INSERT ON public.reservas
FOR EACH ROW EXECUTE FUNCTION public.reservar_stock_promociones();
DROP TRIGGER IF EXISTS reservas_liberar_promociones ON public.reservas;
CREATE TRIGGER reservas_liberar_promociones BEFORE UPDATE OR DELETE ON public.reservas
FOR EACH ROW EXECUTE FUNCTION public.liberar_stock_promociones();
