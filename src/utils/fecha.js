/** Fecha local en formato YYYY-MM-DD */
export const hoyLocal = () => {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().split('T')[0];
};

/** '2026-08-06' -> '06/08/2026' */
export const formatoMX = (iso) => {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
};