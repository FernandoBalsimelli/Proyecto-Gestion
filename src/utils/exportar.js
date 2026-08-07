/** Exporta a CSV compatible con Excel en español (BOM + punto y coma) */
export function exportarCSV(nombreArchivo, columnas, filas) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lineas = [
    columnas.map(c => esc(c.label)).join(';'),
    ...filas.map(f => columnas.map(c => esc(c.valor(f))).join(';')),
  ];

  const blob = new Blob(['\uFEFF' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nombreArchivo}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Abre WhatsApp con un mensaje ya redactado */
export function abrirWhatsApp(telefono, mensaje) {
  const tel = String(telefono || '').replace(/\D/g, '');
  const num = tel.length === 10 ? `52${tel}` : tel;
  const base = num ? `https://wa.me/${num}` : 'https://wa.me/';
  window.open(`${base}?text=${encodeURIComponent(mensaje)}`, '_blank');
}