// ============================================================================
//  ventas.js - VENTAS DE LA CAJERA + PAGOS DIVIDIDOS + HISTORIAL
// ============================================================================
//  La cajera arma un carrito de productos y registra la venta. Puede cobrar
//  con VARIOS metodos a la vez (pago dividido): efectivo Bs, efectivo $,
//  punto/tarjeta, pago movil y zelle.
//
//  Al registrar una venta PAGADA:
//   1) Se descuenta el stock del inventario.
//   2) Se guarda la venta y sus pagos.
//   3) Se crea un INGRESO AUTOMATICO en la caja (origen = 'venta').
//   4) Se puede generar el recibo PDF (opcional).
//
//  La ADMINISTRADORA ve TODAS las ventas con filtros y estadisticas.
// ============================================================================

import { db } from "./config.js";
import { state } from "./state.js";
import { cargarInventario } from "./inventario.js";
import { cargarCaja } from "./caja.js";
import { convertirDesdeUsd, convertirAUsd, obtenerTasa, formatearMonto } from "./tasas.js";
import {
    mostrarAlerta, renderizarTodo, renderizarListaVenta, renderizarSelectProductos,
    renderizarPagosEnCurso, mostrarModal, escaparHtml, obtenerMetodo, METODOS_PAGO,
    parsearItemsDesdeDetalle,
} from "./ui.js";
import { generarReciboVentaPDF } from "./pdf.js";
import { esMaster } from "./sesion.js";

// ----------------------------------------------------------------------------
// cargarVentas() / cargarPagos()
// ----------------------------------------------------------------------------
export async function cargarVentas() {
    const { data, error } = await db
        .from("lm_ventas")
        .select("id, fecha, cajero, cliente, cedula, detalle, total_usd, total_bs, tasa, recibo, recibo_nombre, recibo_cedula, recibo_direccion")
        .order("creado_en", { ascending: false });

    if (error) {
        mostrarAlerta(`Error cargando ventas: ${error.message}`, "err");
        return false;
    }

    state.ventas = (data || []).map(v => ({
        ...v,
        total_usd: Number(v.total_usd || 0),
        total_bs: Number(v.total_bs || 0),
    }));
    return true;
}

export async function cargarPagos() {
    const { data, error } = await db
        .from("lm_pagos")
        .select("id, venta_id, metodo, moneda, monto, monto_usd, datos")
        .order("id", { ascending: true });

    if (error) {
        console.warn("Error cargando pagos:", error.message);
        return false;
    }

    state.pagos = (data || []).map(p => ({
        ...p,
        monto: Number(p.monto || 0),
        monto_usd: Number(p.monto_usd || 0),
        datos: parsearJson(p.datos),
    }));
    return true;
}

function parsearJson(texto) {
    try {
        const obj = JSON.parse(texto || "{}");
        return (obj && typeof obj === "object") ? obj : {};
    } catch {
        return {};
    }
}

// ----------------------------------------------------------------------------
// Utilidades
// ----------------------------------------------------------------------------
function obtenerSiguienteIdVenta() {
    let maxNum = 0;
    state.ventas.forEach(v => {
        const m = String(v.id).match(/^V-(\d+)$/);
        if (m) {
            const n = parseInt(m[1], 10);
            if (n > maxNum) maxNum = n;
        }
    });
    return `V-${String(maxNum + 1).padStart(4, "0")}`;
}

function obtenerFechaFormateada() {
    const d = new Date();
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function totalCarritoUsd() {
    return state.listaVenta.reduce((a, i) => a + i.cantidad * i.precio, 0);
}
function totalPagadoUsd() {
    return state.pagosEnCurso.reduce((a, p) => a + p.monto_usd, 0);
}
function restanteUsd() {
    return totalCarritoUsd() - totalPagadoUsd();
}

// ----------------------------------------------------------------------------
// Campos dinamicos segun el metodo de pago elegido
// ----------------------------------------------------------------------------
function monedaMetodoSeleccionado() {
    const metodo = document.getElementById("pago-metodo").value;
    return obtenerMetodo(metodo).moneda;
}

function renderizarCamposPago() {
    const metodo = document.getElementById("pago-metodo").value;
    const contenedor = document.getElementById("pago-extra");
    const info = document.getElementById("pago-info");
    const moneda = obtenerMetodo(metodo).moneda;

    // Actualizamos la etiqueta del campo monto.
    const labelMonto = document.getElementById("label-pago-monto");
    if (labelMonto) labelMonto.textContent = `Monto (${moneda === "VES" ? "Bolívares" : "Dólares"})`;

    // Informacion del saldo restante.
    const restante = restanteUsd();
    if (info) {
        info.innerHTML = `Total a cobrar: <strong>${escaparHtml(formatearMonto(totalCarritoUsd(), "USD"))}</strong>` +
            ` · Pagado: <strong>${escaparHtml(formatearMonto(totalPagadoUsd(), "USD"))}</strong>` +
            ` · Resta: <strong>${escaparHtml(formatearMonto(restante, "USD"))}</strong>` +
            ` <span class="sub-dato">(≈ ${escaparHtml(formatearMonto(convertirDesdeUsd(restante, moneda), moneda))} en este método)</span>`;
    }

    // Campos extra por metodo.
    const campos = {
        efectivo_bs: `
            <div class="form-group"><label for="pago-billetes">Billetes recibidos (ej. 2x100 + 1x50)</label>
                <input type="text" id="pago-billetes" placeholder="Describe los billetes"></div>
            <div class="form-group"><label for="pago-recibido">¿Cuánto dio el cliente? (Bs)</label>
                <input type="number" id="pago-recibido" step="0.01" min="0" placeholder="Monto recibido"></div>`,
        efectivo_usd: `
            <div class="form-group"><label for="pago-serial">Serial del billete (dólar)</label>
                <input type="text" id="pago-serial" placeholder="Serial del billete"></div>
            <div class="form-group"><label for="pago-billetes">Billetes recibidos (ej. 1x$20 + 1x$10)</label>
                <input type="text" id="pago-billetes" placeholder="Describe los billetes"></div>
            <div class="form-group"><label for="pago-recibido">¿Cuánto dio el cliente? (USD)</label>
                <input type="number" id="pago-recibido" step="0.01" min="0" placeholder="Monto recibido"></div>`,
        punto: `
            <div class="form-group"><label for="pago-referencia">N° de aprobación / referencia (del papel)</label>
                <input type="text" id="pago-referencia" placeholder="N° de aprobación"></div>`,
        pago_movil: `
            <div class="form-group"><label for="pago-referencia">Últimos 4-6 dígitos del pago</label>
                <input type="text" id="pago-referencia" maxlength="6" placeholder="Ej. 1234 o 482913"></div>
            <div class="form-group"><label for="pago-banco">Banco</label>
                <input type="text" id="pago-banco" placeholder="Ej. Banesco"></div>
            <div class="form-group"><label for="pago-cedula-pagador">Cédula de quien paga (opcional)</label>
                <input type="text" id="pago-cedula-pagador" placeholder="Ej. V-12345678"></div>`,
        zelle: `
            <div class="form-group"><label for="pago-cuenta">Correo o teléfono de la cuenta Zelle</label>
                <input type="text" id="pago-cuenta" placeholder="correo@ejemplo.com o 0412-0000000"></div>`,
    };

    contenedor.innerHTML = campos[metodo] || "";
}

// ----------------------------------------------------------------------------
// inicializarVentas()
// ----------------------------------------------------------------------------
export function inicializarVentas() {
    // Llenar el select de metodos de pago.
    const selMetodo = document.getElementById("pago-metodo");
    if (selMetodo) {
        selMetodo.innerHTML = METODOS_PAGO.map(m =>
            `<option value="${m.codigo}">${m.nombre}</option>`
        ).join("");
        selMetodo.addEventListener("change", renderizarCamposPago);
        renderizarCamposPago();
    }

    // --- Agregar producto al carrito ---
    document.getElementById("form-vta").addEventListener("submit", (e) => {
        e.preventDefault();
        const id = document.getElementById("vta-producto").value;
        const cantidad = parseFloat(document.getElementById("vta-cantidad").value);

        const prod = state.inventario.find(p => p.id === id);
        if (!prod) return mostrarAlerta("Selecciona un producto con stock.", "err");

        const existente = state.listaVenta.find(i => i.id === id);
        const yaEnCarrito = existente ? existente.cantidad : 0;
        const disponible = prod.cantidad - yaEnCarrito;

        if (isNaN(cantidad) || cantidad <= 0 || cantidad > disponible) {
            return mostrarAlerta(`Cantidad invalida. Disponible de ${prod.name}: ${disponible.toFixed(2)}.`, "err");
        }

        if (existente) existente.cantidad = Number((existente.cantidad + cantidad).toFixed(2));
        else state.listaVenta.push({ id: prod.id, name: prod.name, cantidad, precio: prod.precio });

        document.getElementById("vta-cantidad").value = "";
        renderizarListaVenta();
        renderizarSelectProductos();
        renderizarPagosEnCurso();
        renderizarCamposPago();
    });

    // --- Quitar producto del carrito ---
    document.getElementById("tbody-vta-cart").addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-action='del-vta']");
        if (!btn) return;
        state.listaVenta = state.listaVenta.filter(i => i.id !== btn.dataset.id);
        renderizarListaVenta();
        renderizarSelectProductos();
        renderizarPagosEnCurso();
        renderizarCamposPago();
    });

    // --- Agregar pago ---
    document.getElementById("btn-agregar-pago").addEventListener("click", () => {
        agregarPago();
    });

    // --- Usar saldo restante ---
    document.getElementById("btn-usar-saldo").addEventListener("click", () => {
        const moneda = monedaMetodoSeleccionado();
        const restante = convertirDesdeUsd(restanteUsd(), moneda);
        if (restante <= 0) return mostrarAlerta("Ya no queda saldo por cobrar.", "err");
        document.getElementById("pago-monto").value = Number(restante.toFixed(2));
    });

    // --- Quitar pago ---
    document.getElementById("tbody-vta-pagos").addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-action='del-pago']");
        if (!btn) return;
        state.pagosEnCurso.splice(Number(btn.dataset.index), 1);
        renderizarPagosEnCurso();
        renderizarCamposPago();
    });

    // --- Registrar venta ---
    document.getElementById("btn-registrar-venta").addEventListener("click", registrarVenta);

    // --- Cancelar (limpiar) venta ---
    document.getElementById("btn-cancelar-venta").addEventListener("click", limpiarFormularioVenta);

    // --- Acciones del panel "Mis Ventas" (cajera) ---
    document.getElementById("tbody-mis-ventas").addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-action]");
        if (!btn) return;
        if (btn.dataset.action === "pdf-mi-vta") abrirModalRecibo(btn.dataset.id);
    });

    // --- Acciones del panel "Ventas" (admin) ---
    document.getElementById("tbody-ventas").addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-action]");
        if (!btn) return;
        if (btn.dataset.action === "pdf-vta") {
            const v = state.ventas.find(x => x.id === btn.dataset.id);
            if (v) generarReciboVentaPDF(v, null, state.pagos.filter(p => p.venta_id === v.id));
        } else if (btn.dataset.action === "del-vta-admin") {
            eliminarVentaAdmin(btn.dataset.id);
        }
    });

    // --- Filtros de ventas (admin) ---
    document.getElementById("btn-filtrar-v").addEventListener("click", () => {
        state.filtrosVentas = {
            desde: document.getElementById("filtro-v-desde").value,
            hasta: document.getElementById("filtro-v-hasta").value,
            cajero: document.getElementById("filtro-v-cajero").value,
            producto: document.getElementById("filtro-v-producto").value.trim(),
            montoMin: document.getElementById("filtro-v-monto-min").value,
            montoMax: document.getElementById("filtro-v-monto-max").value,
            moneda: "USD",
        };
        renderizarTodo();
    });
    document.getElementById("btn-limpiar-v").addEventListener("click", () => {
        state.filtrosVentas = { desde: "", hasta: "", cajero: "", producto: "", montoMin: "", montoMax: "", moneda: "USD" };
        ["filtro-v-desde", "filtro-v-hasta", "filtro-v-cajero", "filtro-v-producto", "filtro-v-monto-min", "filtro-v-monto-max"]
            .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
        renderizarTodo();
    });
}

// ----------------------------------------------------------------------------
// agregarPago(): valida y agrega un pago al carrito de pagos
// ----------------------------------------------------------------------------
function agregarPago() {
    if (state.listaVenta.length === 0) {
        return mostrarAlerta("Agrega productos al carrito antes de registrar pagos.", "err");
    }

    const metodo = document.getElementById("pago-metodo").value;
    const moneda = obtenerMetodo(metodo).moneda;
    const monto = parseFloat(document.getElementById("pago-monto").value);

    if (isNaN(monto) || monto <= 0) {
        return mostrarAlerta("Escribe un monto valido para este pago.", "err");
    }

    const montoUsd = convertirAUsd(monto, moneda);
    const restante = restanteUsd();

    if (montoUsd > restante + 0.01) {
        return mostrarAlerta(`El monto supera lo que falta por cobrar (${formatearMonto(restante, "USD")}).`, "err");
    }

    // Datos propios de cada metodo.
    const datos = {};
    const leer = id => {
        const el = document.getElementById(id);
        return el ? el.value.trim() : "";
    };
    const leerNum = id => {
        const el = document.getElementById(id);
        const v = el ? parseFloat(el.value) : NaN;
        return isNaN(v) ? null : v;
    };

    if (metodo === "efectivo_bs" || metodo === "efectivo_usd") {
        datos.billetes = leer("pago-billetes");
        const recibido = leerNum("pago-recibido");
        if (recibido !== null && recibido < monto) {
            return mostrarAlerta("Lo recibido no puede ser menor que el monto a cobrar.", "err");
        }
        datos.recibido = recibido !== null ? recibido : monto;
        datos.vuelto = Number((datos.recibido - monto).toFixed(2));
        if (metodo === "efectivo_usd") {
            datos.serial = leer("pago-serial");
        }
    } else if (metodo === "punto") {
        datos.referencia = leer("pago-referencia");
        if (!datos.referencia) return mostrarAlerta("Escribe el N° de aprobación/referencia del punto.", "err");
    } else if (metodo === "pago_movil") {
        datos.referencia = leer("pago-referencia");
        datos.banco = leer("pago-banco");
        datos.cedula_pagador = leer("pago-cedula-pagador");
        if (!/^\d{4,6}$/.test(datos.referencia)) {
            return mostrarAlerta("Escribe los últimos 4 a 6 dígitos del pago móvil (solo números).", "err");
        }
        if (!datos.banco) return mostrarAlerta("Escribe el banco del pago móvil.", "err");
    } else if (metodo === "zelle") {
        datos.cuenta = leer("pago-cuenta");
        if (!datos.cuenta) return mostrarAlerta("Escribe el correo o teléfono de la cuenta Zelle.", "err");
    }

    state.pagosEnCurso.push({ metodo, moneda, monto: Number(monto.toFixed(2)), monto_usd: Number(montoUsd.toFixed(2)), datos });

    // Limpiamos los campos de pago.
    document.getElementById("pago-monto").value = "";
    ["pago-billetes", "pago-serial", "pago-referencia", "pago-banco", "pago-cedula-pagador", "pago-cuenta", "pago-recibido"]
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });

    renderizarPagosEnCurso();
    renderizarCamposPago();
}

// ----------------------------------------------------------------------------
// registrarVenta(): valida todo y guarda la venta + pagos + caja + stock
// ----------------------------------------------------------------------------
async function registrarVenta() {
    if (state.listaVenta.length === 0) {
        return mostrarAlerta("El carrito esta vacio. Agrega productos.", "err");
    }
    if (state.pagosEnCurso.length === 0) {
        return mostrarAlerta("Agrega al menos un pago antes de registrar la venta.", "err");
    }

    const totalUsd = totalCarritoUsd();
    const pagadoUsd = totalPagadoUsd();
    const diferencia = Math.abs(totalUsd - pagadoUsd);
    if (diferencia > 0.01) {
        return mostrarAlerta(`El total de pagos (${formatearMonto(pagadoUsd, "USD")}) no cubre la venta (${formatearMonto(totalUsd, "USD")}). Ajusta los pagos.`, "err");
    }

    const cliente = document.getElementById("vta-cliente").value.trim().replace(/\|/g, " ");
    const cedula = document.getElementById("vta-cedula").value.trim().replace(/\|/g, " ");
    const generarRecibo = document.getElementById("vta-generar-recibo").checked;

    const btn = document.getElementById("btn-registrar-venta");
    btn.disabled = true;
    btn.textContent = "Registrando venta...";

    try {
        // 1. Stock fresco.
        await cargarInventario();
        const itemsConfirmados = [];
        for (const item of state.listaVenta) {
            const prod = state.inventario.find(p => p.id === item.id);
            if (!prod || prod.cantidad < item.cantidad) {
                return mostrarAlerta(`Stock insuficiente de ${item.name} en la nube.`, "err");
            }
            itemsConfirmados.push({ id: prod.id, name: prod.name, cantidad: item.cantidad, precio: prod.precio });
        }

        // 2. Totales.
        const tasa = obtenerTasa("VES");
        const totalBs = convertirDesdeUsd(totalUsd, "VES");
        const idVenta = obtenerSiguienteIdVenta();
        const fecha = obtenerFechaFormateada();

        const nuevaVenta = {
            id: idVenta,
            fecha,
            cajero: state.usuarioActual?.usuario || "",
            cliente,
            cedula,
            detalle: itemsConfirmados.map(i => `${i.cantidad}x ${i.name}(${i.id}) @$${i.precio.toFixed(2)}`).join(", "),
            total_usd: Number(totalUsd.toFixed(2)),
            total_bs: Number(totalBs.toFixed(2)),
            tasa: tasa ?? 0,
            recibo: false,
            recibo_nombre: "",
            recibo_cedula: "",
            recibo_direccion: "",
        };

        // 3. Guardar venta.
        const { error: errVenta } = await db.from("lm_ventas").insert([nuevaVenta]);
        if (errVenta) return mostrarAlerta(`Error guardando la venta: ${errVenta.message}`, "err");

        // 4. Guardar pagos.
        const pagosParaGuardar = state.pagosEnCurso.map(p => ({
            venta_id: idVenta,
            metodo: p.metodo,
            moneda: p.moneda,
            monto: p.monto,
            monto_usd: p.monto_usd,
            datos: JSON.stringify(p.datos),
        }));
        const { error: errPagos } = await db.from("lm_pagos").insert(pagosParaGuardar);
        if (errPagos) return mostrarAlerta(`Error guardando los pagos: ${errPagos.message}`, "err");

        // 5. Descontar stock.
        for (const item of itemsConfirmados) {
            const prod = state.inventario.find(p => p.id === item.id);
            const nueva = Math.max(0, Number((prod.cantidad - item.cantidad).toFixed(2)));
            const { error: errStock } = await db.from("lm_productos").update({ cantidad: nueva }).eq("id", item.id);
            if (errStock) console.warn(`Error descontando stock de ${item.id}:`, errStock.message);
        }

        // 6. Ingreso automatico en caja.
        await db.from("lm_caja").insert([{
            tipo: "ingreso",
            origen: "venta",
            venta_id: idVenta,
            nombre: cliente || `Venta ${idVenta}`,
            motivo: "Venta registrada",
            moneda: "USD",
            monto: Number(totalUsd.toFixed(2)),
            monto_usd: Number(totalUsd.toFixed(2)),
            monto_bs: Number(totalBs.toFixed(2)),
            tasa: tasa ?? 0,
            fecha,
            usuario: state.usuarioActual?.usuario || "",
        }]);

        // 7. Recibo PDF (opcional).
        const pagosConfirmados = state.pagosEnCurso.map(p => ({ ...p }));
        if (generarRecibo) {
            generarReciboVentaPDF(nuevaVenta, itemsConfirmados, pagosConfirmados);
        }

        // 8. Limpiar y recargar.
        limpiarFormularioVenta();
        await Promise.all([cargarInventario(), cargarVentas(), cargarPagos(), cargarCaja()]);
        renderizarTodo();
        renderizarSelectProductos();
        return mostrarAlerta(`Venta ${idVenta} registrada, stock actualizado e ingreso en caja.`, "ok");
    } finally {
        btn.disabled = false;
        btn.textContent = "Registrar Venta";
    }
}

function limpiarFormularioVenta() {
    state.listaVenta = [];
    state.pagosEnCurso = [];
    document.getElementById("vta-cliente").value = "";
    document.getElementById("vta-cedula").value = "";
    document.getElementById("vta-cantidad").value = "";
    document.getElementById("pago-monto").value = "";
    renderizarListaVenta();
    renderizarPagosEnCurso();
    renderizarSelectProductos();
    renderizarCamposPago();
}

// ----------------------------------------------------------------------------
// Recibo formal desde "Mis Ventas" (pide nombre/cedula/direccion)
// ----------------------------------------------------------------------------
function abrirModalRecibo(idVenta) {
    const v = state.ventas.find(x => x.id === idVenta);
    if (!v) return;

    mostrarModal({
        titulo: `Recibo de ${idVenta}`,
        texto: "Para generar el recibo formal necesitas estos datos del comprador.",
        botones: [
            {
                texto: "Generar recibo",
                clase: "btn-success",
                onClick: () => pedirDatosRecibo(idVenta),
            },
            { texto: "Cancelar", clase: "btn-outline", onClick: () => {} },
        ],
    });
}

// Usa un modal secundario con campos para nombre/cedula/direccion.
function pedirDatosRecibo(idVenta) {
    const v = state.ventas.find(x => x.id === idVenta);
    if (!v) return;

    const overlay = document.getElementById("modal-overlay");
    const titulo = document.getElementById("modal-titulo");
    const texto = document.getElementById("modal-texto");
    const botones = document.getElementById("modal-botones");

    titulo.textContent = `Datos del recibo (${idVenta})`;
    texto.innerHTML = "";
    texto.textContent = "";

    // Construimos un mini-formulario dentro del modal.
    const form = document.createElement("div");
    form.innerHTML = `
        <div class="form-group"><label for="recibo-nombre">Nombre / Razón social</label>
            <input type="text" id="recibo-nombre" value="${escaparHtml(v.recibo_nombre || v.cliente || "")}" placeholder="Nombre de quien compró"></div>
        <div class="form-group"><label for="recibo-cedula">Cédula / RIF</label>
            <input type="text" id="recibo-cedula" value="${escaparHtml(v.recibo_cedula || v.cedula || "")}" placeholder="Ej. V-12345678"></div>
        <div class="form-group"><label for="recibo-direccion">Dirección</label>
            <input type="text" id="recibo-direccion" value="${escaparHtml(v.recibo_direccion || "")}" placeholder="Dirección del comprador"></div>
    `;
    texto.appendChild(form);

    botones.innerHTML = "";
    const btnGenerar = document.createElement("button");
    btnGenerar.className = "btn btn-success";
    btnGenerar.textContent = "Generar PDF";
    btnGenerar.addEventListener("click", async () => {
        const nombre = document.getElementById("recibo-nombre").value.trim();
        const cedula = document.getElementById("recibo-cedula").value.trim();
        const direccion = document.getElementById("recibo-direccion").value.trim();

        if (!nombre) return mostrarAlerta("Escribe el nombre del comprador.", "err");
        if (!cedula) return mostrarAlerta("Escribe la cédula del comprador.", "err");
        if (!direccion) return mostrarAlerta("Escribe la dirección del comprador.", "err");

        // Guardamos los datos en la venta.
        await db.from("lm_ventas").update({
            recibo: true,
            recibo_nombre: nombre,
            recibo_cedula: cedula,
            recibo_direccion: direccion,
            cliente: nombre,
            cedula,
        }).eq("id", idVenta);

        const vActualizada = { ...v, recibo: true, recibo_nombre: nombre, recibo_cedula: cedula, recibo_direccion: direccion, cliente: nombre, cedula };
        cerrarModal();
        await cargarVentas();
        renderizarTodo();
        generarReciboVentaPDF(vActualizada, null, state.pagos.filter(p => p.venta_id === idVenta));
        mostrarAlerta(`Recibo de ${idVenta} generado.`, "ok");
    });

    const btnCancelar = document.createElement("button");
    btnCancelar.className = "btn btn-outline";
    btnCancelar.textContent = "Cancelar";
    btnCancelar.addEventListener("click", cerrarModal);

    botones.appendChild(btnGenerar);
    botones.appendChild(btnCancelar);
    overlay.classList.remove("hidden");
}

// ----------------------------------------------------------------------------
// eliminarVentaAdmin(): borra la venta, devuelve stock y quita el ingreso de caja
// ----------------------------------------------------------------------------
function eliminarVentaAdmin(idVenta) {
    if (!esMaster()) return;
    const v = state.ventas.find(x => x.id === idVenta);
    if (!v) return;

    mostrarModal({
        titulo: `Eliminar venta ${idVenta}`,
        texto: "Se eliminará la venta, se devolverá el stock al inventario y se quitará su ingreso de la caja.",
        botones: [
            { texto: "Sí, eliminar", clase: "btn-danger", onClick: () => confirmarEliminarVenta(idVenta) },
            { texto: "Cancelar", clase: "btn-outline", onClick: () => {} },
        ],
    });
}

async function confirmarEliminarVenta(idVenta) {
    const v = state.ventas.find(x => x.id === idVenta);
    if (!v) return;

    // 1. Devolver stock.
    const items = parsearItemsDesdeDetalle(v.detalle);
    for (const item of items) {
        const prod = state.inventario.find(p => p.id === item.id);
        const nueva = Number(((prod ? prod.cantidad : 0) + item.cantidad).toFixed(2));
        await db.from("lm_productos").update({ cantidad: nueva }).eq("id", item.id);
    }

    // 2. Borrar pagos, la venta y el ingreso de caja asociado.
    await db.from("lm_pagos").delete().eq("venta_id", idVenta);
    await db.from("lm_ventas").delete().eq("id", idVenta);
    await db.from("lm_caja").delete().eq("origen", "venta").eq("venta_id", idVenta);

    await Promise.all([cargarInventario(), cargarVentas(), cargarPagos(), cargarCaja()]);
    renderizarTodo();
    mostrarAlerta(`Venta ${idVenta} eliminada: stock devuelto y caja actualizada.`, "ok");
}
