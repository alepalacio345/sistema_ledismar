# 📦 Bodega Ledismar — Sistema de Inventario y Ventas

Sistema para una **bodega** con dos tipos de usuario: **master** (administradora)
y **cajero** (vendedora). Está basado en el proyecto `familia-palacio`, reutilizando
su estructura, estilos (CSS) y la lógica de Supabase + tasas BCV.

## 🔑 Credenciales

| Rol      | Usuario     | Clave            |
|----------|-------------|------------------|
| Master   | `Master01`  | `ledismar141315$` |

Las cajeras las crea la master desde el módulo **Cajeras** (nombre + usuario + clave).

> La master puede cambiar su propia clave desde **Mi Cuenta**.

## 🧩 Módulos

**Master (administradora):**
- 📦 **Inventario**: registrar / editar / eliminar productos con **categoría** y
  **unidad** (unidad, kilo, gramo, litro, mililitro, caja, paquete).
- 🏪 **Mi Negocio**: RIF, dirección, ciudad, teléfono, correo, propietario y notas.
- 🧾 **Ventas**: ver todas las ventas de las cajeras, filtrar por día, rango,
  cajera, producto y monto. Incluye **más vendido de la semana y del año** y el
  total de dinero de las ventas (USD y Bs).
- 💰 **Caja**: dinero real. Ingresos **automáticos** por cada venta + ingresos
  manuales (ventas manuales) + gastos. Saldo = ingresos − gastos.
- 👥 **Cajeras**: crear / cambiar clave / activar-desactivar / eliminar vendedoras.
- 🕒 **Accesos**: historial de entradas y salidas al sistema.
- 🔐 **Mi Cuenta**: cambiar la propia clave.

**Cajera (vendedora):**
- 📦 **Productos**: solo lectura, con búsqueda por nombre, **precio** y **categoría**.
  **No** puede editar existencias ni precios.
- 🛒 **Registrar Venta**: arma un carrito, pone cédula (opcional) y cobra con
  **métodos de pago divididos**:
  - 💵 Efectivo (Bolívares): billetes, cuánto dio y el cambio.
  - 💵 Efectivo (Dólares): serial del billete, billetes, recibido y cambio.
  - 💳 Punto de venta / tarjeta: N° de aprobación/referencia y monto en Bs.
  - 📱 Pago Móvil: últimos 4–6 dígitos, banco, cédula (opcional) y monto.
  - 🇺🇸 Zelle: correo o teléfono de la cuenta y monto.
  - Se puede pagar en **partes** (ej. efectivo + tarjeta, zelle + bolívares...).
- 🧾 **Mis Ventas**: su historial y generar el **recibo PDF** de cualquier venta
  (pide nombre, cédula y dirección).

## 🔗 Conexión con la caja

A diferencia de `familia-palacio` (donde la caja era manual), aquí **cada venta
pagada crea un ingreso automático en la caja** con origen `venta`. Si la master
elimina una venta, se devuelve el stock y se quita ese ingreso de la caja.

## 🛠️ Cómo instalar

1. Este repositorio **reutiliza el mismo proyecto Supabase** de `familia-palacio`
   (credenciales en `js/config.js`), pero con tablas **nuevas** de prefijo `lm_`
   para no chocar. Si quieres otro proyecto, cambia `js/config.js`.
2. Ejecuta **una sola vez** el script `sql/schema.sql` en Supabase
   (**SQL Editor → New query → pegar → Run**). Crea el usuario `Master01` y todas
   las tablas.
3. Abre `index.html` en el navegador (o con tu servidor actual) e inicia sesión.

> ⚠️ Si no ejecutas `schema.sql`, el login fallará porque las tablas no existen.
> El script ya **desactiva RLS** en las tablas nuevas.

## 📁 Estructura

| Archivo          | Qué hace                                            |
|------------------|-----------------------------------------------------|
| `index.html`     | Pantallas y paneles                                 |
| `styles.css`     | Estilos (reutilizados de familia-palacio)           |
| `js/config.js`   | Conexión a Supabase                                 |
| `js/state.js`    | Estado global en memoria                            |
| `js/tasas.js`    | Tasas de cambio (BCV + cruces) y conversión         |
| `js/auth.js`     | Login por rol (master / cajero)                     |
| `js/sesion.js`   | Roles, sidebar y registro de sesiones               |
| `js/ui.js`       | Renderizado de tablas y totales                     |
| `js/inventario.js` | Productos (categoría + unidad)                    |
| `js/ventas.js`   | Ventas + pagos divididos + caja automática          |
| `js/caja.js`     | Dinero / caja (ingresos y gastos)                   |
| `js/cajeros.js`  | Gestión de cajeras                                  |
| `js/empresa.js`  | Datos del negocio + cambio de clave                 |
| `js/pdf.js`      | Recibos de venta en PDF                             |
| `sql/schema.sql` | Migración de base de datos (ejecutar una vez)       |

## 💡 Mejoras sugeridas (para después)

- Alertas de **stock bajo** (mínimo por producto).
- **Compras a proveedores** (entrada de mercancía).
- **Devoluciones / notas de crédito**.
- **Historial de precios** y margen de ganancia.
- **Cierre de caja por turno/día**.
- **Control de vencimiento** (productos perecederos).
