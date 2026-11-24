// ============================================================================
//  ui.js - RENDERIZADO DE LA INTERFAZ
// ============================================================================
//  Dibuja todas las tablas, listas y totales en pantalla. Cada vez que cambia
//  algo se llama a renderizarTodo(). TODOS los precios internos estan en USD.
// ============================================================================

import { state } from "./state.js";
import { formatearMonto, convertirDesdeUsd, textoResumenTasas, MONEDAS } from "./tasas.js";

// ----------------------------------------------------------------------------
// Catalogos de apoyo
// ----------------------------------------------------------------------------
export const UNIDADES = [
    { codigo: "unidad",    nombre: "Unidad",     simbolo: "u" },
    { codigo: "kilo",      nombre: "Kilo",       simbolo: "kg" },
    { codigo: "gramo",     nombre: "Gramo",      simbolo: "g" },
    { codigo: "litro",     nombre: "Litro",      simbolo: "L" },
    { codigo: "mililitro", nombre: "Mililitro",  simbolo: "mL" },
    { codigo: "caja",      nombre: "Caja",       simbolo: "caja" },
    { codigo: "paquete",   nombre: "Paquete",    simbolo: "paq" },
];

export const CATEGORIAS = [
    "Alimentos", "Bebidas", "Limpieza", "Aseo Personal", "Hogar",
    "Dulceria", "Embutidos", "Lacteos", "Otros",
];

export const METODOS_PAGO = [
    { codigo: "efectivo_bs",  nombre: "Efectivo (Bolívares)",     moneda: "VES" },
    { codigo: "efectivo_usd", nombre: "Efectivo (Dólares)",       moneda: "USD" },
    { codigo: "punto",        nombre: "Punto de venta (Tarjeta)", moneda: "VES" },
    { codigo: "pago_movil",   nombre: "Pago Móvil",               moneda: "VES" },
    { codigo: "zelle",        nombre: "Zelle",                    moneda: "USD" },
];

export function obtenerMetodo(codigo) {
    return METODOS_PAGO.find(m => m.codigo === codigo) || METODOS_PAGO[0];
}
export function obtenerUnidad(codigo) {
    return UNIDADES.find(u => u.codigo === codigo) || UNIDADES[0];
}

// ----------------------------------------------------------------------------
// Utilidades generales
// ----------------------------------------------------------------------------
export function escaparHtml(valor) {
    return String(valor ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function formatearMoneda(usd) {
    return formatearMonto(convertirDesdeUsd(usd, state.moneda), state.moneda);
}

export function mostrarPantalla(pantalla) {
    document.getElementById("login-screen").classList.toggle("hidden", pantalla !== "login");
    document.getElementById("app-screen").classList.toggle("hidden", pantalla !== "app");
    document.getElementById("exit-screen").classList.toggle("hidden", pantalla !== "exit");
}

export function mostrarAlerta(mensaje, tipo) {
    const alerta = document.getElementById("alerta-global");
    if (!alerta) return;
    alerta.textContent = mensaje;
    alerta.className = `alerta ${tipo}`;
    clearTimeout(alerta._timer);
    alerta._timer = setTimeout(() => alerta.classList.add("hidden"), 4200);
}

export function mostrarModal({ titulo = "", texto = "", botones = [] }) {
    const overlay = document.getElementById("modal-overlay");
    if (!overlay) return;
    document.getElementById("modal-titulo").textContent = titulo;
    document.getElementById("modal-texto").textContent = texto;
    const contenedor = document.getElementById("modal-botones");
    contenedor.innerHTML = "";
    botones.forEach(opcion => {
        const btn = document.createElement("button");
        btn.className = `btn ${opcion.clase || "btn-primary"}`;
        btn.textContent = opcion.texto;
        btn.addEventListener("click", () => {
            cerrarModal();
            if (opcion.onClick) opcion.onClick();
        });
        contenedor.appendChild(btn);
    });
    overlay.classList.remove("hidden");
}
export function cerrarModal() {
    document.getElementById("modal-overlay")?.classList.add("hidden");
}

// Convierte "2x arroz(P#01) @$3.50, ..." en [{id, name, cantidad, precio}]
export function parsearItemsDesdeDetalle(detalle) {
    return String(detalle || "").split(",").map(bloque => {
        const texto = bloque.trim();
        const conPrecio = texto.match(/^([\d.]+)x\s+(.+)\((.+)\)\s+@\$([\d.]+)$/);
        if (conPrecio) {
            return { cantidad: parseFloat(conPrecio[1]), name: conPrecio[2], id: conPrecio[3], precio: parseFloat(conPrecio[4]) };
        }
        const sinPrecio = texto.match(/^([\d.]+)x\s+(.+)\((.+)\)$/);
        if (sinPrecio) {
            return { cantidad: parseFloat(sinPrecio[1]), name: sinPrecio[2], id: sinPrecio[3], precio: 0 };
        }
        return null;
    }).filter(Boolean);
}

// ----------------------------------------------------------------------------
// renderizarTodo(): pinta todas las secciones.
// ----------------------------------------------------------------------------
export function renderizarTodo() {
    renderizarInventario();
    renderizarProductosLectura();
    renderizarSelectProductos();
    renderizarListaVenta();
    renderizarPagosEnCurso();
    renderizarVentas();
    renderizarMisVentas();
    renderizarCaja();
    renderizarCajeros();
    renderizarEmpresa();
    renderizarSesiones();
    renderizarTasas();
    renderizarCuenta();
}

// ----------------------------------------------------------------------------
// INVENTARIO (admin) - CRUD con categoria y unidad
// ----------------------------------------------------------------------------
export function renderizarInventario() {
    const tbody = document.getElementById("tbody-inventario");
    if (!tbody) return;

    actualizarResumenInventario();

    const busqueda = (state.busquedaInventario || "").trim().toLowerCase();
    const cat = (state.filtroCategoriaInventario || "").trim().toLowerCase();

    const lista = state.inventario.filter(p => {
        const okBusq = !busqueda ||
            String(p.id).toLowerCase().includes(busqueda) ||
            String(p.name).toLowerCase().includes(busqueda);
        const okCat = !cat || String(p.categoria || "").toLowerCase().includes(cat);
        return okBusq && okCat;
    });

    if (state.inventario.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8">El inventario esta vacio. Registra tu primer producto.</td></tr>`;
        return;
    }
    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8">Sin resultados para tu busqueda.</td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map(p => {
        const unidad = obtenerUnidad(p.unidad);
        return `
            <tr>
                <td><strong>${escaparHtml(p.id)}</strong></td>
                <td>${escaparHtml(p.name)}</td>
                <td>${escaparHtml(p.categoria || "Otros")}</td>
                <td>${escaparHtml(unidad.nombre)}</td>
                <td>${Number(p.cantidad).toFixed(2)} ${escaparHtml(unidad.simbolo)}</td>
                <td>
                    ${escaparHtml(formatearMoneda(p.precio))}
                    <span class="sub-dato">≈ ${escaparHtml(formatearMonto(p.precio, "USD"))}</span>
                </td>
                <td>
                    <div class="acciones-celda">
                        <button class="btn btn-warning btn-sm" data-action="edit-inv" data-id="${escaparHtml(p.id)}">Editar</button>
                        <button class="btn btn-danger btn-sm" data-action="del-inv" data-id="${escaparHtml(p.id)}">Eliminar</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function actualizarResumenInventario() {
    const cont = document.getElementById("resumen-inventario");
    if (!cont) return;
    const tipos = state.inventario.length;
    const unidades = state.inventario.reduce((a, p) => a + Number(p.cantidad || 0), 0);
    const valor = state.inventario.reduce((a, p) => a + Number(p.cantidad || 0) * Number(p.precio || 0), 0);
    cont.innerHTML = `
        <div class="ri-item"><span>Productos (tipos)</span><strong>${tipos}</strong></div>
        <div class="ri-item"><span>Unidades totales</span><strong>${unidades.toFixed(2)}</strong></div>
        <div class="ri-item"><span>Valor total</span><strong>${escaparHtml(formatearMoneda(valor))}</strong><span class="resumen-bs">≈ ${escaparHtml(formatearMonto(valor, "USD"))}</span></div>
    `;
}

// ----------------------------------------------------------------------------
// PRODUCTOS (cajera) - SOLO LECTURA con busqueda por nombre/precio/categoria
// ----------------------------------------------------------------------------
export function renderizarProductosLectura() {
    const tbody = document.getElementById("tbody-productos");
    if (!tbody) return;

    const busqueda = (state.busquedaInventario || "").trim().toLowerCase();
    const cat = (state.filtroCategoriaInventario || "").trim().toLowerCase();

    // Filtro adicional: por precio (si escribe un numero, filtra <= ese precio)
    const esNumero = !isNaN(parseFloat(busqueda)) && busqueda !== "";
    const precioBusqueda = esNumero ? parseFloat(busqueda) : null;

    const lista = state.inventario.filter(p => {
        let ok = true;
        if (cat) ok = ok && String(p.categoria || "").toLowerCase().includes(cat);
        if (busqueda) {
            if (precioBusqueda !== null) {
                ok = ok && Number(p.precio) <= precioBusqueda;
            } else {
                ok = ok && (
                    String(p.id).toLowerCase().includes(busqueda) ||
                    String(p.name).toLowerCase().includes(busqueda) ||
                    String(p.categoria || "").toLowerCase().includes(busqueda)
                );
            }
        }
        return ok;
    });

    if (state.inventario.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6">No hay productos en el inventario todavia.</td></tr>`;
        return;
    }
    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6">Sin resultados para tu busqueda.</td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map(p => {
        const unidad = obtenerUnidad(p.unidad);
        const hayStock = Number(p.cantidad) > 0;
        return `
            <tr>
                <td><strong>${escaparHtml(p.id)}</strong></td>
                <td>${escaparHtml(p.name)}</td>
                <td>${escaparHtml(p.categoria || "Otros")}</td>
                <td>${escaparHtml(unidad.nombre)}</td>
                <td>
                    ${escaparHtml(formatearMoneda(p.precio))}
                    <span class="sub-dato">≈ ${escaparHtml(formatearMonto(p.precio, "USD"))}</span>
                </td>
                <td>
                    ${hayStock
                        ? `<span class="tag tag-verde">Disponible: ${Number(p.cantidad).toFixed(2)} ${escaparHtml(unidad.simbolo)}</span>`
                        : `<span class="tag tag-rojo">Agotado</span>`}
                </td>
            </tr>
        `;
    }).join("");
}

// ----------------------------------------------------------------------------
// SELECT de productos (carrito de la venta)
// ----------------------------------------------------------------------------
export function renderizarSelectProductos() {
    const select = document.getElementById("vta-producto");
    if (!select) return;

    const disponibles = state.inventario.filter(p => Number(p.cantidad) > 0);

    if (disponibles.length === 0) {
        select.innerHTML = `<option value="">Sin productos con stock</option>`;
        return;
    }

    const valorPrevio = select.value;
    select.innerHTML = disponibles.map(p => {
        const unidad = obtenerUnidad(p.unidad);
        const enCarrito = state.listaVenta.find(i => i.id === p.id);
        const disp = p.cantidad - (enCarrito ? enCarrito.cantidad : 0);
        return `<option value="${escaparHtml(p.id)}">${escaparHtml(p.id)} - ${escaparHtml(p.name)} (${escaparHtml(formatearMoneda(p.precio))} | Disp: ${Number(disp).toFixed(2)} ${escaparHtml(unidad.simbolo)})</option>`;
    }).join("");

    if (valorPrevio && disponibles.some(p => p.id === valorPrevio)) select.value = valorPrevio;
}

// ----------------------------------------------------------------------------
// CARRITO DE LA VENTA (cajera)
// ----------------------------------------------------------------------------
export function renderizarListaVenta() {
    const tbody = document.getElementById("tbody-vta-cart");
    const totalEl = document.getElementById("total-venta");
    if (!tbody) return;

    if (state.listaVenta.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6">Carrito vacio. Agrega productos.</td></tr>`;
        if (totalEl) totalEl.textContent = formatearMonto(0, state.moneda);
        return;
    }

    let total = 0;
    tbody.innerHTML = state.listaVenta.map(item => {
        const subtotal = item.cantidad * item.precio;
        total += subtotal;
        return `
            <tr>
                <td>${escaparHtml(item.id)}</td>
                <td>${escaparHtml(item.name)}</td>
                <td>${item.cantidad}</td>
                <td>${escaparHtml(formatearMoneda(item.precio))}</td>
                <td><strong>${escaparHtml(formatearMoneda(subtotal))}</strong></td>
                <td><button class="btn btn-danger btn-sm" data-action="del-vta" data-id="${escaparHtml(item.id)}">Quitar</button></td>
            </tr>
        `;
    }).join("");

    if (totalEl) totalEl.textContent = formatearMoneda(total);
}

// ----------------------------------------------------------------------------
// PAGOS EN CURSO (de la venta que se esta armando)
// ----------------------------------------------------------------------------
export function renderizarPagosEnCurso() {
    const tbody = document.getElementById("tbody-vta-pagos");
    const totalEl = document.getElementById("total-pagado");
    if (!tbody) return;

    if (state.pagosEnCurso.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5">Sin pagos agregados.</td></tr>`;
        if (totalEl) totalEl.textContent = formatearMonto(0, "USD");
        return;
    }

    let totalPagadoUsd = 0;
    tbody.innerHTML = state.pagosEnCurso.map((pg, i) => {
        totalPagadoUsd += pg.monto_usd;
        const metodo = obtenerMetodo(pg.metodo);
        const detalle = resumenPago(pg);
        return `
            <tr>
                <td>${escaparHtml(metodo.nombre)}</td>
                <td>${escaparHtml(pg.moneda)}</td>
                <td><strong>${escaparHtml(formatearMonto(pg.monto, pg.moneda))}</strong></td>
                <td>${detalle}</td>
                <td><button class="btn btn-danger btn-sm" data-action="del-pago" data-index="${i}">Quitar</button></td>
            </tr>
        `;
    }).join("");

    if (totalEl) totalEl.textContent = formatearMonto(totalPagadoUsd, "USD");
}

// Devuelve un texto corto con los datos propios del metodo de pago.
export function resumenPago(pg) {
    const d = pg.datos || {};
    switch (pg.metodo) {
        case "efectivo_bs":
        case "efectivo_usd": {
            const partes = [];
            if (Array.isArray(d.serials) && d.serials.length) partes.push(`Seriales: ${d.serials.map(s => s.serial).join(", ")}`);
            else if (d.serial) partes.push(`Serial: ${d.serial}`);
            if (d.billetes) partes.push(`Billetes: ${d.billetes}`);
            if (d.recibido != null && d.recibido !== "") partes.push(`Recibió: ${formatearMonto(d.recibido, pg.moneda)}`);
            if (d.vuelto != null && Number(d.vuelto) > 0) partes.push(`Cambio: ${formatearMonto(d.vuelto, pg.moneda)}`);
            return partes.length ? `<span class="sub-dato">${escaparHtml(partes.join(" · "))}</span>` : "-";
        }
        case "punto":
            return d.referencia ? `<span class="sub-dato">N° aprobación: ${escaparHtml(d.referencia)}</span>` : "-";
        case "pago_movil": {
            const partes = [];
            if (d.referencia) partes.push(`Ref: ${d.referencia}`);
            if (d.banco) partes.push(`Banco: ${d.banco}`);
            if (d.cedula_pagador) partes.push(`CI: ${d.cedula_pagador}`);
            return partes.length ? `<span class="sub-dato">${escaparHtml(partes.join(" · "))}</span>` : "-";
        }
        case "zelle":
            return d.cuenta ? `<span class="sub-dato">${escaparHtml(d.cuenta)}</span>` : "-";
        default:
            return "-";
    }
}

// ----------------------------------------------------------------------------
// VENTAS (admin) - con filtros y estadisticas
// ----------------------------------------------------------------------------
export function renderizarVentas() {
    const tbody = document.getElementById("tbody-ventas");
    if (!tbody) return;

    // Llenar el filtro de cajera (una sola vez).
    const selCajero = document.getElementById("filtro-v-cajero");
    if (selCajero && !selCajero.dataset.init) {
        const usuarios = [...new Set(state.cajeros.filter(c => c.rol !== "master").map(c => c.usuario))].sort();
        selCajero.innerHTML = `<option value="">Todas</option>` +
            usuarios.map(u => `<option value="${escaparHtml(u)}">${escaparHtml(u)}</option>`).join("");
        selCajero.dataset.init = "1";
    }

    actualizarResumenVentas();

    const lista = aplicarFiltrosVentas(state.ventas);

    if (state.ventas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8">Aun no hay ventas registradas.</td></tr>`;
        return;
    }
    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8">Sin ventas para los filtros elegidos.</td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map(v => {
        const pagos = state.pagos.filter(pg => pg.venta_id === v.id);
        const resumenPagos = pagos.length
            ? pagos.map(pg => obtenerMetodo(pg.metodo).nombre).join(" + ")
            : "-";
        return `
            <tr>
                <td><strong>${escaparHtml(v.id)}</strong></td>
                <td>${escaparHtml(v.fecha)}</td>
                <td>${escaparHtml(v.cajero || "-")}</td>
                <td>
                    ${escaparHtml(v.cliente || "Sin nombre")}
                    <span class="sub-dato">CI: ${escaparHtml(v.cedula || "N/A")}</span>
                </td>
                <td>${escaparHtml(v.detalle || "-")}</td>
                <td>${escaparHtml(resumenPagos)}</td>
                <td>
                    <strong>${escaparHtml(formatearMonto(v.total_usd, "USD"))}</strong>
                    <span class="sub-dato">≈ ${escaparHtml(formatearMonto(v.total_bs, "VES"))}</span>
                </td>
                <td>
                    <div class="acciones-celda">
                        <button class="btn btn-primary btn-sm" data-action="pdf-vta" data-id="${escaparHtml(v.id)}">PDF</button>
                        <button class="btn btn-danger btn-sm" data-action="del-vta-admin" data-id="${escaparHtml(v.id)}">Eliminar</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function actualizarResumenVentas() {
    const cont = document.getElementById("resumen-ventas");
    if (!cont) return;

    const lista = aplicarFiltrosVentas(state.ventas);
    const totalUsd = lista.reduce((a, v) => a + Number(v.total_usd || 0), 0);
    const totalBs = lista.reduce((a, v) => a + Number(v.total_bs || 0), 0);

    const masSemana = productoMasVendido(state.ventas, 7);
    const masAnio = productoMasVendido(state.ventas, 365);

    cont.innerHTML = `
        <div class="ri-item"><span>Ventas (filtradas)</span><strong>${lista.length}</strong></div>
        <div class="ri-item"><span>Total ventas (USD)</span><strong>${escaparHtml(formatearMonto(totalUsd, "USD"))}</strong></div>
        <div class="ri-item"><span>Total ventas (Bs)</span><strong>${escaparHtml(formatearMonto(totalBs, "VES"))}</strong></div>
        <div class="ri-item"><span>Más vendido (7 días)</span><strong>${escaparHtml(masSemana || "-")}</strong></div>
        <div class="ri-item"><span>Más vendido (año)</span><strong>${escaparHtml(masAnio || "-")}</strong></div>
    `;
}

// Devuelve el nombre del producto mas vendido (por cantidad) en los ultimos N dias.
function productoMasVendido(ventas, dias) {
    const limite = Date.now() - dias * 24 * 60 * 60 * 1000;
    const conteo = {};
    ventas.forEach(v => {
        // Fecha guardada como "YYYY-MM-DD HH:mm"
        const [fechaParte, horaParte] = String(v.fecha || "").split(" ");
        const fecha = new Date(`${fechaParte}T${horaParte || "00:00"}:00`);
        if (isNaN(fecha.getTime())) return;
        if (fecha.getTime() < limite) return;

        parsearItemsDesdeDetalle(v.detalle).forEach(item => {
            const clave = item.name;
            conteo[clave] = (conteo[clave] || 0) + Number(item.cantidad || 0);
        });
    });

    let mejor = null, mejorCant = 0;
    Object.entries(conteo).forEach(([nombre, cant]) => {
        if (cant > mejorCant) { mejorCant = cant; mejor = nombre; }
    });
    return mejor;
}

function aplicarFiltrosVentas(lista) {
    const f = state.filtrosVentas;
    return lista.filter(v => {
        const dia = String(v.fecha || "").slice(0, 10);
        if (f.desde && dia < f.desde) return false;
        if (f.hasta && dia > f.hasta) return false;
        if (f.cajero && v.cajero !== f.cajero) return false;
        if (f.producto && !String(v.detalle || "").toLowerCase().includes(f.producto.toLowerCase())) return false;

        const usd = Number(v.total_usd ?? 0);
        if (f.montoMin !== "" && usd < Number(f.montoMin)) return false;
        if (f.montoMax !== "" && usd > Number(f.montoMax)) return false;
        return true;
    });
}

// ----------------------------------------------------------------------------
// MIS VENTAS (cajera) - solo las suyas
// ----------------------------------------------------------------------------
export function renderizarMisVentas() {
    const tbody = document.getElementById("tbody-mis-ventas");
    if (!tbody) return;

    const usuario = state.usuarioActual?.usuario;
    const lista = state.ventas.filter(v => v.cajero === usuario);

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7">Aun no has registrado ventas.</td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map(v => {
        const pagos = state.pagos.filter(pg => pg.venta_id === v.id);
        const resumenPagos = pagos.length
            ? pagos.map(pg => obtenerMetodo(pg.metodo).nombre).join(" + ")
            : "-";
        return `
            <tr>
                <td><strong>${escaparHtml(v.id)}</strong></td>
                <td>${escaparHtml(v.fecha)}</td>
                <td>
                    ${escaparHtml(v.cliente || "Sin nombre")}
                    <span class="sub-dato">CI: ${escaparHtml(v.cedula || "N/A")}</span>
                </td>
                <td>${escaparHtml(v.detalle || "-")}</td>
                <td>${escaparHtml(resumenPagos)}</td>
                <td><strong>${escaparHtml(formatearMonto(v.total_usd, "USD"))}</strong></td>
                <td>
                    <div class="acciones-celda">
                        <button class="btn btn-primary btn-sm" data-action="pdf-mi-vta" data-id="${escaparHtml(v.id)}">Recibo PDF</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

// ----------------------------------------------------------------------------
// CAJA (admin)
// ----------------------------------------------------------------------------
export function renderizarCaja() {
    const tbody = document.getElementById("tbody-caja");
    const resumen = document.getElementById("resumen-caja");
    if (!tbody) return;

    let ingresos = 0, gastos = 0;
    state.caja.forEach(m => {
        const usd = Number(m.monto_usd ?? 0);
        if (m.tipo === "ingreso") ingresos += usd;
        else gastos += usd;
    });
    const saldo = ingresos - gastos;

    if (resumen) resumen.innerHTML = resumenCajaHTML(ingresos, gastos, saldo);

    if (state.caja.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9">No hay movimientos de dinero registrados.</td></tr>`;
        return;
    }

    tbody.innerHTML = state.caja.map(m => {
        const tipoTag = m.tipo === "gasto"
            ? `<span class="tag tag-rojo">Gasto</span>`
            : `<span class="tag tag-verde">Ingreso</span>`;
        const origenTag = m.origen === "venta"
            ? `<span class="tag tag-azul">Venta ${escaparHtml(m.venta_id || "")}</span>`
            : `<span class="tag tag-gris">Manual</span>`;
        return `
            <tr>
                <td>${escaparHtml(m.fecha)}</td>
                <td>${tipoTag}</td>
                <td>${origenTag}</td>
                <td>${escaparHtml(m.nombre || "-")}</td>
                <td>${escaparHtml(m.motivo || "-")}</td>
                <td><strong>${escaparHtml(formatearMonto(m.monto_usd, "USD"))}</strong></td>
                <td>${escaparHtml(formatearMonto(m.monto_bs, "VES"))}</td>
                <td>${escaparHtml(m.usuario || "-")}</td>
                <td><button class="btn btn-danger btn-sm" data-action="del-caja" data-id="${escaparHtml(m.id)}">Eliminar</button></td>
            </tr>
        `;
    }).join("");
}

function resumenCajaHTML(ingresos, gastos, saldo) {
    const tasa = state.tasas.VES;
    const aBs = usd => (tasa ? formatearMonto(Number(usd) * tasa, "VES") : "—");
    return `
        <div class="resumen-item resumen-ingreso"><span class="resumen-label">Ingresos</span><strong>${formatearMonto(ingresos, "USD")}</strong><span class="resumen-bs">${aBs(ingresos)}</span></div>
        <div class="resumen-item resumen-gasto"><span class="resumen-label">Gastos</span><strong>${formatearMonto(gastos, "USD")}</strong><span class="resumen-bs">${aBs(gastos)}</span></div>
        <div class="resumen-item resumen-saldo"><span class="resumen-label">Saldo (queda)</span><strong>${formatearMonto(saldo, "USD")}</strong><span class="resumen-bs">${aBs(saldo)}</span></div>
    `;
}

// ----------------------------------------------------------------------------
// CAJEROS (admin)
// ----------------------------------------------------------------------------
export function renderizarCajeros() {
    const tbody = document.getElementById("tbody-cajeros");
    if (!tbody) return;

    const lista = state.cajeros.filter(c => c.rol !== "master");

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5">Aun no hay cajeras registradas.</td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map(c => `
        <tr>
            <td><strong>${escaparHtml(c.usuario)}</strong></td>
            <td>${escaparHtml(c.nombre || "-")}</td>
            <td>${c.activo === false ? `<span class="tag tag-rojo">Desactivada</span>` : `<span class="tag tag-verde">Activa</span>`}</td>
            <td>${escaparHtml(c.creado_en ? new Date(c.creado_en).toLocaleString("es-VE") : "-")}</td>
            <td>
                <div class="acciones-celda">
                    <button class="btn btn-warning btn-sm" data-action="edit-cajero" data-usuario="${escaparHtml(c.usuario)}">Cambiar clave</button>
                    ${c.activo === false
                        ? `<button class="btn btn-success btn-sm" data-action="toggle-cajero" data-usuario="${escaparHtml(c.usuario)}">Activar</button>`
                        : `<button class="btn btn-secondary btn-sm" data-action="toggle-cajero" data-usuario="${escaparHtml(c.usuario)}">Desactivar</button>`}
                    <button class="btn btn-danger btn-sm" data-action="del-cajero" data-usuario="${escaparHtml(c.usuario)}">Eliminar</button>
                </div>
            </td>
        </tr>
    `).join("");
}

// ----------------------------------------------------------------------------
// EMPRESA (admin)
// ----------------------------------------------------------------------------
export function renderizarEmpresa() {
    const f = document.getElementById("form-empresa");
    if (!f) return;
    const e = state.empresa || {};
    document.getElementById("emp-nombre").value = e.nombre || "";
    document.getElementById("emp-rif").value = e.rif || "";
    document.getElementById("emp-direccion").value = e.direccion || "";
    document.getElementById("emp-ciudad").value = e.ciudad || "";
    document.getElementById("emp-telefono").value = e.telefono || "";
    document.getElementById("emp-correo").value = e.correo || "";
    document.getElementById("emp-propietario").value = e.propietario || "";
    document.getElementById("emp-notas").value = e.notas || "";
}

// ----------------------------------------------------------------------------
// SESIONES (admin)
// ----------------------------------------------------------------------------
export function renderizarSesiones() {
    const tbody = document.getElementById("tbody-sesiones");
    if (!tbody) return;

    if (state.sesiones.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5">No hay sesiones registradas.</td></tr>`;
        return;
    }

    tbody.innerHTML = state.sesiones.map(s => {
        const rolEtiqueta = s.rol === "master"
            ? `<span class="tag tag-azul">Master</span>`
            : `<span class="tag tag-verde">Cajera</span>`;
        return `
            <tr>
                <td>${escaparHtml(s.usuario || "-")}</td>
                <td>${rolEtiqueta}</td>
                <td>${escaparHtml(s.fecha_entrada || "-")}</td>
                <td>${escaparHtml(s.fecha_salida || "Sigue activa")}</td>
                <td>${escaparHtml(s.notas || "-")}</td>
            </tr>
        `;
    }).join("");
}

// ----------------------------------------------------------------------------
// CUENTA (cambiar clave)
// ----------------------------------------------------------------------------
export function renderizarCuenta() {
    const el = document.getElementById("cuenta-usuario-actual");
    if (el) {
        el.textContent = state.usuarioActual
            ? `${state.usuarioActual.usuario} · ${state.usuarioActual.rol}`
            : "";
    }
}

// ----------------------------------------------------------------------------
// TASAS
// ----------------------------------------------------------------------------
export function renderizarTasas() {
    const info = document.getElementById("tasa-info");
    if (info) {
        info.textContent = textoResumenTasas();
        info.title = `Fuente: ${state.tasas.fuente || "n/a"}`;
    }
    const select = document.getElementById("select-moneda");
    if (select && !select.dataset.init) {
        select.innerHTML = MONEDAS.map(m =>
            `<option value="${m.codigo}" ${m.codigo === state.moneda ? "selected" : ""}>${m.nombre} (${m.simbolo})</option>`
        ).join("");
        select.dataset.init = "1";
    }
}

export function inicializarSelectorMoneda() {
    const select = document.getElementById("select-moneda");
    if (!select) return;
    select.addEventListener("change", () => {
        state.moneda = select.value;
        renderizarTodo();
    });
}
