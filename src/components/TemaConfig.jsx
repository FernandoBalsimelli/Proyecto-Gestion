import React from 'react';
import { useNegocio, PALETAS, FUENTES } from '../context/NegocioContext.jsx';
import { Palette, Type, Square, PanelLeft, Pipette } from 'lucide-react';

const SIDEBARS = [
  { id: 'oscuro', nombre: 'Oscuro', prev: 'bg-slate-900' },
  { id: 'claro',  nombre: 'Claro',  prev: 'bg-white border-2 border-slate-200' },
  { id: 'color',  nombre: 'Color',  prev: 'bg-primario-dark' },
];

const RADIOS = [
  { id: 'recto',   nombre: 'Recto',   clase: 'rounded' },
  { id: 'suave',   nombre: 'Suave',   clase: 'rounded-xl' },
  { id: 'redondo', nombre: 'Redondo', clase: 'rounded-3xl' },
];

/* ✅ FUERA del componente — si está dentro, React remonta todo en cada render
   y el selector de color se cierra al arrastrar */
function Bloque({ icon, titulo, children }) {
  return (
    <div>
      <h4 className="font-bold text-slate-700 flex items-center gap-2 mb-3 text-sm">
        {icon} {titulo}
      </h4>
      {children}
    </div>
  );
}

export default function TemaConfig() {
  const { tema, setTema } = useNegocio();
  const set = (k, v) => setTema({ ...tema, [k]: v });

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-7">
      <h3 className="font-bold text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-3">
        <Palette size={18} /> Apariencia
      </h3>

      <Bloque icon={<Palette size={15} />} titulo="Color principal">
        <div className="flex flex-wrap gap-2.5 items-center">
          {Object.entries(PALETAS).map(([id, p]) => (
            <button key={id} type="button" onClick={() => set('color', id)} title={p.nombre}
              className={`w-11 h-11 rounded-2xl transition-all ${
                tema.color === id ? 'ring-4 ring-offset-2 ring-slate-300 scale-110' : 'hover:scale-105'}`}
              style={{ backgroundColor: p.p }} />
          ))}

          <label
            className={`w-11 h-11 rounded-2xl cursor-pointer flex items-center justify-center border-2 border-dashed transition-all ${
              tema.color === 'custom'
                ? 'ring-4 ring-offset-2 ring-slate-300 scale-110 border-transparent'
                : 'border-slate-300 hover:scale-105'}`}
            style={tema.color === 'custom' ? { backgroundColor: tema.colorHex || '#2563eb' } : {}}
            title="Color personalizado">
            {tema.color !== 'custom' && <Pipette size={16} className="text-slate-400" />}
            <input
              type="color"
              value={tema.colorHex || '#2563eb'}
              onChange={(e) => setTema({ ...tema, color: 'custom', colorHex: e.target.value })}
              className="absolute opacity-0 w-11 h-11 cursor-pointer"
            />
          </label>
        </div>

        {tema.color === 'custom' && (
          <div className="mt-3 flex items-center gap-2">
            <input
              value={tema.colorHex || '#2563eb'}
              onChange={(e) => setTema({ ...tema, colorHex: e.target.value })}
              placeholder="#2563eb"
              className="w-32 p-2.5 bg-slate-50 border border-slate-100 rounded-xl font-mono font-bold text-sm outline-none uppercase"
            />
            <span className="text-[11px] font-bold text-slate-400">
              Arrastra en el selector o escribe el código HEX
            </span>
          </div>
        )}
      </Bloque>

      <Bloque icon={<PanelLeft size={15} />} titulo="Estilo del menú lateral">
        <div className="grid grid-cols-3 gap-3">
          {SIDEBARS.map(s => (
            <button key={s.id} type="button" onClick={() => set('sidebar', s.id)}
              className={`p-3 rounded-2xl border-2 transition ${
                tema.sidebar === s.id ? 'border-primario bg-primario-suave' : 'border-slate-100 hover:border-slate-300'}`}>
              <div className={`h-14 w-full rounded-lg ${s.prev} mb-2`} />
              <span className="text-[11px] font-black uppercase text-slate-600">{s.nombre}</span>
            </button>
          ))}
        </div>
      </Bloque>

      <Bloque icon={<Type size={15} />} titulo="Tipografía">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(FUENTES).map(([id, f]) => (
            <button key={id} type="button" onClick={() => set('fuente', id)}
              style={{ fontFamily: f.css }}
              className={`p-3 rounded-2xl border-2 transition ${
                tema.fuente === id ? 'border-primario bg-primario-suave' : 'border-slate-100 hover:border-slate-300'}`}>
              <p className="text-lg font-bold text-slate-800">Aa</p>
              <p className="text-[10px] font-black uppercase text-slate-500 mt-1">{f.nombre}</p>
            </button>
          ))}
        </div>
      </Bloque>

      <Bloque icon={<Square size={15} />} titulo="Bordes">
        <div className="grid grid-cols-3 gap-2">
          {RADIOS.map(r => (
            <button key={r.id} type="button" onClick={() => set('radio', r.id)}
              className={`p-3 border-2 transition ${r.clase} ${
                tema.radio === r.id ? 'border-primario bg-primario-suave' : 'border-slate-100 hover:border-slate-300'}`}>
              <div className={`h-8 bg-slate-200 ${r.clase} mb-2`} />
              <span className="text-[10px] font-black uppercase text-slate-500">{r.nombre}</span>
            </button>
          ))}
        </div>
      </Bloque>

      <p className="text-[11px] font-bold text-slate-400 bg-slate-50 p-3 rounded-xl">
        Los cambios se ven al instante. Presiona <b>Guardar Configuración</b> abajo para que queden fijos.
      </p>
    </div>
  );
}