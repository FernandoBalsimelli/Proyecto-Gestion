import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const PLANTILLAS = {
  clasico: {
    nombre: 'Clásico',
    desc: 'Encabezado con logo, título a la derecha y tabla a rayas',
    color: '#16415e', tabla: 'striped', headerFill: true,
  },
  minimal: {
    nombre: 'Minimalista',
    desc: 'Sin rellenos, líneas finas y mucho aire',
    color: '#1e293b', tabla: 'plain', headerFill: false, lineaTitulo: true,
  },
  corporativo: {
    nombre: 'Corporativo',
    desc: 'Banda de color superior y tabla con cuadrícula',
    color: '#0f766e', tabla: 'grid', headerFill: true, bandaSuperior: true,
  },
  moderno: {
    nombre: 'Moderno',
    desc: 'Título dentro de una caja de color y totales destacados',
    color: '#4f46e5', tabla: 'striped', headerFill: true, tituloEnCaja: true,
  },
  elegante: {
    nombre: 'Elegante',
    desc: 'Barra lateral de color y tipografía serif',
    color: '#7c2d12', tabla: 'plain', headerFill: false, barraLateral: true, serif: true,
  },
};

export const hexToRgb = (hex) => {
  const n = parseInt(String(hex || '#16415e').replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const money = (n) => `$${(Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

/**
 * Genera el PDF. Devuelve el objeto jsPDF.
 * @param {'save'|'bloburl'} salida
 */
export function generarDocumentoPDF({
  config = {}, pdfCfg = {}, cliente = '', fecha = '', metodoPago = '',
  folio = null, conceptos = [], subtotal = 0, montoIva = 0, total = 0, incluirIva = false,
}, salida = 'save') {

  const P = PLANTILLAS[pdfCfg.plantilla] || PLANTILLAS.clasico;
  const ACENTO = hexToRgb(pdfCfg.color || P.color);
  const TEXTO = [70, 70, 70];
  const GRIS = [245, 246, 248];
  const FUENTE = P.serif ? 'times' : 'helvetica';

  const doc = new jsPDF();
  doc.setFont(FUENTE, 'normal');
  const titulo = (config.tituloDocumento || 'PRESUPUESTO').toUpperCase();

  /* ── Adornos ── */
  if (P.bandaSuperior) { doc.setFillColor(...ACENTO); doc.rect(0, 0, 210, 8, 'F'); }
  if (P.barraLateral)  { doc.setFillColor(...ACENTO); doc.rect(0, 0, 6, 297, 'F'); }

  const top = P.bandaSuperior ? 8 : 0;
  const izq = P.barraLateral ? 20 : 14;

  /* ── Encabezado ── */
  if (pdfCfg.mostrar_logo !== false && config.logo) {
    try { doc.addImage(config.logo, 'PNG', izq, top + 12, 30, 30, '', 'FAST'); } catch { /* logo inválido */ }
  } else {
    doc.setFontSize(18).setTextColor(...ACENTO).setFont(FUENTE, 'bold');
    doc.text(config.nombre || 'MI EMPRESA', izq, top + 25);
  }

  if (P.tituloEnCaja) {
    doc.setFillColor(...ACENTO);
    doc.roundedRect(118, top + 14, 78, 17, 3, 3, 'F');
    doc.setFontSize(19).setTextColor(255, 255, 255).setFont(FUENTE, 'bold');
    doc.text(titulo, 192, top + 26, { align: 'right' });
  } else {
    doc.setFontSize(26).setTextColor(...ACENTO).setFont(FUENTE, 'bold');
    doc.text(titulo, 196, top + 25, { align: 'right' });
    if (P.lineaTitulo) {
      doc.setDrawColor(...ACENTO).setLineWidth(0.8);
      doc.line(120, top + 29, 196, top + 29);
    }
  }

  if (config.especialidad) {
    doc.setFontSize(9).setTextColor(150, 150, 150).setFont(FUENTE, 'normal');
    doc.text(String(config.especialidad).toUpperCase(), 196, top + 34, { align: 'right' });
  }

  /* ── Cliente / folio ── */
  const infoY = top + 52;
  doc.setFontSize(11).setTextColor(...ACENTO).setFont(FUENTE, 'bold');
  doc.text('INFORMACIÓN DEL CLIENTE', izq, infoY);
  doc.setFontSize(9).setTextColor(...TEXTO).setFont(FUENTE, 'normal');
  doc.text(`Nombre:  ${cliente || 'Público en General'}`, izq, infoY + 7);

  doc.setFontSize(9).setFont(FUENTE, 'bold');
  doc.text(`${titulo}: N° ${folio ? String(folio).padStart(5, '0') : 'BORRADOR'}`, 196, infoY, { align: 'right' });
  doc.text(`FECHA: ${fecha}`, 196, infoY + 5, { align: 'right' });
  doc.text(`PAGO: ${String(metodoPago || '').toUpperCase()}`, 196, infoY + 10, { align: 'right' });

  /* ── Tabla ── */
  autoTable(doc, {
    startY: infoY + 23,
    margin: { left: izq, right: 14, bottom: 95 },
    head: [['DESCRIPCIÓN', 'CANT.', 'PRECIO', 'SUBTOTAL']],
    body: conceptos.map(c => [
      c.descripcion,
      c.cantidad,
      money(c.precio),
      money((Number(c.cantidad) || 0) * (Number(c.precio) || 0)),
    ]),
    theme: pdfCfg.tabla || P.tabla,
    styles: { font: FUENTE, fontSize: 9, cellPadding: 4, textColor: TEXTO },
    headStyles: P.headerFill
      ? { fillColor: ACENTO, textColor: [255, 255, 255], fontStyle: 'bold' }
      : { fillColor: [255, 255, 255], textColor: ACENTO, fontStyle: 'bold',
          lineWidth: { bottom: 0.5 }, lineColor: ACENTO },
    alternateRowStyles: { fillColor: GRIS },
    columnStyles: {
      0: { cellWidth: P.barraLateral ? 86 : 92 },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'right', cellWidth: 35 },
      3: { halign: 'right', cellWidth: 35 },
    },
    didDrawPage: (data) => {
      doc.setFontSize(8).setTextColor(...TEXTO).setFont(FUENTE, 'normal');
      doc.setDrawColor(220, 220, 220).setLineWidth(0.3);
      doc.line(izq, 280, 196, 280);
      const pie = [config.telefono, config.sitioWeb, config.direccion].filter(Boolean).join('   |   ');
      doc.text(pie, 105, 287, { align: 'center' });
      if (pdfCfg.mostrar_pagina !== false) {
        doc.text(`Página ${data.pageNumber}`, 196, 287, { align: 'right' });
      }
    },
  });

  /* ── Totales ── */
  const baseY = 210;
  doc.setFontSize(10).setTextColor(...TEXTO).setFont(FUENTE, 'normal');
  doc.text('Subtotal', 155, baseY, { align: 'right' });
  doc.text(money(subtotal), 196, baseY, { align: 'right' });

  let boxY = baseY + 6;
  if (incluirIva) {
    doc.text('IVA (16%)', 155, baseY + 7, { align: 'right' });
    doc.text(money(montoIva), 196, baseY + 7, { align: 'right' });
    boxY += 7;
  }

  doc.setFillColor(...ACENTO);
  doc.roundedRect(135, boxY - 5, 61, 9, 2, 2, 'F');
  doc.setTextColor(255, 255, 255).setFont(FUENTE, 'bold').setFontSize(10);
  doc.text('TOTAL', 140, boxY + 1);
  doc.text(money(total), 194, boxY + 1, { align: 'right' });

  /* ── Banco ── */
  if (pdfCfg.mostrar_banco !== false) {
    doc.setTextColor(...ACENTO).setFontSize(11).setFont(FUENTE, 'bold');
    doc.text('INFORMACIÓN DE PAGO', izq, baseY);
    doc.setFontSize(9).setTextColor(...TEXTO);
    [['Banco:', config.banco], ['Nombre:', config.cuentaNombre], ['Cuenta:', config.cuentaNumero]]
      .forEach(([et, val], i) => {
        doc.setFont(FUENTE, 'bold');   doc.text(et, izq, baseY + 7 + i * 6);
        doc.setFont(FUENTE, 'normal'); doc.text(String(val || '—'), izq + 21, baseY + 7 + i * 6);
      });
  }

  /* ── Términos ── */
  if (pdfCfg.mostrar_terminos !== false && config.condiciones) {
    const tY = 245;
    doc.setTextColor(...ACENTO).setFontSize(10).setFont(FUENTE, 'bold');
    doc.text('TÉRMINOS Y CONDICIONES', izq, tY);
    doc.setFontSize(8).setTextColor(100, 100, 100).setFont(FUENTE, 'normal');
    doc.text(doc.splitTextToSize(config.condiciones, 100), izq, tY + 6);
  }

  /* ── Firma ── */
  if (config.mostrar_firma && config.firma_base64) {
    try {
      doc.addImage(config.firma_base64, 'PNG', 135, 248, 50, 18, '', 'FAST');
      doc.setDrawColor(180, 180, 180).setLineWidth(0.3);
      doc.line(135, 268, 190, 268);
      doc.setFontSize(8).setTextColor(120, 120, 120).setFont(FUENTE, 'normal');
      doc.text('Firma autorizada', 162, 272, { align: 'center' });
    } catch { /* firma inválida */ }
  }

  if (salida === 'bloburl') return doc.output('bloburl');
  doc.save(`${titulo}_${cliente || 'General'}_${String(fecha).replace(/\//g, '-')}.pdf`);
  return doc;
}

/** Datos ficticios para la vista previa */
export const DEMO = {
  cliente: 'Juan Pérez Martínez',
  fecha: new Date().toLocaleDateString('es-MX'),
  metodoPago: 'Transferencia',
  folio: 1234,
  conceptos: [
    { cantidad: 1, descripcion: 'Instalación de centro de carga trifásico 100A con pastillas termomagnéticas', precio: 8500 },
    { cantidad: 12, descripcion: 'Contacto dúplex polarizado con tierra física', precio: 185 },
    { cantidad: 45, descripcion: 'Metro de cable THW calibre 12 AWG', precio: 32 },
    { cantidad: 3, descripcion: 'Luminaria LED empotrable 18W luz neutra', precio: 420 },
    { cantidad: 1, descripcion: 'Mano de obra y puesta en marcha del sistema', precio: 4200 },
  ],
  incluirIva: true,
};
DEMO.subtotal = DEMO.conceptos.reduce((a, c) => a + c.cantidad * c.precio, 0);
DEMO.montoIva = DEMO.subtotal * 0.16;
DEMO.total = DEMO.subtotal + DEMO.montoIva;