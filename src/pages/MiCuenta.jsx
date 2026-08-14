import React, { useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { useNegocio } from '../context/NegocioContext.jsx';
import {
  KeyRound, Eye, EyeOff, CheckCircle2, User, ShieldCheck, AlertTriangle,
} from 'lucide-react';
import { LIMITES, verificarPolitica, limpiarIntentos } from '../utils/seguridad.js';

export default function MiCuenta({ session }) {
  const { esDueno, nombreNegocio } = useNegocio();

  const [actual, setActual] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [ver, setVer] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [msg, setMsg] = useState(null);

  /** Fuerza de la contraseña, para dar retroalimentación mientras escribe. */
  const fuerza = (() => {
    if (!pass) return null;
    const tipos = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(pass)).length;
    if (pass.length < 8) return { n: 1, txt: 'Muy corta', color: 'bg-rose-500', texto: 'text-rose-600' };
    if (pass.length < 12 || tipos < 2) return { n: 2, txt: 'Aceptable', color: 'bg-amber-500', texto: 'text-amber-600' };
    if (tipos < 3) return { n: 3, txt: 'Buena', color: 'bg-emerald-500', texto: 'text-emerald-600' };
    return { n: 4, txt: 'Muy buena', color: 'bg-emerald-600', texto: 'text-emerald-700' };
  })();

  const cambiar = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (cargando) return;

    if (!actual)          return setMsg({ t: 'e', m: 'Escribe tu contraseña actual.' });
    if (pass.length < 10) return setMsg({ t: 'e', m: 'La nueva contraseña debe tener al menos 10 caracteres.' });
    if (pass !== pass2)   return setMsg({ t: 'e', m: 'Las contraseñas nuevas no coinciden.' });
    if (pass === actual)  return setMsg({ t: 'e', m: 'La nueva contraseña debe ser distinta a la actual.' });

    const tipos = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(pass)).length;
    if (tipos < 2) return setMsg({ t: 'e', m: 'Combina letras y números para que sea más difícil de adivinar.' });

    /* Freno contra fuerza bruta.
       Este formulario verifica la contraseña actual llamando a
       signInWithPassword. Sin límite, es un oráculo de contraseñas dentro
       de tu propia app: se puede probar mil combinaciones sin restricción. */
    const bloqueo = verificarPolitica('cambiarPassword');
    if (bloqueo) return setMsg({ t: 'e', m: bloqueo });

    setCargando(true);
    try {
      // 1. Reautenticar para confirmar que es realmente el dueño de la sesión.
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: session.user.email,
        password: actual,
      });
      if (authErr) {
        setMsg({ t: 'e', m: 'La contraseña actual es incorrecta.' });
        return;
      }

      // 2. Cambiarla.
      const { error } = await supabase.auth.updateUser({
        password: pass,
        data: { debe_cambiar_password: false },
      });
      if (error) {
        setMsg({
          t: 'e',
          m: error.message.includes('session')
            ? 'Tu sesión expiró. Cierra sesión y vuelve a entrar.'
            : error.message,
        });
        return;
      }

      limpiarIntentos('rl_pass');   // acertó: reiniciamos el contador
      setActual(''); setPass(''); setPass2('');
      setMsg({ t: 'ok', m: 'Contraseña actualizada correctamente.' });
    } finally {
      setCargando(false);
    }
  };

  const input = 'w-full p-3 pl-10 pr-11 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none focus:bg-white focus:ring-2 focus:ring-primario/10 transition';

  return (
    <div className="p-4 md:p-8 max-w-xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
          <User className="text-primario" /> Mi cuenta
        </h2>
        <p className="text-slate-500 font-medium">
          {nombreNegocio} · {esDueno ? 'Dueño' : 'Empleado'}
        </p>
      </div>

      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Correo</p>
        <p className="font-bold text-slate-800 break-all">{session.user.email}</p>
        {session.user.app_metadata?.provider === 'google' && (
          <p className="text-[11px] font-bold text-slate-400 mt-2">
            Entras con Google. Tu contraseña la administra Google, no esta app.
          </p>
        )}
      </div>

      {/* Con Google no hay contraseña que cambiar aquí. */}
      {session.user.app_metadata?.provider !== 'google' && (
        <form onSubmit={cambiar} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-3">
            <KeyRound size={18} /> Cambiar contraseña
          </h3>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
            <ShieldCheck size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] font-bold text-amber-800 leading-snug">
              Por seguridad debes confirmar tu contraseña actual antes de cambiarla.
            </p>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Contraseña actual</label>
            <div className="relative mt-1">
              <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input type="password" value={actual} maxLength={LIMITES.password}
                onChange={(e) => setActual(e.target.value.slice(0, LIMITES.password))}
                className={input} placeholder="Tu contraseña actual" autoComplete="current-password" />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nueva contraseña</label>
            <div className="relative mt-1">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input type={ver ? 'text' : 'password'} value={pass} maxLength={LIMITES.password}
                onChange={(e) => setPass(e.target.value.slice(0, LIMITES.password))}
                className={input} placeholder="Mínimo 10 caracteres" autoComplete="new-password" />
              <button type="button" onClick={() => setVer(!ver)}
                aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {ver ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {fuerza && (
              <div className="flex items-center gap-2 mt-2 ml-1">
                <div className="flex gap-1 flex-1">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= fuerza.n ? fuerza.color : 'bg-slate-200'}`} />
                  ))}
                </div>
                <span className={`text-[10px] font-black uppercase ${fuerza.texto}`}>{fuerza.txt}</span>
              </div>
            )}
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Confirmar nueva</label>
            <div className="relative mt-1">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input type={ver ? 'text' : 'password'} value={pass2} maxLength={LIMITES.password}
                onChange={(e) => setPass2(e.target.value.slice(0, LIMITES.password))}
                className={input} placeholder="Repite la contraseña" autoComplete="new-password" />
            </div>
          </div>

          {msg && (
            <div className={`text-xs font-bold p-3 rounded-xl border flex items-start gap-2 ${
              msg.t === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
              {msg.t === 'ok'
                ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
              {msg.m}
            </div>
          )}

          <button disabled={cargando}
            className="w-full bg-slate-900 text-white p-4 rounded-2xl font-bold hover:bg-slate-800 disabled:opacity-50 transition">
            {cargando ? 'Verificando...' : 'Actualizar contraseña'}
          </button>
        </form>
      )}
    </div>
  );
}