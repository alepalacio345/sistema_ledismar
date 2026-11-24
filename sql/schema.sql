-- ============================================================================
--  SISTEMA DE INVENTARIO Y VENTAS "LEDISMAR" - BODEGA (Supabase)
-- ============================================================================
--  Ejecuta este script UNA SOLA VEZ en el editor SQL de Supabase
--  (Dashboard -> SQL Editor -> New query -> pegar -> Run).
--
--  Que hace este script:
--   1) Crea el usuario MASTER (Master01 / ledismar141315$).
--   2) Crea la tabla de CAJEROS/usuarios (lm_usuarios).
--   3) Crea la tabla de la EMPRESA (lm_empresa): rif, direccion, correo, etc.
--   4) Crea PRODUCTOS con CATEGORIA y UNIDAD (unidad, kilo, gramo, litro...).
--   5) Crea VENTAS (lo que vende la cajera) y PAGOS (uno o varios metodos).
--   6) Crea CAJA (ingresos automaticos de ventas + gastos + ventas manuales).
--   7) Crea SESIONES (registro de entradas/salidas de cada usuario).
--
--  IMPORTANTE:
--   * Los precios se guardan SIEMPRE en DOLARES (USD). Los bolivares se
--     calculan al mostrar con la tasa BCV del momento.
--   * Las tablas usan el prefijo "lm_" para no chocar con el sistema
--     anterior (familia-palacio). Ambos pueden convivir en el mismo proyecto.
-- ============================================================================


-- ============================================================================
-- 1) USUARIOS (master + cajeros)
--    rol: 'master' -> administradora (acceso total).
--         'cajero' -> vendedora (solo ver productos y registrar ventas).
-- ============================================================================
CREATE TABLE IF NOT EXISTS lm_usuarios (
    usuario   text PRIMARY KEY,          -- Nombre de usuario (unico)
    clave     text NOT NULL,             -- Clave de acceso
    rol       text DEFAULT 'cajero',     -- 'master' | 'cajero'
    nombre    text DEFAULT '',           -- Nombre real de la persona
    activo    boolean DEFAULT true,      -- Si puede entrar o no
    creado_en timestamptz DEFAULT now()
);

-- Creamos el usuario MASTER (administradora).
INSERT INTO lm_usuarios (usuario, clave, rol, nombre)
VALUES ('Master01', 'ledismar141315$', 'master', 'Administradora')
ON CONFLICT (usuario)
DO UPDATE SET rol = 'master', nombre = 'Administradora';


-- ============================================================================
-- 2) EMPRESA (informacion del negocio) - una sola fila (id = 1)
--    La administradora la edita desde el modulo "Mi Negocio".
-- ============================================================================
CREATE TABLE IF NOT EXISTS lm_empresa (
    id           int PRIMARY KEY DEFAULT 1,
    nombre       text DEFAULT 'Bodega Ledismar',
    rif          text DEFAULT '',
    direccion    text DEFAULT '',
    ciudad       text DEFAULT '',
    telefono     text DEFAULT '',
    correo       text DEFAULT '',
    propietario  text DEFAULT '',
    notas        text DEFAULT '',
    actualizado_en timestamptz DEFAULT now()
);

INSERT INTO lm_empresa (id, nombre)
VALUES (1, 'Bodega Ledismar')
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 3) PRODUCTOS (inventario)
--    * categoria: texto libre (Alimentos, Bebidas, Limpieza, Aseo, Otros...).
--    * unidad:    'unidad' | 'kilo' | 'gramo' | 'litro' | 'mililitro'
--                 | 'caja' | 'paquete'.
--    * precio:    en USD (base). Los bolivares se calculan con la tasa BCV.
--    * stock_min: minimo para futuras alertas de stock bajo (por ahora 0).
-- ============================================================================
CREATE TABLE IF NOT EXISTS lm_productos (
    id        text PRIMARY KEY,          -- Codigo del producto (Ej. P#01)
    name      text NOT NULL,             -- Nombre
    categoria text DEFAULT 'Otros',      -- Categoria
    unidad    text DEFAULT 'unidad',     -- Unidad de medida
    cantidad  numeric DEFAULT 0,         -- Existencia
    precio    numeric DEFAULT 0,         -- Precio unitario en USD
    stock_min numeric DEFAULT 0,         -- Minimo (alertas futuras)
    creado_en timestamptz DEFAULT now()
);


-- ============================================================================
-- 4) VENTAS (lo que registra la cajera/vendedora)
--    * detalle: texto resumido de productos vendidos.
--    * total_usd / total_bs: totales (USD base + equivalente en bolivares).
--    * recibo_*: datos completos del comprador SI se genera recibo formal.
-- ============================================================================
CREATE TABLE IF NOT EXISTS lm_ventas (
    id            text PRIMARY KEY,      -- Ej: V-0001
    fecha         text,                  -- Fecha y hora de la venta
    cajero        text,                  -- Usuario de la cajera que vendio
    cliente       text,                  -- Nombre del comprador (opcional)
    cedula        text,                  -- Cedula (opcional)
    detalle       text,                  -- Productos vendidos (texto resumido)
    total_usd     numeric DEFAULT 0,     -- Total en dolares (base)
    total_bs      numeric DEFAULT 0,     -- Equivalente en bolivares
    tasa          numeric DEFAULT 0,     -- Tasa BCV usada
    recibo        boolean DEFAULT false, -- TRUE si ya se genero recibo formal
    recibo_nombre text DEFAULT '',       -- Nombre para el recibo formal
    recibo_cedula text DEFAULT '',       -- Cedula para el recibo formal
    recibo_direccion text DEFAULT '',    -- Direccion para el recibo formal
    creado_en     timestamptz DEFAULT now()
);


-- ============================================================================
-- 5) PAGOS (uno o varios por cada venta -> pagos divididos)
--    Una venta puede pagarse en partes: efectivo + tarjeta, zelle + Bs, etc.
--    * metodo:  'efectivo_bs' | 'efectivo_usd' | 'punto' | 'pago_movil' | 'zelle'
--    * moneda:  'VES' (bolivares) o 'USD' (dolares), segun el metodo.
--    * monto:   monto en esa moneda. monto_usd: convertido a dolares.
--    * datos:   JSON con los campos propios de cada metodo (billetes, serial,
--               referencia, banco, numero de aprobacion, correo zelle, etc.).
-- ============================================================================
CREATE TABLE IF NOT EXISTS lm_pagos (
    id        bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    venta_id  text,                      -- Venta a la que pertenece
    metodo    text,                      -- Metodo de pago
    moneda    text DEFAULT 'VES',        -- Moneda del pago
    monto     numeric DEFAULT 0,         -- Monto en esa moneda
    monto_usd numeric DEFAULT 0,         -- Monto convertido a dolares
    datos     text DEFAULT '{}',         -- JSON con detalles del metodo
    creado_en timestamptz DEFAULT now()
);


-- ============================================================================
-- 6) CAJA (dinero del negocio)
--    * tipo:   'ingreso' (entra) | 'gasto' (sale).
--    * origen: 'venta' (automatico de una venta) | 'manual' (registrado a mano).
--    * Cuando la cajera registra una venta PAGADA, aqui se crea un ingreso
--      automatico con origen 'venta' y el id de la venta (venta_id).
--    * ventas manuales: ingresos manuales de ventas hechas fuera del sistema.
-- ============================================================================
CREATE TABLE IF NOT EXISTS lm_caja (
    id        bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    tipo      text NOT NULL,             -- 'ingreso' | 'gasto'
    origen    text DEFAULT 'manual',     -- 'venta' | 'manual'
    venta_id  text,                      -- Id de la venta (si origen = venta)
    nombre    text,                      -- A quien / de que es
    motivo    text,                      -- Razon
    moneda    text DEFAULT 'USD',        -- Moneda en la que se registro
    monto     numeric DEFAULT 0,         -- Monto en esa moneda
    monto_usd numeric DEFAULT 0,         -- Monto en dolares (base)
    monto_bs  numeric DEFAULT 0,         -- Equivalente en bolivares
    tasa      numeric DEFAULT 0,         -- Tasa usada
    fecha     text,                      -- Fecha/hora
    usuario   text,                      -- Quien lo registro
    creado_en timestamptz DEFAULT now()
);


-- ============================================================================
-- 7) SESIONES (registro de entradas/salidas al sistema)
-- ============================================================================
CREATE TABLE IF NOT EXISTS lm_sesiones (
    id            bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    usuario       text,                  -- Usuario que entro
    rol           text,                  -- Rol al momento de entrar
    fecha_entrada text,                  -- Hora de entrada
    fecha_salida  text,                  -- Hora de salida (null mientras siga)
    notas         text
);


-- ============================================================================
-- 8) DESACTIVAR RLS en las tablas nuevas
--    La app usa la llave ANONIMA de Supabase (no hace login real en la BD).
--    Si una tabla queda con RLS activado, los INSERT/UPDATE dan error:
--        "new row violates row-level security policy for table ..."
-- ============================================================================
ALTER TABLE IF EXISTS lm_usuarios  DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS lm_empresa   DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS lm_productos DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS lm_ventas    DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS lm_pagos     DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS lm_caja      DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS lm_sesiones  DISABLE ROW LEVEL SECURITY;
