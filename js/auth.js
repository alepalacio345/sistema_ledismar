// ============================================================================
//  auth.js - INICIO DE SESION POR ROL (master | cajero)
// ============================================================================
//  Valida usuario y clave contra la tabla `lm_usuarios` de Supabase.
//  Lee el ROL para que la app sepa que puede hacer cada quien.
// ============================================================================

import { db } from "./config.js";
import { state } from "./state.js";
import { mostrarPantalla } from "./ui.js";
import { registrarEntradaSesion } from "./sesion.js";

export function inicializarAuth(alIniciarSesion) {
    document.getElementById("login-form").addEventListener("submit", async (e) => {
        e.preventDefault();

        const usuario = document.getElementById("login-usuario").value.trim();
        const clave = document.getElementById("login-clave").value.trim();
        const errorEl = document.getElementById("login-error");
        const btnEntrar = document.getElementById("btn-entrar");

        if (usuario.toLowerCase() === "salir") {
            mostrarPantalla("exit");
            return;
        }

        if (!db) {
            errorEl.textContent = "Configura primero tus credenciales de Supabase en js/config.js.";
            return;
        }

        btnEntrar.disabled = true;
        btnEntrar.textContent = "Validando...";
        errorEl.textContent = "";

        const { data, error } = await db
            .from("lm_usuarios")
            .select("usuario, rol, nombre, activo")
            .eq("usuario", usuario)
            .eq("clave", clave)
            .maybeSingle();

        btnEntrar.disabled = false;
        btnEntrar.textContent = "Iniciar sesion";

        if (error) {
            errorEl.textContent = `Error de conexion: ${error.message}`;
            return;
        }

        if (!data) {
            errorEl.textContent = "Usuario o clave incorrectos.";
            return;
        }

        if (data.activo === false) {
            errorEl.textContent = "Este usuario esta desactivado. Contacta a la administradora.";
            return;
        }

        state.usuarioActual = {
            usuario: data.usuario,
            rol: data.rol || "cajero",
            nombre: data.nombre || data.usuario,
        };

        document.getElementById("login-form").reset();
        mostrarPantalla("app");

        await alIniciarSesion();
        await registrarEntradaSesion();
    });

    document.getElementById("btn-salir-login").addEventListener("click", () => mostrarPantalla("exit"));
    document.getElementById("btn-volver-login").addEventListener("click", () => mostrarPantalla("login"));
}
