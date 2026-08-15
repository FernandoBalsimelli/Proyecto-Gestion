import React from 'react';
import { useNegocio, PALETAS, FUENTES } from '../context/NegocioContext.jsx';
import { Palette, Type, Square, PanelLeft, Pipette, Accessibility, PanelsTopLeft, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';

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
const MENU_EDITABLE = [
  ['dashboard', 'Dashboard'], ['agenda', 'Agenda'], ['presupuestos', 'Nueva cotización'], ['historial', 'Historial'], ['finanzas', 'Finanzas'], ['clientes', 'Clientes'], ['oportunidades', 'Oportunidades'], ['inventario', 'Inventario'], ['nomina', 'Nómina'],
];

// Se mantiene fuera del componente para conservar el estado de los controles.
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
  const ordenMenu = [...(tema.sidebar_orden || []), ...MENU_EDITABLE.map(([id]) => id).filter(id => !(tema.sidebar_orden || []).includes(id))];
  const ocultosMenu = tema.sidebar_ocultos || [];
  const moverMenu = (i, direccion) => {
    const j = i + direccion; if (j < 0 || j >= ordenMenu.length) return;
    const nuevo = [...ordenMenu]; [nuevo[i], nuevo[j]] = [nuevo[j], nuevo[i]];
    set('sidebar_orden', nuevo);
  };
  const toggleMenu = id => set('sidebar_ocultos', ocultosMenu.includes(id) ? ocultosMenu.filter(x => x !== id) : [...ocultosMenu, id]);

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
              maxLength="7"
              value={tema.colorHex || '#2563eb'}
              onChange={(e) => setTema({ ...tema, colorHex: e.target.value.slice(0, 7) })}
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
        <div className="grid grid-cols-3 gap-2 mt-3">
          {[['compacto','Compacto'],['normal','Normal'],['amplio','Amplio']].map(([id,n]) => <button key={id} type="button" onClick={() => set('sidebar_ancho', id)} className={`p-2.5 rounded-xl border-2 text-[10px] font-black uppercase transition ${tema.sidebar_ancho===id?'border-primario bg-primario-suave text-primario-dark':'border-slate-100 text-slate-500'}`}>{n}</button>)}
        </div>
      </Bloque>

      <Bloque icon={<PanelLeft size={15} />} titulo="Contenido del menú lateral">
        <p className="text-[11px] font-medium text-slate-400 mb-3">Oculta elementos que no uses y ajusta el orden. Configuración, Equipo y Mi cuenta permanecen disponibles para no bloquear el acceso.</p>
        <div className="space-y-1.5">{ordenMenu.map((id,i) => { const nombre = MENU_EDITABLE.find(x => x[0] === id)?.[1] || id; const visible = !ocultosMenu.includes(id); return <div key={id} className={`flex items-center gap-2 p-2.5 rounded-xl border ${visible?'bg-slate-50 border-slate-100':'bg-slate-50/50 border-dashed border-slate-200 opacity-70'}`}><button type="button" onClick={() => toggleMenu(id)} className={`p-1.5 rounded-lg ${visible?'text-primario hover:bg-primario-suave':'text-slate-400 hover:bg-slate-200'}`} title={visible?'Ocultar':'Mostrar'}>{visible?<Eye size={15}/>:<EyeOff size={15}/>}</button><span className="flex-1 text-sm font-bold text-slate-700">{nombre}</span><button type="button" onClick={() => moverMenu(i,-1)} disabled={i===0} className="p-1 text-slate-400 disabled:opacity-20"><ChevronUp size={15}/></button><button type="button" onClick={() => moverMenu(i,1)} disabled={i===ordenMenu.length-1} className="p-1 text-slate-400 disabled:opacity-20"><ChevronDown size={15}/></button></div>})}</div>
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

      <Bloque icon={<PanelsTopLeft size={15} />} titulo="Densidad y movimiento">
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[['normal','Espaciosa'],['compacta','Compacta']].map(([id,n]) => (
            <button key={id} type="button" onClick={() => set('densidad', id)} className={`p-3 rounded-2xl border-2 text-[11px] font-black uppercase transition ${tema.densidad===id?'border-primario bg-primario-suave text-primario-dark':'border-slate-100 text-slate-500'}`}>{n}</button>
          ))}
        </div>
        <button type="button" onClick={() => set('reducir_movimiento', !tema.reducir_movimiento)} className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition ${tema.reducir_movimiento?'border-primario bg-primario-suave':'border-slate-100'}`}>
          <Accessibility size={17} className="text-primario"/><span><b className="block text-sm text-slate-700">Reducir animaciones</b><span className="text-[11px] font-medium text-slate-500">Útil si prefieres una interfaz más tranquila o rápida.</span></span>
        </button>
      </Bloque>

      <p className="text-[11px] font-bold text-slate-400 bg-slate-50 p-3 rounded-xl">
        Los cambios se ven al instante. Presiona <b>Guardar Configuración</b> abajo para que queden fijos.
      </p>
    </div>
  );
}
