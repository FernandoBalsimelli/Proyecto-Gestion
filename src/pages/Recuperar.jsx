import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { KeyRound, Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function Recuperar() {
  const [estado, setEstado] = useState('verificando'); // verificando | listo | invalido | ok
  const [errorLink, setErrorLink] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [ver, setVer] = useState(false);
  const [err, setErr] = useState('');
  const [load, setLoad] = useState(false);

  useEffect(() => {
    // Supabase pone errores del enlace en el hash: #error=...&error_description=...
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const errHash = hash.get('error_description') || hash.get('error');
    if (errHash) {
      setErrorLink(decodeURIComponent(errHash).replace(/\+/g, ' '));
      setEstado('invalido');
      return;
    }

    // supabase-js procesa el token del hash y crea una sesión de recuperación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setEstado('listo');
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setEstado(session ? 'listo' : 'invalido');
    });

    const t = setTimeout(() => {
      setEstado(prev => (prev === 'verificando' ? 'invalido' : prev));
    }, 4000);

    return () => { subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  const guardar = async (e) => {
    e.preventDefault();
    setErr('');
    if (pass.length < 8) return setErr('La contraseña debe tener al menos 8 caracteres.');
    if (pass !== pass2)  return setErr('Las contraseñas no coinciden.');

    setLoad(true);
    const { error } = await supabase.auth.updateUser({
      password: pass,
      data: { debe_cambiar_password: false },
    });
    setLoad(false);
    if (error) return setErr(error.message);
    setEstado('ok');
  };

  const Marco = ({ children }) => (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700">
        {children}
      </div>
    </div>
  );

  if (estado === 'verificando') {
    return (
      <Marco>
        <p className="text-white text-center animate-pulse py-8">Verificando enlace...</p>
      </Marco>
    );
  }

  if (estado === 'invalido') {
    return (
      <Marco>
        <div className="text-center space-y-4">
          <div className="bg-rose-500/20 w-14 h-14 rounded-2xl flex items-center justify-center mx-auto">
            <AlertTriangle className="text-rose-400 w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-white">Enlace no válido o expirado</h1>
          <p className="text-slate-400 text-sm">
            {errorLink || 'Los enlaces de recuperación duran poco tiempo y solo se pueden usar una vez.'}
          </p>
          <a href="/"
            className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl mt-4">
            Solicitar uno nuevo
          </a>
        </div>
      </Marco>
    );
  }

  if (estado === 'ok') {
    return (
      <Marco>
        <div className="text-center space-y-4">
          <div className="bg-emerald-500/20 w-14 h-14 rounded-2xl flex items-center justify-center mx-auto">
            <CheckCircle2 className="text-emerald-400 w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-white">¡Listo!</h1>
          <p className="text-slate-400 text-sm">Tu contraseña se actualizó correctamente.</p>
          <a href="/"
            className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl mt-4">
            Entrar al sistema
          </a>
        </div>
      </Marco>
    );
  }

  return (
    <Marco>
      <form onSubmit={guardar} className="space-y-5">
        <div className="text-center">
          <div className="bg-blue-600/20 w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <KeyRound className="text-blue-400 w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-white">Nueva contraseña</h1>
          <p className="text-slate-400 text-sm mt-1">Escribe la contraseña con la que entrarás de ahora en adelante.</p>
        </div>

        <div className="relative">
          <input type={ver ? 'text' : 'password'} value={pass} onChange={(e) => setPass(e.target.value)}
            placeholder="Nueva contraseña" required autoComplete="new-password"
            className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-4 pr-11 text-white placeholder-slate-500 outline-none focus:border-blue-500" />
          <button type="button" onClick={() => setVer(!ver)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
            {ver ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <input type={ver ? 'text' : 'password'} value={pass2} onChange={(e) => setPass2(e.target.value)}
          placeholder="Confirmar contraseña" required autoComplete="new-password"
          className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-4 text-white placeholder-slate-500 outline-none focus:border-blue-500" />

        {err && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-xl text-center">
            {err}
          </div>
        )}

        <button disabled={load}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl disabled:opacity-50">
          {load ? 'Guardando...' : 'Guardar contraseña'}
        </button>
      </form>
    </Marco>
  );
}