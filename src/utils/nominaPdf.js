import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const money = (n) => `$${(Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

export function generarReciboPDF({ config = {}, empleado, recibo, periodo }) {
  const doc = new jsPDF();
  const ACENTO = [37, 99, 235];
  const TEXTO = [55, 65, 81];

  // ── Encabezado empresa ──
  let xLogo = 14;
  if (config.logo) {
    try { doc.addImage(config.logo, 'PNG', 14, 10, 25, 25, '', 'FAST'); xLogo = 44; } catch {}
  }

  doc.setFontSize(14).setTextColor(...ACENTO).setFont('helvetica', 'bold');
  doc.text(config.nombre || 'EMPRESA', xLogo, 20);
  doc.setFontSize(8).setTextColor(120, 120, 120).setFont('helvetica', 'normal');
  doc.text(config.direccion || '', xLogo, 26);
  doc.text(`RFC: ${config.rfc || 'N/A'} | Tel: ${config.telefono || ''}`, xLogo, 31);

  // ── Título ──
  doc.setFillColor(...ACENTO);
  doc.roundedRect(120, 10, 76, 14, 2, 2, 'F');
  doc.setFontSize(12).setTextColor(255, 255, 255).setFont('helvetica', 'bold');
  doc.text('RECIBO DE NÓMINA', 158, 19, { align: 'center' });

  // ── Periodo ──
  doc.setFontSize(9).setTextColor(...TEXTO).setFont('helvetica', 'bold');
  doc.text(`Periodo: ${periodo.fecha_inicio} al ${periodo.fecha_fin}`, 196, 32, { align: 'right' });
  doc.text(`Tipo: ${(periodo.tipo || 'semanal').toUpperCase()}`, 196, 37, { align: 'right' });

  // ── Datos del empleado ──
  const yEmp = 48;
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(14, yEmp - 4, 182, 28, 2, 2, 'F');

  doc.setFontSize(10).setTextColor(...ACENTO).setFont('helvetica', 'bold');
  doc.text('DATOS DEL TRABAJADOR', 18, yEmp + 2);

  doc.setFontSize(9).setTextColor(...TEXTO).setFont('helvetica', 'normal');
  doc.text(`Nombre: ${empleado.nombre}`, 18, yEmp + 9);
  doc.text(`Puesto: ${empleado.puesto || 'N/A'}`, 110, yEmp + 9);
  doc.text(`CURP: ${empleado.curp || 'N/A'}`, 18, yEmp + 14);
  doc.text(`NSS: ${empleado.nss || 'N/A'}`, 110, yEmp + 14);
  doc.text(`Fecha ingreso: ${empleado.fecha_ingreso}`, 18, yEmp + 19);
  doc.text(`Salario diario: ${money(empleado.salario_diario)}`, 110, yEmp + 19);

  // ── Tabla PERCEPCIONES ──
  const yTabla = yEmp + 34;

  const filasPerc = [
    [`Salario base (${recibo.dias_trabajados} días)`, money(recibo.salario_base)],
    ['Séptimo día (descanso proporcional)', money(recibo.septimo_dia)],
  ];
  if (recibo.pago_horas_extra > 0) filasPerc.push(['Horas extra', money(recibo.pago_horas_extra)]);
  if (recibo.bonos > 0) filasPerc.push([recibo.bono_descripcion || 'Bonos', money(recibo.bonos)]);
  filasPerc.push([
    { content: 'TOTAL PERCEPCIONES', styles: { fontStyle: 'bold', textColor: [16, 185, 129] } },
    { content: money(recibo.total_percepciones), styles: { fontStyle: 'bold', textColor: [16, 185, 129] } },
  ]);

  autoTable(doc, {
    startY: yTabla,
    margin: { left: 14, right: 14 },
    head: [['PERCEPCIONES', 'IMPORTE']],
    body: filasPerc,
    theme: 'striped',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 3.5, textColor: TEXTO },
    headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 130 }, 1: { halign: 'right', cellWidth: 52 } },
  });

  // ── Tabla DEDUCCIONES ──
  const yDed = doc.lastAutoTable.finalY + 6;
  const filasDed = [];
  if (recibo.deduccion_imss > 0) filasDed.push(['IMSS (cuota obrera)', money(recibo.deduccion_imss)]);
  if (recibo.deduccion_isr > 0) filasDed.push(['ISR (Impuesto Sobre la Renta)', money(recibo.deduccion_isr)]);
  if (recibo.deduccion_infonavit > 0) filasDed.push(['Infonavit', money(recibo.deduccion_infonavit)]);
  if (recibo.otras_deducciones > 0) filasDed.push([recibo.otras_deducciones_desc || 'Otras deducciones', money(recibo.otras_deducciones)]);

  if (filasDed.length === 0) filasDed.push(['Sin deducciones', '$0.00']);

  filasDed.push([
    { content: 'TOTAL DEDUCCIONES', styles: { fontStyle: 'bold', textColor: [239, 68, 68] } },
    { content: money(recibo.total_deducciones), styles: { fontStyle: 'bold', textColor: [239, 68, 68] } },
  ]);

  autoTable(doc, {
    startY: yDed,
    margin: { left: 14, right: 14 },
    head: [['DEDUCCIONES', 'IMPORTE']],
    body: filasDed,
    theme: 'striped',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 3.5, textColor: TEXTO },
    headStyles: { fillColor: [239, 68, 68], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 130 }, 1: { halign: 'right', cellWidth: 52 } },
  });

  // ── NETO A PAGAR ──
  const yNeto = doc.lastAutoTable.finalY + 8;
  doc.setFillColor(...ACENTO);
  doc.roundedRect(14, yNeto - 5, 182, 14, 3, 3, 'F');
  doc.setFontSize(12).setTextColor(255, 255, 255).setFont('helvetica', 'bold');
  doc.text('NETO A PAGAR:', 22, yNeto + 3);
  doc.setFontSize(14);
  doc.text(money(recibo.neto_pagar), 192, yNeto + 3, { align: 'right' });

  // ── Resumen asistencia ──
  const yAsis = yNeto + 18;
  doc.setFontSize(9).setTextColor(...TEXTO).setFont('helvetica', 'normal');
  doc.text(`Días trabajados: ${recibo.dias_trabajados}`, 14, yAsis);
  doc.text(`Faltas: ${recibo.dias_falta}`, 70, yAsis);
  if (recibo.horas_extra_doble > 0) doc.text(`Hrs extra x2: ${recibo.horas_extra_doble}`, 110, yAsis);
  if (recibo.horas_extra_triple > 0) doc.text(`Hrs extra x3: ${recibo.horas_extra_triple}`, 160, yAsis);

  // ── Firmas ──
  const yFirma = Math.max(yAsis + 30, 230);
  doc.setDrawColor(180, 180, 180).setLineWidth(0.3);
  doc.line(25, yFirma, 90, yFirma);
  doc.line(120, yFirma, 185, yFirma);
  doc.setFontSize(8).setTextColor(120, 120, 120);
  doc.text('Firma del trabajador', 57, yFirma + 5, { align: 'center' });
  doc.text('Firma del patrón', 152, yFirma + 5, { align: 'center' });

  // ── Pie ──
  doc.setFontSize(7).setTextColor(150, 150, 150);
  doc.text('Este recibo ampara el pago de salarios correspondiente al periodo indicado.', 105, 278, { align: 'center' });
  doc.text(`Documento generado el ${new Date().toLocaleDateString('es-MX')}`, 105, 282, { align: 'center' });

  // ── Guardar ──
  const nombreLimpio = empleado.nombre.replace(/\s+/g, '_').substring(0, 30);
  doc.save(`Recibo_${nombreLimpio}_${periodo.fecha_inicio}_${periodo.fecha_fin}.pdf`);
}