/**
 * Exporta a CSV compatible con Excel en español (BOM + punto y coma).
 *
 * SEGURIDAD — inyección de fórmulas:
 * Si un cliente se llama `=HYPERLINK("http://malo","Da clic")`, Excel lo
 * ejecuta al abrir el archivo. Es un vector real de robo de datos por
 * archivos que tú mismo generas y compartes. Prefijando con apóstrofo,
 * Excel lo trata como texto plano.
 */
const esc = (v) => {
  let s = v == null ? '' : String(v);

  // Quita caracteres de control que rompen el parseo del CSV.
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

  // Neutraliza cualquier celda que Excel interpretaría como fórmula.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;

  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function exportarCSV(nombreArchivo, columnas, filas) {
  const MAX_FILAS = 20000;   // tope de memoria del navegador
  const datos = (filas || []).slice(0, MAX_FILAS);

  const lineas = [
    columnas.map(c => esc(c.label)).join(';'),
    ...datos.map(f => columnas.map(c => esc(c.valor(f))).join(';')),
  ];

  const blob = new Blob(['\uFEFF' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${String(nombreArchivo).replace(/[^A-Za-z0-9_-]/g, '')}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();

  // Liberamos el objeto después de que el navegador tome el archivo.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Abre WhatsApp con un mensaje ya redactado. */
export function abrirWhatsApp(telefono, mensaje) {
  const tel = String(telefono || '').replace(/\D/g, '');
  const num = tel.length === 10 ? `52${tel}` : tel;
  const base = num ? `https://wa.me/${num}` : 'https://wa.me/';

  // Tope de la API de wa.me; más allá el enlace se corta solo.
  const texto = String(mensaje || '').slice(0, 1800);

  // noopener evita que la pestaña abierta manipule la nuestra vía window.opener.
  window.open(`${base}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener,noreferrer');
}