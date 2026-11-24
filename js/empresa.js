// ============================================================================
//  empresa.js - DATOS DE LA EMPRESA + CAMBIO DE CLAVE
// ============================================================================
//  1) La administradora guarda la informacion de su negocio (rif, direccion,
//     correo, telefono, etc.). Se usa en los recibos PDF.
//  2) Cambio de clave: tanto la master como la cajera pueden cambiar su propia
//     clave desde "Mi Cuenta".
// ============================================================================

import { db } from "./config.js";
import { state } from "./state.js";
import { mostrarAlerta, renderizarTodo } from "./ui.js";

export async function cargarEmpresa() {
    const { data, error } = await db
        .from("lm_empresa")
        .select("nombre, rif, direccion, ciudad, telefono, correo, propietario, notas")
        .eq("id", 1)
        .maybeSingle();

    if (error) {
        console.warn("Error cargando empresa:", error.message);
        return false;
    }

    if (data) state.empresa = data;
    return true;
}

export function inicializarEmpresa() {
    document.getElementById("form-empresa").addEventListener("submit", async (e) => {
        e.preventDefault();

        const datos = {
            nombre: document.getElementById("emp-nombre").value.trim(),
            rif: document.getElementById("emp-rif").value.trim(),
            direccion: document.getElementById("emp-direccion").value.trim(),
            ciudad: document.getElementById("emp-ciudad").value.trim(),
            telefono: document.getElementById("emp-telefono").value.trim(),
            correo: document.getElementById("emp-correo").value.trim(),
            propietario: document.getElementById("emp-propietario").value.trim(),
            notas: document.getElementById("emp-notas").value.trim(),
        };

        if (!datos.nombre) return mostrarAlerta("Escribe el nombre del negocio.", "err");

        const { error } = await db.from("lm_empresa").update(datos).eq("id", 1);
        if (error) return mostrarAlerta(`Error guardando: ${error.message}`, "err");

        state.empresa = { ...state.empresa, ...datos };
        renderizarTodo();
        return mostrarAlerta("Datos del negocio guardados.", "ok");
    });

    // --- Cambio de clave (Mi Cuenta) ---
    document.getElementById("form-cuenta").addEventListener("submit", async (e) => {
        e.preventDefault();

        const actual = document.getElementById("cuenta-clave-actual").value;
        const nueva = document.getElementById("cuenta-clave-nueva").value;
        const confirmar = document.getElementById("cuenta-clave-confirmar").value;
        const usuario = state.usuarioActual?.usuario;

        if (!actual) return mostrarAlerta("Escribe tu clave actual.", "err");
        if (!nueva) return mostrarAlerta("Escribe la nueva clave.", "err");
        if (nueva.length < 4) return mostrarAlerta("La nueva clave debe tener al menos 4 caracteres.", "err");
        if (nueva !== confirmar) return mostrarAlerta("La nueva clave y su confirmacion no coinciden.", "err");

        // Verificamos la clave actual.
        const { data } = await db
            .from("lm_usuarios")
            .select("usuario")
            .eq("usuario", usuario)
            .eq("clave", actual)
            .maybeSingle();

        if (!data) return mostrarAlerta("La clave actual es incorrecta.", "err");

        const { error } = await db.from("lm_usuarios").update({ clave: nueva }).eq("usuario", usuario);
        if (error) return mostrarAlerta(`Error cambiando la clave: ${error.message}`, "err");

        e.target.reset();
        return mostrarAlerta("Clave cambiada correctamente.", "ok");
    });
}
