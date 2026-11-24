// ============================================================================
//  tasas.js - TASAS DE CAMBIO Y CONVERSION DE MONEDA
// ============================================================================
//  Obtiene la tasa del BCV (Bolivares) y los cruces de Euro/Rupia/Yuan, y
//  convierte/formatea montos. Los precios internos SIEMPRE estan en USD.
//
//  Fuentes:
//   * Bs (BCV): https://ve.dolarapi.com/v1/dolares/oficial  (espejo publico)
//   * EUR/INR/CNY + respaldo VES: https://open.er-api.com/v6/latest/USD
// ============================================================================

import { state } from "./state.js";

export const MONEDAS = [
    { codigo: "USD", simbolo: "$",  nombre: "Dolar (base)" },
    { codigo: "VES", simbolo: "Bs", nombre: "Bolivares (BCV)" },
    { codigo: "EUR", simbolo: "€",  nombre: "Euro" },
    { codigo: "INR", simbolo: "₹",  nombre: "Rupia" },
    { codigo: "CNY", simbolo: "¥",  nombre: "Yuan" },
];

export function obtenerMoneda(codigo) {
    return MONEDAS.find(m => m.codigo === codigo) || MONEDAS[0];
}

export function obtenerTasa(codigo) {
    if (codigo === "USD") return 1;
    const tasa = state.tasas[codigo];
    return (tasa === undefined || tasa === null) ? null : Number(tasa);
}

// Convierte un monto EN DOLARES a la moneda indicada.
export function convertirDesdeUsd(usd, codigo) {
    const base = Number(usd || 0);
    const tasa = obtenerTasa(codigo);
    if (codigo === "USD" || tasa === null) return base;
    return Number((base * tasa).toFixed(2));
}

// Convierte un monto en la moneda indicada DE VUELTA a dolares.
export function convertirAUsd(monto, codigo) {
    const base = Number(monto || 0);
    const tasa = obtenerTasa(codigo);
    if (codigo === "USD" || !tasa) return base;
    return Number((base / tasa).toFixed(2));
}

// Formatea un monto con simbolo y separadores (formato es-VE).
export function formatearMonto(monto, codigo) {
    const moneda = obtenerMoneda(codigo);
    const valor = Number(monto || 0).toLocaleString("es-VE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    return `${moneda.simbolo}${valor}`;
}

// Carga las tasas (BCV + cruces). Guarda todo en state.tasas.
export async function cargarTasas() {
    let tasaBcv = null;
    try {
        const r = await fetch("https://ve.dolarapi.com/v1/dolares/oficial");
        if (r.ok) {
            const d = await r.json();
            const p = Number(d && d.promedio);
            if (p > 0) tasaBcv = p;
        }
    } catch (e) {
        console.warn("No se pudo obtener la tasa BCV:", e);
    }

    let cruces = {};
    try {
        const r = await fetch("https://open.er-api.com/v6/latest/USD");
        if (r.ok) {
            const d = await r.json();
            if (d && d.result === "success" && d.rates) cruces = d.rates;
        }
    } catch (e) {
        console.warn("No se pudo obtener los cruces de cambio:", e);
    }

    const vesFinal = tasaBcv !== null ? tasaBcv : (cruces.VES ? Number(cruces.VES) : null);

    state.tasas = {
        USD: 1,
        VES: vesFinal,
        EUR: cruces.EUR ? Number(cruces.EUR) : null,
        INR: cruces.INR ? Number(cruces.INR) : null,
        CNY: cruces.CNY ? Number(cruces.CNY) : null,
        actualizado: new Date().toISOString(),
        fuente: tasaBcv !== null ? "BCV (espejo DolarAPI)" : "open.er-api.com",
    };

    return vesFinal !== null || cruces.EUR !== undefined;
}

export function textoResumenTasas() {
    const t = state.tasas;
    const partes = [];
    if (t.VES !== null) partes.push(`Bs${Number(t.VES).toFixed(2)}`);
    if (t.EUR !== null) partes.push(`€${Number(t.EUR).toFixed(2)}`);
    if (t.INR !== null) partes.push(`₹${Number(t.INR).toFixed(2)}`);
    if (t.CNY !== null) partes.push(`¥${Number(t.CNY).toFixed(2)}`);
    const resumen = partes.length ? partes.join(" · ") : "tasas no disponibles";
    const hora = t.actualizado
        ? new Date(t.actualizado).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })
        : "";
    return `${resumen}${hora ? ` (${hora})` : ""}`;
}
