// ============================================================================
//  cajeros.js - GESTION DE CAJERAS / VENDEDORAS (solo master)
// ============================================================================
//  La administradora crea, edita (cambia clave), activa/desactiva y elimina
//  las cajeras. Solo la master puede hacer esto.
// ============================================================================

import { db } from "./config.js";
import { state } from "./state.js";
import { mostrarAlerta, renderizarTodo, mostrarModal } from "./ui.js";

let cajeroEditando = null;

export async function cargarCajeros() {
    const { data, error } = await db
        .from("lm_usuarios")
        .select("usuario, clave, rol, nombre, activo, creado_en")
        .order("creado_en", { ascending: true });

    if (error) {
        mostrarAlerta(`Error cargando cajeras: ${error.message}`, "err");
        return false;
    }

    state.cajeros = data || [];
    return true;
}

function salirModoEdicionCajero() {
    cajeroEditando = null;
    document.getElementById("form-cajero").reset();
    document.getElementById("cajero-usuario").disabled = false;
    document.getElementById("titulo-form-cajero").textContent = "Crear Cajera";
    document.getElementById("btn-guardar-cajero").textContent = "Crear Cajera";
}

function cargarEnFormulario(usuario) {
    const c = state.cajeros.find(x => x.usuario === usuario);
    if (!c) return;
    cajeroEditando = usuario;
    document.getElementById("cajero-usuario").value = c.usuario;
    document.getElementById("cajero-usuario").disabled = true;
    document.getElementById("cajero-nombre").value = c.nombre || "";
    document.getElementById("cajero-clave").value = "";
    document.getElementById("cajero-clave-confirmar").value = "";
    document.getElementById("titulo-form-cajero").textContent = `Cambiar clave de ${c.usuario}`;
    document.getElementById("btn-guardar-cajero").textContent = "Guardar nueva clave";
    document.getElementById("form-cajero").scrollIntoView({ behavior: "smooth", block: "center" });
}

async function eliminarCajero(usuario) {
    const c = state.cajeros.find(x => x.usuario === usuario);
    mostrarModal({
        titulo: `Eliminar cajera ${usuario}`,
        texto: `¿Seguro que quieres eliminar a "${c?.nombre || usuario}"? No podrá volver a entrar al sistema.`,
        botones: [
            { texto: "Sí, eliminar", clase: "btn-danger", onClick: () => confirmarEliminarCajero(usuario) },
            { texto: "Cancelar", clase: "btn-outline", onClick: () => {} },
        ],
    });
}

async function confirmarEliminarCajero(usuario) {
    const { error } = await db.from("lm_usuarios").delete().eq("usuario", usuario);
    if (error) return mostrarAlerta(`Error eliminando: ${error.message}`, "err");
    await cargarCajeros();
    renderizarTodo();
    mostrarAlerta(`Cajera ${usuario} eliminada.`, "ok");
}

async function toggleCajero(usuario) {
    const c = state.cajeros.find(x => x.usuario === usuario);
    if (!c) return;
    const nuevoActivo = c.activo === false;
    const { error } = await db.from("lm_usuarios").update({ activo: nuevoActivo }).eq("usuario", usuario);
    if (error) return mostrarAlerta(`Error actualizando: ${error.message}`, "err");
    await cargarCajeros();
    renderizarTodo();
    mostrarAlerta(nuevoActivo ? `Cajera ${usuario} activada.` : `Cajera ${usuario} desactivada.`, "ok");
}

export function inicializarCajeros() {
    document.getElementById("form-cajero").addEventListener("submit", async (e) => {
        e.preventDefault();

        const usuario = document.getElementById("cajero-usuario").value.trim().replace(/\s+/g, "");
        const nombre = document.getElementById("cajero-nombre").value.trim();
        const clave = document.getElementById("cajero-clave").value;
        const confirmar = document.getElementById("cajero-clave-confirmar").value;

        // --- Editando (cambiar clave) ---
        if (cajeroEditando) {
            if (!clave) return mostrarAlerta("Escribe la nueva clave.", "err");
            if (clave.length < 4) return mostrarAlerta("La clave debe tener al menos 4 caracteres.", "err");
            if (clave !== confirmar) return mostrarAlerta("Las claves no coinciden.", "err");

            const { error } = await db.from("lm_usuarios").update({ clave, nombre }).eq("usuario", cajeroEditando);
            if (error) return mostrarAlerta(`Error actualizando: ${error.message}`, "err");

            salirModoEdicionCajero();
            await cargarCajeros();
            renderizarTodo();
            return mostrarAlerta(`Clave de ${cajeroEditando} actualizada.`, "ok");
        }

        // --- Crear nueva ---
        if (!usuario) return mostrarAlerta("Escribe el usuario de la cajera.", "err");
        if (!nombre) return mostrarAlerta("Escribe el nombre real de la cajera.", "err");
        if (!clave) return mostrarAlerta("Escribe la clave de la cajera.", "err");
        if (clave.length < 4) return mostrarAlerta("La clave debe tener al menos 4 caracteres.", "err");
        if (clave !== confirmar) return mostrarAlerta("Las claves no coinciden.", "err");

        if (state.cajeros.some(c => c.usuario === usuario)) {
            return mostrarAlerta(`Ya existe un usuario llamado ${usuario}.`, "err");
        }

        const { error } = await db.from("lm_usuarios").insert([{
            usuario, clave, rol: "cajero", nombre, activo: true,
        }]);
        if (error) return mostrarAlerta(`No se pudo crear: ${error.message}`, "err");

        e.target.reset();
        await cargarCajeros();
        renderizarTodo();
        return mostrarAlerta(`Cajera ${nombre} (${usuario}) creada.`, "ok");
    });

    document.getElementById("tbody-cajeros").addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-action]");
        if (!btn) return;
        const usuario = btn.dataset.usuario;
        if (btn.dataset.action === "edit-cajero") cargarEnFormulario(usuario);
        else if (btn.dataset.action === "toggle-cajero") toggleCajero(usuario);
        else if (btn.dataset.action === "del-cajero") eliminarCajero(usuario);
    });
}
