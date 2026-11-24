// ============================================================================
//  inventario.js - GESTION DEL INVENTARIO (solo master)
// ============================================================================
//  Registra, edita y elimina productos con CATEGORIA y UNIDAD de medida.
//  El PRECIO se guarda en USD (base).
// ============================================================================

import { db } from "./config.js";
import { state } from "./state.js";
import { mostrarAlerta, renderizarTodo, renderizarInventario, renderizarProductosLectura, mostrarModal, UNIDADES, CATEGORIAS } from "./ui.js";
import { esMaster } from "./sesion.js";

export async function cargarInventario() {
    const { data, error } = await db
        .from("lm_productos")
        .select("id, name, categoria, unidad, cantidad, precio, stock_min")
        .order("id", { ascending: true });

    if (error) {
        mostrarAlerta(`Error cargando inventario: ${error.message}`, "err");
        return false;
    }

    state.inventario = (data || []).map(p => ({
        id: p.id,
        name: p.name,
        categoria: p.categoria || "Otros",
        unidad: p.unidad || "unidad",
        cantidad: Number(p.cantidad || 0),
        precio: Number(p.precio || 0),
        stock_min: Number(p.stock_min || 0),
    }));

    return true;
}

function activarModoEdicion(id) {
    if (!esMaster()) return;
    const prod = state.inventario.find(p => p.id === id);
    if (!prod) return;

    state.idEditando = prod.id;

    const inputId = document.getElementById("prod-id");
    inputId.value = prod.id;
    inputId.disabled = true;

    document.getElementById("prod-nombre").value = prod.name;
    document.getElementById("prod-categoria").value = prod.categoria || "Otros";
    document.getElementById("prod-unidad").value = prod.unidad || "unidad";
    document.getElementById("prod-cantidad").value = prod.cantidad;
    document.getElementById("prod-precio").value = prod.precio;

    document.getElementById("titulo-form-producto").textContent = `Editando Producto (${prod.id})`;
    document.getElementById("btn-guardar-producto").textContent = "Actualizar Producto";
    document.getElementById("btn-cancelar-edicion").classList.remove("hidden");
    document.getElementById("card-producto").classList.add("edit-mode");
    document.getElementById("card-producto").scrollIntoView({ behavior: "smooth", block: "center" });
}

function salirModoEdicion() {
    state.idEditando = null;
    document.getElementById("form-producto").reset();
    document.getElementById("prod-id").disabled = false;
    document.getElementById("titulo-form-producto").textContent = "Registrar Producto";
    document.getElementById("btn-guardar-producto").textContent = "Guardar en la Nube";
    document.getElementById("btn-cancelar-edicion").classList.add("hidden");
    document.getElementById("card-producto").classList.remove("edit-mode");
}

function eliminarProducto(id) {
    if (!esMaster()) return;
    const prod = state.inventario.find(p => p.id === id);
    mostrarModal({
        titulo: `Eliminar producto ${id}`,
        texto: `¿Seguro que quieres eliminar "${prod ? prod.name : id}"?\n\nEsta accion no se puede deshacer.`,
        botones: [
            { texto: "Sí, eliminar", clase: "btn-danger", onClick: () => confirmarEliminar(id) },
            { texto: "Cancelar", clase: "btn-outline", onClick: () => {} },
        ],
    });
}

async function confirmarEliminar(id) {
    const { error } = await db.from("lm_productos").delete().eq("id", id);
    if (error) {
        mostrarAlerta(`Error al eliminar: ${error.message}`, "err");
        return;
    }
    if (state.idEditando === id) salirModoEdicion();
    state.listaVenta = state.listaVenta.filter(item => item.id !== id);
    await cargarInventario();
    renderizarTodo();
    mostrarAlerta(`Producto ${id} eliminado.`, "ok");
}

export function inicializarInventario() {
    // --- Llenar select de unidades y datalist de categorias ---
    const selUnidad = document.getElementById("prod-unidad");
    if (selUnidad) {
        selUnidad.innerHTML = UNIDADES.map(u =>
            `<option value="${u.codigo}">${u.nombre} (${u.simbolo})</option>`
        ).join("");
    }
    const datalistCat = document.getElementById("lista-categorias");
    if (datalistCat) {
        datalistCat.innerHTML = CATEGORIAS.map(c => `<option value="${c}">`).join("");
    }

    // --- Busqueda en vivo (admin) ---
    const inputBusqueda = document.getElementById("buscar-inventario");
    if (inputBusqueda) {
        inputBusqueda.addEventListener("input", () => {
            state.busquedaInventario = inputBusqueda.value;
            renderizarInventario();
        });
    }
    const filtroCat = document.getElementById("filtro-categoria-inv");
    if (filtroCat) {
        filtroCat.addEventListener("input", () => {
            state.filtroCategoriaInventario = filtroCat.value;
            renderizarInventario();
        });
    }

    // --- Busqueda de la CAJERA (solo lectura) ---
    const buscarProd = document.getElementById("buscar-productos");
    if (buscarProd) {
        buscarProd.addEventListener("input", () => {
            state.busquedaInventario = buscarProd.value;
            renderizarProductosLectura();
        });
    }
    const filtroCatProd = document.getElementById("filtro-categoria-prod");
    if (filtroCatProd) {
        filtroCatProd.addEventListener("input", () => {
            state.filtroCategoriaInventario = filtroCatProd.value;
            renderizarProductosLectura();
        });
    }

    // --- Guardar producto nuevo o actualizar ---
    document.getElementById("form-producto").addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!esMaster()) return;

        const id = document.getElementById("prod-id").value.trim().replace(/\s+/g, "");
        const name = document.getElementById("prod-nombre").value.trim().replace(/\s+/g, "_");
        const categoria = document.getElementById("prod-categoria").value.trim() || "Otros";
        const unidad = document.getElementById("prod-unidad").value;
        const cantidad = parseFloat(document.getElementById("prod-cantidad").value);
        const precio = parseFloat(document.getElementById("prod-precio").value);

        if (!id) return mostrarAlerta("Escribe el ID/codigo del producto.", "err");
        if (!name) return mostrarAlerta("Escribe el nombre del producto.", "err");
        if (isNaN(cantidad) || cantidad < 0) return mostrarAlerta("La cantidad debe ser un numero valido (0 o mayor).", "err");
        if (isNaN(precio) || precio < 0) return mostrarAlerta("El precio debe ser un numero valido (0 o mayor).", "err");

        // Editar
        if (state.idEditando) {
            const { error } = await db.from("lm_productos")
                .update({ name, categoria, unidad, cantidad, precio })
                .eq("id", state.idEditando);
            if (error) return mostrarAlerta(`Error actualizando: ${error.message}`, "err");

            state.listaVenta = state.listaVenta
                .map(item => item.id !== state.idEditando ? item : { ...item, name, precio, cantidad: Math.min(item.cantidad, cantidad) })
                .filter(item => item.cantidad > 0);

            const idEditado = state.idEditando;
            salirModoEdicion();
            await cargarInventario();
            renderizarTodo();
            return mostrarAlerta(`Producto ${idEditado} actualizado.`, "ok");
        }

        // Nuevo
        if (state.inventario.some(p => p.id === id)) {
            return mostrarAlerta(`Ya existe un producto con el ID ${id}.`, "err");
        }

        const { error } = await db.from("lm_productos")
            .insert([{ id, name, categoria, unidad, cantidad, precio }]);
        if (error) return mostrarAlerta(`No se pudo guardar: ${error.message}`, "err");

        e.target.reset();
        await cargarInventario();
        renderizarTodo();
        return mostrarAlerta(`Producto ${name} (${id}) guardado.`, "ok");
    });

    document.getElementById("btn-cancelar-edicion").addEventListener("click", salirModoEdicion);

    // --- Botones Editar / Eliminar ---
    document.getElementById("tbody-inventario").addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-action]");
        if (!btn) return;
        if (btn.dataset.action === "edit-inv") activarModoEdicion(btn.dataset.id);
        else if (btn.dataset.action === "del-inv") eliminarProducto(btn.dataset.id);
    });
}
