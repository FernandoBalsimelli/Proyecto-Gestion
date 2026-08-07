import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, AlertTriangle, Info, X, XCircle } from 'lucide-react';

const UIContext = createContext(null);
export const useUI = () => useContext(UIContext);

const TIPOS = {
  ok:    { icon: CheckCircle2, barra: 'bg-emerald-500', texto: 'text-emerald-600', fondo: 'bg-emerald-50' },
  error: { icon: XCircle,      barra: 'bg-rose-500',    texto: 'text-rose-600',    fondo: 'bg-rose-50' },
  info:  { icon: Info,         barra: 'bg-sky-500',     texto: 'text-sky-600',     fondo: 'bg-sky-50' },
  warn:  { icon: AlertTriangle,barra: 'bg-amber-500',   texto: 'text-amber-600',   fondo: 'bg-amber-50' },
};

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialogo, setDialogo] = useState(null);
  const resolverRef = useRef(null);

  const quitar = useCallback((id) => setToasts(t => t.filter(x => x.id !== id)), []);

  const push = useCallback((tipo, msg, ms = 3500) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, tipo, msg }]);
    setTimeout(() => quitar(id), ms);
  }, [quitar]);

  const toast = {
    ok:    (m, ms) => push('ok', m, ms),
    error: (m, ms) => push('error', m, ms ?? 5000),
    info:  (m, ms) => push('info', m, ms),
    warn:  (m, ms) => push('warn', m, ms),
  };

  const confirmar = useCallback((opts) => {
    setDialogo({
      titulo: 'Confirmar acción',
      mensaje: '',
      okTexto: 'Confirmar',
      cancelTexto: 'Cancelar',
      peligro: false,
      ...(typeof opts === 'string' ? { mensaje: opts } : opts),
    });
    return new Promise((res) => { resolverRef.current = res; });
  }, []);

  const cerrar = (valor) => {
    setDialogo(null);
    resolverRef.current?.(valor);
    resolverRef.current = null;
  };

  return (
    <UIContext.Provider value={{ toast, confirmar }}>
      {children}

      {/* ── Toasts ── */}
      <div className="fixed z-[100] bottom-4 right-4 left-4 md:left-auto md:w-96 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => {
          const T = TIPOS[t.tipo] || TIPOS.info;
          const Icon = T.icon;
          return (
            <div key={t.id}
              className="pointer-events-auto bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex animate-[slideIn_.25s_ease-out]">
              <div className={`w-1.5 ${T.barra}`} />
              <div className="flex items-start gap-3 p-4 flex-1 min-w-0">
                <div className={`${T.fondo} ${T.texto} p-1.5 rounded-lg shrink-0`}>
                  <Icon size={16} />
                </div>
                <p className="flex-1 text-sm font-bold text-slate-700 leading-snug break-words">{t.msg}</p>
                <button onClick={() => quitar(t.id)} className="text-slate-300 hover:text-slate-600 shrink-0">
                  <X size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Modal de confirmación ── */}
      {dialogo && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-[fadeIn_.15s_ease-out]"
          onClick={() => cerrar(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4 animate-[popIn_.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              dialogo.peligro ? 'bg-rose-50 text-rose-500' : 'bg-primario-suave text-primario'}`}>
              <AlertTriangle size={22} />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-lg">{dialogo.titulo}</h3>
              {dialogo.mensaje && (
                <p className="text-slate-500 text-sm font-medium mt-1 whitespace-pre-line">{dialogo.mensaje}</p>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => cerrar(false)}
                className="flex-1 py-3 rounded-2xl font-bold text-sm bg-slate-100 text-slate-600 hover:bg-slate-200 transition">
                {dialogo.cancelTexto}
              </button>
              <button onClick={() => cerrar(true)} autoFocus
                className={`flex-1 py-3 rounded-2xl font-bold text-sm text-white transition shadow-lg ${
                  dialogo.peligro ? 'bg-rose-600 hover:bg-rose-700' : 'bg-primario hover:bg-primario-dark'}`}>
                {dialogo.okTexto}
              </button>
            </div>
          </div>
        </div>
      )}
    </UIContext.Provider>
  );
}