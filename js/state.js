// ============================================================================
//  state.js - ESTADO GLOBAL DE LA APLICACION
// ============================================================================
//  Guarda TODA la informacion en memoria de la sesion actual.
//  Los datos se traen de Supabase al iniciar sesion y se actualizan despues
//  de cada operacion.
//
//  IMPORTANTE: los precios SIEMPRE estan en DOLARES (USD). Los bolivares se
//  calculan al mostrar usando la tasa de `state.tasas`.
// ============================================================================

export const state = {
    // --- Productos del inventario ---
    //     [{ id, name, categoria, unidad, cantidad, precio }]  (precio en USD)
    inventario: [],

    // --- Carrito de la venta en curso (la cajera) ---
    //     [{ id, name, cantidad, precio }]  (precio en USD)
    listaVenta: [],

    // --- Pagos de la venta en curso (uno o varios = pago dividido) ---
    //     [{ metodo, moneda, monto, monto_usd, datos:{...} }]
    pagosEnCurso: [],

    // --- Historial de ventas (lo registra la cajera, lo ve la admin) ---
    ventas: [],

    // --- Pagos cargados de todas las ventas (para mostrar detalles) ---
    pagos: [],

    // --- Cajeros/vendedoras (los gestiona la admin) ---
    cajeros: [],

    // --- Datos de la empresa (una sola fila) ---
    empresa: {
        nombre: "Bodega Ledismar", rif: "", direccion: "", ciudad: "",
        telefono: "", correo: "", propietario: "", notas: "",
    },

    // --- Movimientos de caja (ingresos/gastos) ---
    caja: [],

    // --- Registro de sesiones (entradas/salidas) ---
    sesiones: [],

    // --- Usuario actual ---
    //     { usuario, rol, nombre }   rol: 'master' | 'cajero'
    usuarioActual: null,

    // --- Producto que se esta editando (id o null) ---
    idEditando: null,

    // --- Venta que se esta editando (id o null, no se usa por ahora) ---
    ventaEditandoId: null,

    // --- Moneda activa para MOSTRAR precios ---
    moneda: "USD",

    // --- Tasas de cambio cargadas ---
    tasas: {
        USD: 1, VES: null, EUR: null, INR: null, CNY: null,
        actualizado: null, fuente: null,
    },

    // --- Texto de busqueda del inventario (cajera y admin) ---
    busquedaInventario: "",
    filtroCategoriaInventario: "",

    // --- Filtros del panel de ventas (admin) ---
    filtrosVentas: {
        desde: "", hasta: "", cajero: "", producto: "",
        montoMin: "", montoMax: "", moneda: "USD",
    },
};
