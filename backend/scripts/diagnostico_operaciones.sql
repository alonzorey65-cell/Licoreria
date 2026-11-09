-- Consultas de solo lectura para revisar ventas e inventario antes de modificarlos.
-- No incluyen registros de clientes ni contraseñas.

SELECT
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default
FROM information_schema.columns AS c
WHERE c.table_schema = 'public'
  AND c.table_name IN (
    'licores', 'reservas', 'facturas', 'kardex',
    'compras', 'compra_items', 'lotes_inventario',
    'fidelizacion_clientes', 'fidelizacion_movimientos'
  )
ORDER BY c.table_name, c.ordinal_position;

SELECT
  n.nspname AS esquema,
  c.relname AS tabla,
  t.tgname AS trigger,
  pg_get_triggerdef(t.oid) AS definicion,
  pn.nspname AS esquema_funcion,
  p.proname AS funcion,
  pg_get_functiondef(p.oid) AS definicion_funcion
FROM pg_trigger AS t
JOIN pg_class AS c ON c.oid = t.tgrelid
JOIN pg_namespace AS n ON n.oid = c.relnamespace
JOIN pg_proc AS p ON p.oid = t.tgfoid
JOIN pg_namespace AS pn ON pn.oid = p.pronamespace
WHERE NOT t.tgisinternal
  AND n.nspname = 'public'
  AND c.relname IN (
    'licores', 'reservas', 'facturas', 'kardex',
    'compras', 'compra_items', 'lotes_inventario'
  )
ORDER BY c.relname, t.tgname;

SELECT
  c.relname AS tabla,
  con.conname AS restriccion,
  pg_get_constraintdef(con.oid) AS definicion
FROM pg_constraint AS con
JOIN pg_class AS c ON c.oid = con.conrelid
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'licores', 'reservas', 'facturas', 'kardex',
    'compras', 'compra_items', 'lotes_inventario'
  )
ORDER BY c.relname, con.conname;

SELECT
  p.proname AS funcion,
  pg_get_function_identity_arguments(p.oid) AS argumentos,
  pg_get_functiondef(p.oid) AS definicion
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'recibir_compra', 'registrar_lote_inventario',
    'registrar_factura_con_puntos', 'registrar_movimiento_puntos'
  )
ORDER BY p.proname, argumentos;
