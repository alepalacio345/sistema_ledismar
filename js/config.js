// ============================================================================
//  config.js - CONEXION A SUPABASE
// ============================================================================
//  Aqui estan las credenciales del proyecto Supabase.
//
//  Por defecto reutiliza el MISMO proyecto de "familia-palacio" (asi no tienes
//  que crear otro), pero con tablas NUEVAS de prefijo "lm_" para no chocar.
//  Si quieres usar OTRO proyecto de Supabase, cambia las dos lineas de abajo
//  por las de tu nuevo proyecto (Dashboard -> Settings -> API).
// ============================================================================

export const SUPABASE_URL = "https://cjbaxncmjcjgmbzqphae.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_17Z8DcS6CxTILkDskdmEcw_YCmDc2lJ";

export let db = null;

// ----------------------------------------------------------------------------
//  iniciarSupabase()
//  Crea el cliente de Supabase y avisa en la pantalla de login si hay error.
// ----------------------------------------------------------------------------
export function iniciarSupabase() {
    const badge = document.getElementById("status-nube-login");
    const sinConfigurar =
        SUPABASE_URL.includes("TU-PROYECTO") ||
        SUPABASE_ANON_KEY.includes("TU-ANON-KEY");

    if (sinConfigurar || !window.supabase) {
        badge.textContent = "Error: verifica las credenciales en js/config.js";
        return false;
    }

    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    badge.textContent = "Conectado a Supabase";
    badge.classList.add("connected");
    return true;
}
