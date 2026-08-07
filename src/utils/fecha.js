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
export const RANGOS = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes', label: 'Este mes' },
  { id: 'trimestre', label: 'Trimestre' },
  { id: 'anio', label: 'Este año' },
  { id: 'todo', label: 'Todo' },
];

/** Devuelve { desde, hasta } en 'YYYY-MM-DD' (o null = sin límite) */
export function rangoFechas(id, custom) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const iso = (d) => {
    const off = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - off).toISOString().split('T')[0];
  };

  switch (id) {
    case 'hoy': return { desde: iso(hoy), hasta: iso(hoy) };
    case 'semana': {
      const d = new Date(hoy);
      d.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7)); // lunes
      return { desde: iso(d), hasta: iso(hoy) };
    }
    case 'mes': return { desde: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: iso(hoy) };
    case 'trimestre': {
      const q = Math.floor(hoy.getMonth() / 3) * 3;
      return { desde: iso(new Date(hoy.getFullYear(), q, 1)), hasta: iso(hoy) };
    }
    case 'anio': return { desde: iso(new Date(hoy.getFullYear(), 0, 1)), hasta: iso(hoy) };
    case 'custom': return { desde: custom?.desde || null, hasta: custom?.hasta || null };
    default: return { desde: null, hasta: null };
  }
}

export const enRango = (fechaISO, { desde, hasta }) => {
  if (!fechaISO) return false;
  if (desde && fechaISO < desde) return false;
  if (hasta && fechaISO > hasta) return false;
  return true;
};