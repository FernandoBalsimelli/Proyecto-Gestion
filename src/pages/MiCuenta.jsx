import React, { useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { useNegocio } from '../context/NegocioContext.jsx';
import { KeyRound, Eye, EyeOff, CheckCircle2, User, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function MiCuenta({ session }) {
  const { esDueno, nombreNegocio } = useNegocio();
  const [actual, setActual] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [ver, setVer] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [msg, setMsg] = useState(null);

  const cambiar = async (e) => {
    e.preventDefault();
    setMsg(null);

    if (!actual)         return setMsg({ t: 'e', m: 'Escribe tu contraseña actual.' });
    if (pass.length < 8) return setMsg({ t: 'e', m: 'La nueva contraseña debe tener al menos 8 caracteres.' });
    if (pass !== pass2)  return setMsg({ t: 'e', m: 'Las contraseñas nuevas no coinciden.' });
    if (pass === actual) return setMsg({ t: 'e', m: 'La nueva contraseña debe ser distinta a la actual.' });

    setCargando(true);
    try {
      // 1️⃣ Verificar la contraseña actual reautenticando
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: session.user.email,
        password: actual,
      });
      if (authErr) {
        setMsg({ t: 'e', m: 'La contraseña actual es incorrecta.' });
        return;
      }

      // 2️⃣ Cambiarla
      const { error } = await supabase.auth.updateUser({
        password: pass,
        data: { debe_cambiar_password: false },
      });
      if (error) {
        setMsg({ t: 'e', m: error.message.includes('session')
          ? 'Tu sesión expiró. Cierra sesión y vuelve a entrar.' : error.message });
        return;
      }

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
        <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
          <User className="text-primario" /> Mi Cuenta
        </h2>
        <p className="text-slate-500 font-medium">{nombreNegocio} · {esDueno ? 'Dueño' : 'Empleado'}</p>
      </div>

      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Correo</p>
        <p className="font-bold text-slate-800">{session.user.email}</p>
      </div>

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
            <input type="password" value={actual} onChange={(e) => setActual(e.target.value)}
              className={input} placeholder="Tu contraseña de hoy" autoComplete="current-password" />
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nueva contraseña</label>
          <div className="relative mt-1">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input type={ver ? 'text' : 'password'} value={pass} onChange={(e) => setPass(e.target.value)}
              className={input} placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
            <button type="button" onClick={() => setVer(!ver)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {ver ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Confirmar nueva</label>
          <div className="relative mt-1">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input type={ver ? 'text' : 'password'} value={pass2} onChange={(e) => setPass2(e.target.value)}
              className={input} placeholder="Repite la contraseña" autoComplete="new-password" />
          </div>
        </div>

        {msg && (
          <div className={`text-xs font-bold p-3 rounded-xl border flex items-start gap-2 ${
            msg.t === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                           : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
            {msg.t === 'ok' ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                            : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
            {msg.m}
          </div>
        )}

        <button disabled={cargando}
          className="w-full bg-slate-900 text-white p-4 rounded-2xl font-bold hover:bg-slate-800 disabled:opacity-50 transition">
          {cargando ? 'Verificando...' : 'Actualizar contraseña'}
        </button>
      </form>
    </div>
  );
}