// ============================================================================
//  sesion.js - ROLES, PERMISOS, SIDEBAR Y REGISTRO DE SESIONES
// ============================================================================
//  Maneja "quien esta usando el sistema" (master o cajero), construye el menu
//  lateral segun el rol y registra entradas/salidas en `lm_sesiones`.
// ============================================================================

import { db } from "./config.js";
import { state } from "./state.js";
import { mostrarPantalla, mostrarAlerta } from "./ui.js";

// --- Funciones rapidas de rol ---
export function esMaster() {
    return state.usuarioActual && state.usuarioActual.rol === "master";
}
export function esCajero() {
    return state.usuarioActual && state.usuarioActual.rol !== "master";
}

// --- Menu lateral: cada rol ve SOLO sus modulos ---
const ITEMS_MENU = [
    { panel: "panel-inventario",   texto: "Inventario",        icono: "📦", roles: ["master"] },
    { panel: "panel-empresa",      texto: "Mi Negocio",        icono: "🏪", roles: ["master"] },
    { panel: "panel-ventas",       texto: "Ventas",            icono: "🧾", roles: ["master"] },
    { panel: "panel-caja",         texto: "Caja / Dinero",     icono: "💰", roles: ["master"] },
    { panel: "panel-cajeros",      texto: "Cajeras",           icono: "👥", roles: ["master"] },
    { panel: "panel-sesiones",     texto: "Accesos (Sesiones)", icono: "🕒", roles: ["master"] },
    { panel: "panel-cuenta",       texto: "Mi Cuenta",         icono: "🔐", roles: ["master"] },
    { panel: "panel-productos",    texto: "Productos",         icono: "📦", roles: ["cajero"] },
    { panel: "panel-registrar-venta", texto: "Registrar Venta", icono: "🛒", roles: ["cajero"] },
    { panel: "panel-mis-ventas",   texto: "Mis Ventas",        icono: "🧾", roles: ["cajero"] },
];

// ----------------------------------------------------------------------------
// construirSidebar()
// Dibuja el menu lateral segun el rol del usuario actual.
// ----------------------------------------------------------------------------
export function construirSidebar() {
    const nav = document.getElementById("sidebar-nav");
    if (!nav) return;

    const rol = state.usuarioActual?.rol || "cajero";

    const infoUsuario = document.getElementById("sidebar-usuario");
    if (infoUsuario) {
        const nombre = state.usuarioActual?.nombre || state.usuarioActual?.usuario || "Usuario";
        infoUsuario.textContent = `${nombre} · ${rol}`;
    }

    const permitidos = ITEMS_MENU.filter(item => item.roles.includes(rol));

    nav.innerHTML = permitidos.map(item => `
        <button class="nav-item" data-panel="${item.panel}">
            <span class="nav-icono">${item.icono}</span>
            <span>${item.texto}</span>
        </button>
    `).join("");

    nav.querySelectorAll(".nav-item").forEach(btn => {
        btn.addEventListener("click", () => {
            mostrarPanel(btn.dataset.panel);
            cerrarSidebar();
        });
    });

    const primero = permitidos[0]?.panel || "panel-productos";
    mostrarPanel(primero);
}

export function mostrarPanel(id) {
    document.querySelectorAll(".panel").forEach(p => p.classList.add("hidden"));
    const objetivo = document.getElementById(id);
    if (objetivo) objetivo.classList.remove("hidden");

    document.querySelectorAll(".nav-item").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.panel === id);
    });
}

export function abrirSidebar() {
    document.getElementById("sidebar")?.classList.add("open");
    document.getElementById("overlay-sidebar")?.classList.add("visible");
}
export function cerrarSidebar() {
    document.getElementById("sidebar")?.classList.remove("open");
    document.getElementById("overlay-sidebar")?.classList.remove("visible");
}

// --- Registro de sesiones ---
function fechaActual() {
    const ahora = new Date();
    return `${ahora.toLocaleDateString("es-VE")} ${ahora.toLocaleTimeString("es-VE")}`;
}

export async function registrarEntradaSesion() {
    if (!state.usuarioActual || !db) return;
    const { error } = await db.from("lm_sesiones").insert([{
        usuario: state.usuarioActual.usuario,
        rol: state.usuarioActual.rol,
        fecha_entrada: fechaActual(),
        fecha_salida: null,
        notas: "",
    }]);
    if (error) {
        mostrarAlerta(`No se pudo registrar tu entrada (${error.message}). Revisa RLS de 'lm_sesiones'.`, "err");
        console.warn("No se pudo registrar entrada:", error.message);
    }
}

export async function registrarSalidaSesion() {
    if (!state.usuarioActual || !db) return;
    const { error } = await db
        .from("lm_sesiones")
        .update({ fecha_salida: fechaActual() })
        .eq("usuario", state.usuarioActual.usuario)
        .is("fecha_salida", null);
    if (error) console.warn("No se pudo registrar salida:", error.message);
}

export async function cerrarSesion() {
    await registrarSalidaSesion();
    state.usuarioActual = null;
    state.listaVenta = [];
    state.pagosEnCurso = [];
    mostrarPantalla("exit");
}

export async function cargarSesiones() {
    if (!db) return false;
    const { data, error } = await db
        .from("lm_sesiones")
        .select("id, usuario, rol, fecha_entrada, fecha_salida, notas")
        .order("id", { ascending: false });

    if (error) {
        if (esMaster()) mostrarAlerta(`No se pudo cargar sesiones: ${error.message}`, "err");
        console.warn("Error cargando sesiones:", error.message);
        return false;
    }
    state.sesiones = data || [];
    return true;
}

export function inicializarSesion() {
    document.getElementById("btn-menu")?.addEventListener("click", abrirSidebar);
    document.getElementById("overlay-sidebar")?.addEventListener("click", cerrarSidebar);
    document.getElementById("btn-cerrar-sesion")?.addEventListener("click", () => {
        cerrarSesion().then(() => mostrarAlerta("Sesion finalizada.", "ok"));
    });
}
