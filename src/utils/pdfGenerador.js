import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LIMITES } from './seguridad.js';

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

const HEX_RE = /^#[0-9a-f]{6}$/i;

export const hexToRgb = (hex) => {
  const limpio = HEX_RE.test(String(hex || '')) ? hex : '#16415e';
  const n = parseInt(limpio.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const money = (n) => `$${(Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

/**
 * Recorta texto para el PDF. Sin esto, una descripción de 5 000 caracteres
 * genera 40 páginas basura y jsPDF puede colgar el navegador.
 */
const corte = (v, max) => {
  const s = String(v ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
};

/** Nombre de archivo sin caracteres que rompan Windows/macOS. */
const nombreArchivoSeguro = (s) =>
  String(s || 'documento')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_\- ]/g, '')
    .trim().replace(/\s+/g, '_')
    .slice(0, 60) || 'documento';

/**
 * Genera el PDF.
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

  const titulo = corte(config.tituloDocumento || 'PRESUPUESTO', LIMITES.tituloDocumento).toUpperCase();

  // Tope duro de renglones: 60. Más allá el documento deja de ser legible.
  const filas = (Array.isArray(conceptos) ? conceptos : []).slice(0, LIMITES.maxConceptos);
  const recortados = (conceptos?.length || 0) - filas.length;

  /* ── Adornos ── */
  if (P.bandaSuperior) { doc.setFillColor(...ACENTO); doc.rect(0, 0, 210, 8, 'F'); }
  if (P.barraLateral)  { doc.setFillColor(...ACENTO); doc.rect(0, 0, 6, 297, 'F'); }

  const top = P.bandaSuperior ? 8 : 0;
  const izq = P.barraLateral ? 20 : 14;

  /* ── Encabezado ── */
  if (pdfCfg.mostrar_logo !== false && config.logo) {
    try { doc.addImage(config.logo, 'PNG', izq, top + 12, 30, 30, '', 'FAST'); }
    catch { /* logo corrupto: seguimos sin él */ }
  } else {
    doc.setFontSize(18).setTextColor(...ACENTO).setFont(FUENTE, 'bold');
    doc.text(corte(config.nombre || 'MI EMPRESA', LIMITES.nombreNegocio), izq, top + 25);
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
    doc.text(corte(config.especialidad, LIMITES.especialidad).toUpperCase(), 196, top + 34, { align: 'right' });
  }

  /* ── Cliente / folio ── */
  const infoY = top + 52;
  doc.setFontSize(11).setTextColor(...ACENTO).setFont(FUENTE, 'bold');
  doc.text('INFORMACIÓN DEL CLIENTE', izq, infoY);
  doc.setFontSize(9).setTextColor(...TEXTO).setFont(FUENTE, 'normal');
  doc.text(`Nombre:  ${corte(cliente || 'Público en General', LIMITES.nombre)}`, izq, infoY + 7);

  doc.setFontSize(9).setFont(FUENTE, 'bold');
  doc.text(`${titulo}: N° ${folio ? String(folio).padStart(5, '0') : 'BORRADOR'}`, 196, infoY, { align: 'right' });
  doc.text(`FECHA: ${corte(fecha, 20)}`, 196, infoY + 5, { align: 'right' });
  doc.text(`PAGO: ${corte(metodoPago, 20).toUpperCase()}`, 196, infoY + 10, { align: 'right' });

  /* ── Tabla ── */
  autoTable(doc, {
    startY: infoY + 23,
    margin: { left: izq, right: 14, bottom: 95 },
    head: [['DESCRIPCIÓN', 'CANT.', 'PRECIO', 'SUBTOTAL']],
    body: filas.map(c => [
      corte(c.descripcion, LIMITES.descripcionConcepto),
      Math.min(LIMITES.maxCantidad, Number(c.cantidad) || 0),
      money(c.precio),
      money((Number(c.cantidad) || 0) * (Number(c.precio) || 0)),
    ]),
    theme: pdfCfg.tabla || P.tabla,
    styles: { font: FUENTE, fontSize: 9, cellPadding: 4, textColor: TEXTO, overflow: 'linebreak' },
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
      const pie = corte(
        [config.telefono, config.sitioWeb, config.direccion].filter(Boolean).join('   |   '),
        150
      );
      doc.text(pie, 105, 287, { align: 'center' });
      if (pdfCfg.mostrar_pagina !== false) {
        doc.text(`Página ${data.pageNumber}`, 196, 287, { align: 'right' });
      }
    },
  });

  if (recortados > 0) {
    doc.setFontSize(8).setTextColor(150, 150, 150).setFont(FUENTE, 'italic');
    doc.text(`(+${recortados} concepto(s) no mostrados: el documento admite ${LIMITES.maxConceptos} renglones)`,
      izq, doc.lastAutoTable.finalY + 5);
  }

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
    [
      ['Banco:',  corte(config.banco, LIMITES.banco)],
      ['Nombre:', corte(config.cuentaNombre, LIMITES.cuentaNombre)],
      ['Cuenta:', corte(config.cuentaNumero, LIMITES.cuentaNumero)],
    ].forEach(([et, val], i) => {
      doc.setFont(FUENTE, 'bold');   doc.text(et, izq, baseY + 7 + i * 6);
      doc.setFont(FUENTE, 'normal'); doc.text(val || '—', izq + 21, baseY + 7 + i * 6);
    });
  }

  /* ── Términos ── */
  if (pdfCfg.mostrar_terminos !== false && config.condiciones) {
    const tY = 245;
    doc.setTextColor(...ACENTO).setFontSize(10).setFont(FUENTE, 'bold');
    doc.text('TÉRMINOS Y CONDICIONES', izq, tY);
    doc.setFontSize(8).setTextColor(100, 100, 100).setFont(FUENTE, 'normal');
    // Máximo 6 líneas: lo que cabe sin invadir la firma ni el pie.
    const lineas = doc.splitTextToSize(corte(config.condiciones, LIMITES.condiciones), 100).slice(0, 6);
    doc.text(lineas, izq, tY + 6);
  }

  /* ── Firma ── */
  if (config.mostrar_firma && config.firma_base64) {
    try {
      doc.addImage(config.firma_base64, 'PNG', 135, 248, 50, 18, '', 'FAST');
      doc.setDrawColor(180, 180, 180).setLineWidth(0.3);
      doc.line(135, 268, 190, 268);
      doc.setFontSize(8).setTextColor(120, 120, 120).setFont(FUENTE, 'normal');
      doc.text('Firma autorizada', 162, 272, { align: 'center' });
    } catch { /* firma corrupta */ }
  }

  if (salida === 'bloburl') return doc.output('bloburl');
  doc.save(`${nombreArchivoSeguro(titulo)}_${nombreArchivoSeguro(cliente || 'General')}_${nombreArchivoSeguro(fecha)}.pdf`);
  return doc;
}

/** Datos ficticios para la vista previa */
export const DEMO = {
  cliente: 'Juan Pérez Martínez',
  fecha: new Date().toLocaleDateString('es-MX'),
  metodoPago: 'Transferencia',
  folio: 1234,
  conceptos: [
    { cantidad: 1,  descripcion: 'Instalación de centro de carga trifásico 100A con pastillas termomagnéticas', precio: 8500 },
    { cantidad: 12, descripcion: 'Contacto dúplex polarizado con tierra física', precio: 185 },
    { cantidad: 45, descripcion: 'Metro de cable THW calibre 12 AWG', precio: 32 },
    { cantidad: 3,  descripcion: 'Luminaria LED empotrable 18W luz neutra', precio: 420 },
    { cantidad: 1,  descripcion: 'Mano de obra y puesta en marcha del sistema', precio: 4200 },
  ],
  incluirIva: true,
};
DEMO.subtotal = DEMO.conceptos.reduce((a, c) => a + c.cantidad * c.precio, 0);
DEMO.montoIva = DEMO.subtotal * 0.16;
DEMO.total = DEMO.subtotal + DEMO.montoIva;