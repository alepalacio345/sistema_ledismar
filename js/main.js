// ============================================================================
//  main.js - PUNTO DE ENTRADA DE LA APLICACION
// ============================================================================
//  Conecta Supabase, el login, los modulos y el boton de sincronizar.
// ============================================================================

import { iniciarSupabase } from "./config.js";
import { inicializarAuth } from "./auth.js";
import { cargarInventario, inicializarInventario } from "./inventario.js";
import { cargarVentas, cargarPagos, inicializarVentas } from "./ventas.js";
import { cargarCaja, inicializarCaja } from "./caja.js";
import { cargarCajeros, inicializarCajeros } from "./cajeros.js";
import { cargarEmpresa, inicializarEmpresa } from "./empresa.js";
import { cargarTasas } from "./tasas.js";
import { construirSidebar, cargarSesiones, inicializarSesion } from "./sesion.js";
import { mostrarAlerta, renderizarTodo, inicializarSelectorMoneda } from "./ui.js";

async function cargarDatosNube() {
    await cargarTasas();

    await Promise.all([
        cargarInventario(),
        cargarVentas(),
        cargarPagos(),
        cargarCaja(),
        cargarCajeros(),
        cargarEmpresa(),
        cargarSesiones(),
    ]);

    construirSidebar();
    renderizarTodo();
}

iniciarSupabase();
inicializarAuth(cargarDatosNube);

inicializarInventario();
inicializarVentas();
inicializarCaja();
inicializarCajeros();
inicializarEmpresa();
inicializarSesion();
inicializarSelectorMoneda();

document.getElementById("btn-sincronizar").addEventListener("click", async () => {
    await cargarDatosNube();
    mostrarAlerta("Datos y tasas de cambio actualizados desde la nube.", "ok");
});
