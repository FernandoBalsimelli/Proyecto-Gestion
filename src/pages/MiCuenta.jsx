import React, { useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { useNegocio } from '../context/NegocioContext.jsx';
import { KeyRound, Eye, EyeOff, CheckCircle2, User } from 'lucide-react';

export default function MiCuenta({ session }) {
  const { esDueno, nombreNegocio } = useNegocio();
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [ver, setVer] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [msg, setMsg] = useState(null);

  const cambiar = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (pass.length < 8)  return setMsg({ t: 'e', m: 'La contraseña debe tener al menos 8 caracteres.' });
    if (pass !== pass2)   return setMsg({ t: 'e', m: 'Las contraseñas no coinciden.' });

    setCargando(true);
    const { error } = await supabase.auth.updateUser({
      password: pass,
      data: { debe_cambiar_password: false },
    });
    setCargando(false);

    if (error) return setMsg({ t: 'e', m: error.message });
    setPass(''); setPass2('');
    setMsg({ t: 'ok', m: 'Contraseña actualizada correctamente.' });
  };

  const input = 'w-full p-3 pl-10 pr-11 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500/10';

  return (
    <div className="p-4 md:p-8 max-w-xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
          <User className="text-blue-600" /> Mi Cuenta
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

        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nueva contraseña</label>
          <div className="relative mt-1">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input type={ver ? 'text' : 'password'} value={pass}
              onChange={(e) => setPass(e.target.value)} className={input} placeholder="Mínimo 8 caracteres" />
            <button type="button" onClick={() => setVer(!ver)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {ver ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Confirmar</label>
          <div className="relative mt-1">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input type={ver ? 'text' : 'password'} value={pass2}
              onChange={(e) => setPass2(e.target.value)} className={input} placeholder="Repite la contraseña" />
          </div>
        </div>

        {msg && (
          <div className={`text-xs font-bold p-3 rounded-xl border flex items-center gap-2 ${
            msg.t === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                           : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
            {msg.t === 'ok' && <CheckCircle2 size={14} />} {msg.m}
          </div>
        )}

        <button disabled={cargando}
          className="w-full bg-slate-900 text-white p-4 rounded-2xl font-bold hover:bg-slate-800 disabled:opacity-50">
          {cargando ? 'Guardando...' : 'Actualizar contraseña'}
        </button>
      </form>
    </div>
  );
}