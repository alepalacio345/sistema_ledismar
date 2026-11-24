// ============================================================================
//  caja.js - MODULO DE DINERO / CAJA (ingresos y gastos)
// ============================================================================
//  El dinero del negocio:
//   * INGRESOS automaticos: cada venta registrada por la cajera crea un
//     ingreso con origen = 'venta' (no lo registras a mano).
//   * INGRESOS manuales (ventas manuales): dinero que entra por fuera del
//     sistema (ventas hechas a mano, etc.).
//   * GASTOS: lo que se paga (proveedor, sueldo, transporte, etc.).
//   * SALDO = ingresos - gastos.
//
//  Solo la ADMINISTRADORA (master) ve y usa este modulo.
// ============================================================================

import { db } from "./config.js";
import { state } from "./state.js";
import { obtenerTasa } from "./tasas.js";
import { mostrarAlerta, renderizarTodo } from "./ui.js";

const MOTIVOS_INGRESO = ["Venta manual", "Otro ingreso", "Otro"];
const MOTIVOS_GASTO = ["Proveedor", "Sueldo", "Transporte", "Servicios", "Alquiler", "Imprevistos", "Otro"];

export async function cargarCaja() {
    const { data, error } = await db
        .from("lm_caja")
        .select("id, tipo, origen, venta_id, nombre, motivo, moneda, monto, monto_usd, monto_bs, tasa, fecha, usuario")
        .order("creado_en", { ascending: false });

    if (error) {
        mostrarAlerta(`Error cargando la caja: ${error.message}`, "err");
        return false;
    }

    state.caja = (data || []).map(m => ({
        ...m,
        monto: Number(m.monto || 0),
        monto_usd: Number(m.monto_usd || 0),
        monto_bs: Number(m.monto_bs || 0),
    }));
    return true;
}

function obtenerFechaFormateada() {
    const d = new Date();
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function poblarMotivos() {
    const tipo = document.getElementById("caja-tipo").value;
    const lista = tipo === "gasto" ? MOTIVOS_GASTO : MOTIVOS_INGRESO;
    const select = document.getElementById("caja-motivo");
    select.innerHTML = lista.map(m => `<option value="${m}">${m}</option>`).join("");
    toggleMotivoOtro();
}

function toggleMotivoOtro() {
    const esOtro = document.getElementById("caja-motivo").value === "Otro";
    const grupo = document.getElementById("caja-motivo-otro-group");
    if (grupo) grupo.classList.toggle("hidden", !esOtro);
}

export function inicializarCaja() {
    document.getElementById("caja-tipo").addEventListener("change", poblarMotivos);
    document.getElementById("caja-motivo").addEventListener("change", toggleMotivoOtro);
    poblarMotivos();

    document.getElementById("btn-agregar-caja").addEventListener("click", async () => {
        const tipo = document.getElementById("caja-tipo").value;
        const nombre = document.getElementById("caja-nombre").value.trim().replace(/\|/g, " ");
        let motivo = document.getElementById("caja-motivo").value;
        const moneda = document.getElementById("caja-moneda").value;
        const monto = parseFloat(document.getElementById("caja-monto").value);

        if (motivo === "Otro") {
            const otro = document.getElementById("caja-motivo-otro").value.trim();
            if (!otro) return mostrarAlerta("Escribe el motivo personalizado.", "err");
            motivo = otro;
        }

        if (!nombre) return mostrarAlerta("Escribe el nombre (a quién / de qué es).", "err");
        if (isNaN(monto) || monto <= 0) return mostrarAlerta("Escribe un monto valido mayor que cero.", "err");

        const tasa = obtenerTasa("VES");
        let montoUsd, montoBs;
        if (moneda === "VES") {
            montoBs = Number(monto.toFixed(2));
            montoUsd = tasa ? Number((monto / tasa).toFixed(2)) : Number(monto.toFixed(2));
        } else {
            montoUsd = Number(monto.toFixed(2));
            montoBs = tasa ? Number((monto * tasa).toFixed(2)) : 0;
        }

        const nuevo = {
            tipo,
            origen: "manual",
            venta_id: null,
            nombre,
            motivo,
            moneda,
            monto: Number(monto.toFixed(2)),
            monto_usd: montoUsd,
            monto_bs: montoBs,
            tasa: tasa ?? 0,
            fecha: obtenerFechaFormateada(),
            usuario: state.usuarioActual?.usuario || "admin",
        };

        const { error } = await db.from("lm_caja").insert([nuevo]);
        if (error) return mostrarAlerta(`Error guardando: ${error.message}`, "err");

        document.getElementById("caja-nombre").value = "";
        document.getElementById("caja-monto").value = "";
        document.getElementById("caja-motivo-otro").value = "";
        await cargarCaja();
        renderizarTodo();
        return mostrarAlerta("Movimiento guardado en la caja.", "ok");
    });

    document.getElementById("tbody-caja").addEventListener("click", async (e) => {
        const btn = e.target.closest("button[data-action='del-caja']");
        if (!btn) return;
        const { error } = await db.from("lm_caja").delete().eq("id", btn.dataset.id);
        if (error) return mostrarAlerta(`Error eliminando: ${error.message}`, "err");
        await cargarCaja();
        renderizarTodo();
        mostrarAlerta("Movimiento eliminado de la caja.", "ok");
    });
}
