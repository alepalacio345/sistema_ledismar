// ============================================================================
//  pdf.js - GENERACION DE RECIBOS DE VENTA (jsPDF)
// ============================================================================
//  Genera el recibo PDF de una venta con:
//   * Encabezado con los datos de la EMPRESA (nombre, rif, direccion, telefono).
//   * Datos del comprador (nombre, cedula, direccion si es recibo formal).
//   * Tabla de productos vendidos.
//   * Resumen de pagos (metodos y montos).
//   * Total en USD y en bolivares.
// ============================================================================

import { formatearMonto, obtenerMoneda } from "./tasas.js";
import { escaparHtml, obtenerMetodo, parsearItemsDesdeDetalle } from "./ui.js";
import { state } from "./state.js";

function convertirConTasa(usd, moneda, tasa) {
    const base = Number(usd || 0);
    if (moneda === "USD" || !tasa) return base;
    return Number((base * Number(tasa)).toFixed(2));
}

function dibujarEncabezado(doc, titulo, id) {
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 32, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont(undefined, "bold");
    doc.text(titulo, 14, 15);
    doc.setFont(undefined, "normal");
    doc.setFontSize(10);
    doc.text("Sistema de Inventario y Ventas", 14, 23);
    doc.setFontSize(13);
    doc.setFont(undefined, "bold");
    doc.text(String(id), 196, 18, { align: "right" });
}

export function generarReciboVentaPDF(venta, itemsArray = null, pagosArray = null) {
    const items = itemsArray || parsearItemsDesdeDetalle(venta.detalle);
    const pagos = pagosArray || [];
    const empresa = state.empresa || {};
    const nombreComprador = venta.recibo_nombre || venta.cliente || "Sin nombre";
    const cedula = venta.recibo_cedula || venta.cedula || "N/A";
    const direccion = venta.recibo_direccion || "";

    if (window.jspdf && window.jspdf.jsPDF) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        dibujarEncabezado(doc, "RECIBO DE VENTA", venta.id);

        // --- Datos del negocio ---
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(11);
        doc.setFont(undefined, "bold");
        doc.text(String(empresa.nombre || "Bodega"), 105, 42, { align: "center" });
        doc.setFont(undefined, "normal");
        doc.setFontSize(9);
        let yNegocio = 47;
        if (empresa.rif) { doc.text(`RIF: ${empresa.rif}`, 105, yNegocio, { align: "center" }); yNegocio += 4; }
        if (empresa.direccion) { doc.text(`Direccion: ${empresa.direccion}`, 105, yNegocio, { align: "center" }); yNegocio += 4; }
        if (empresa.telefono) { doc.text(`Telefono: ${empresa.telefono}`, 105, yNegocio, { align: "center" }); yNegocio += 4; }
        if (empresa.correo) { doc.text(`Correo: ${empresa.correo}`, 105, yNegocio, { align: "center" }); yNegocio += 4; }

        // --- Recuadro del comprador ---
        let y = yNegocio + 3;
        doc.setDrawColor(203, 213, 225);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(14, y, 182, direccion ? 34 : 28, 2, 2, "FD");

        doc.setFontSize(9);
        doc.setFont(undefined, "bold");
        doc.text("Comprador:", 18, y + 6);
        doc.text("Cedula:", 18, y + 12);
        doc.text("Fecha:", 125, y + 6);
        doc.text("Cajera:", 125, y + 12);
        if (direccion) doc.text("Direccion:", 18, y + 18);

        doc.setFont(undefined, "normal");
        doc.text(String(nombreComprador), 42, y + 6);
        doc.text(String(cedula), 42, y + 12);
        doc.text(String(venta.fecha), 142, y + 6);
        doc.text(String(venta.cajero || "-"), 142, y + 12);
        if (direccion) {
            const dirLineas = doc.splitTextToSize(String(direccion), 120);
            doc.text(dirLineas.slice(0, 1), 42, y + 18);
        }

        // --- Tabla de productos ---
        let yTabla = y + (direccion ? 40 : 34);
        doc.setFillColor(226, 232, 240);
        doc.rect(14, yTabla - 6, 182, 9, "F");
        doc.setFont(undefined, "bold");
        doc.setFontSize(9);
        doc.text("ID", 17, yTabla);
        doc.text("Producto", 42, yTabla);
        doc.text("Cant.", 112, yTabla, { align: "right" });
        doc.text("P. Unit.", 148, yTabla, { align: "right" });
        doc.text("Subtotal", 192, yTabla, { align: "right" });

        doc.setFont(undefined, "normal");
        yTabla += 9;
        let totalUnidades = 0;

        items.forEach(item => {
            if (yTabla > 250) { doc.addPage(); yTabla = 20; }
            const cant = Number(item.cantidad) || 0;
            const subtotal = cant * Number(item.precio || 0);
            totalUnidades += cant;
            doc.text(String(item.id), 17, yTabla);
            doc.text(String(item.name).slice(0, 32), 42, yTabla);
            doc.text(String(cant), 112, yTabla, { align: "right" });
            doc.text(formatearMonto(item.precio, "USD"), 148, yTabla, { align: "right" });
            doc.text(formatearMonto(subtotal, "USD"), 192, yTabla, { align: "right" });
            doc.setDrawColor(226, 232, 240);
            doc.line(14, yTabla + 3, 196, yTabla + 3);
            yTabla += 9;
        });

        // --- Resumen de pagos ---
        if (pagos.length) {
            yTabla += 3;
            doc.setFont(undefined, "bold");
            doc.setFontSize(9);
            doc.text("Forma de pago:", 14, yTabla);
            doc.setFont(undefined, "normal");
            pagos.forEach(pg => {
                yTabla += 5;
                const metodo = obtenerMetodo(pg.metodo);
                let detalle = "";
                const d = pg.datos || {};
                if (pg.metodo === "punto" && d.referencia) detalle = ` · N° ${d.referencia}`;
                if (pg.metodo === "pago_movil" && d.referencia) detalle = ` · Ref ${d.referencia} · ${d.banco || ""}`;
                if (pg.metodo === "zelle" && d.cuenta) detalle = ` · ${d.cuenta}`;
                if (pg.metodo === "efectivo_usd" && d.serial) detalle = ` · Serial ${d.serial}`;
                doc.text(`${metodo.nombre}: ${formatearMonto(pg.monto, pg.moneda)}${detalle}`, 18, yTabla);
            });
        }

        // --- Total ---
        yTabla += 8;
        doc.setFontSize(9);
        doc.setFont(undefined, "normal");
        doc.text(`Total de articulos: ${totalUnidades}`, 14, yTabla + 4);
        doc.text(`Equivalente: ${formatearMonto(venta.total_bs || 0, "VES")}`, 14, yTabla + 11);

        doc.setFillColor(15, 23, 42);
        doc.roundedRect(126, yTabla - 3, 70, 12, 2, 2, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont(undefined, "bold");
        doc.text("TOTAL:", 131, yTabla + 5);
        doc.text(formatearMonto(venta.total_usd || 0, "USD"), 192, yTabla + 5, { align: "right" });

        doc.save(`Venta_${venta.id}.pdf`);
    } else {
        // Respaldo sin jsPDF.
        const filas = items.map(i => {
            const sub = (Number(i.cantidad) || 0) * Number(i.precio || 0);
            return `<tr><td>${escaparHtml(i.id)}</td><td>${escaparHtml(i.name)}</td><td>${escaparHtml(i.cantidad)}</td><td>${escaparHtml(formatearMonto(i.precio, "USD"))}</td><td>${escaparHtml(formatearMonto(sub, "USD"))}</td></tr>`;
        }).join("");
        const filasPagos = pagos.map(pg =>
            `<p><strong>${escaparHtml(obtenerMetodo(pg.metodo).nombre)}:</strong> ${escaparHtml(formatearMonto(pg.monto, pg.moneda))}</p>`
        ).join("");

        const ventana = window.open("", "_blank", "width=750,height=650");
        ventana.document.write(`
            <html><head><title>Venta ${escaparHtml(venta.id)}</title>
            <style>body{font-family:sans-serif;padding:24px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ccc;padding:8px;text-align:left}.total{text-align:right;margin-top:14px;font-size:1.2rem;font-weight:bold}</style>
            </head><body>
            <h2>RECIBO DE VENTA - ${escaparHtml(venta.id)}</h2>
            <p><strong>${escaparHtml(empresa.nombre || "")}</strong></p>
            <p><strong>Fecha:</strong> ${escaparHtml(venta.fecha)} | <strong>Cajera:</strong> ${escaparHtml(venta.cajero || "-")}</p>
            <p><strong>Comprador:</strong> ${escaparHtml(nombreComprador)} | <strong>Cedula:</strong> ${escaparHtml(cedula)}</p>
            ${direccion ? `<p><strong>Direccion:</strong> ${escaparHtml(direccion)}</p>` : ""}
            <table><thead><tr><th>ID</th><th>Producto</th><th>Cantidad</th><th>P. Unit.</th><th>Subtotal</th></tr></thead><tbody>${filas}</tbody></table>
            ${filasPagos}
            <p class="total">TOTAL: ${escaparHtml(formatearMonto(venta.total_usd || 0, "USD"))}</p>
            <script>window.print();<\/script></body></html>
        `);
        ventana.document.close();
    }
}
