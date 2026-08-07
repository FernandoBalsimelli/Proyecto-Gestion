import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient.js';
import { Lock, Mail, KeyRound, ArrowLeft } from 'lucide-react';

import Sidebar from './components/Sidebar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Presupuestos from './pages/Presupuestos.jsx';
import Historial from './pages/Historial.jsx';
import Finanzas from './pages/Finanzas.jsx';
import Clientes from './pages/Clientes.jsx';
import Configuracion from './pages/Configuracion.jsx';
import Equipo from './pages/Equipo.jsx';
import Administracion from './pages/Administracion.jsx';
import MiCuenta from './pages/MiCuenta.jsx';   
import Recuperar from './pages/Recuperar.jsx';      
import { NegocioProvider, useNegocio, Protegido } from './context/NegocioContext.jsx';

/* ════════════════════════════════════════════
   APP — maneja autenticación
   ════════════════════════════════════════════ */
export default function App() {
  const [session, setSession] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [entrando, setEntrando] = useState(false);

  const [modoRecuperar, setModoRecuperar] = useState(false);
  const [msgRecuperar, setMsgRecuperar] = useState(null);
  const [enviandoLink, setEnviandoLink] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setEntrando(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim().toLowerCase(),
      password: loginPassword,
    });
    setEntrando(false);
    if (error) setLoginError('Correo o contraseña incorrectos');
  };

  const enviarRecuperacion = async (e) => {
    e.preventDefault();
    setMsgRecuperar(null);
    setEnviandoLink(true);
    const { error } = await supabase.auth.resetPasswordForEmail(
      loginEmail.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/recuperar` }   // 👈
    );
    setEnviandoLink(false);
    setMsgRecuperar(
      error
        ? { t: 'e', m: 'Error: ' + error.message }
        : { t: 'ok', m: 'Si ese correo está registrado, te llegará un enlace en unos minutos. Revisa también la carpeta de spam.' }
    );
  };

    /* ---------- Página de recuperación (siempre accesible) ---------- */
  if (window.location.pathname === '/recuperar') {
    return <Recuperar />;
  }

  /* ---------- Cargando ---------- */
  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Cargando sistema seguro...</div>
      </div>
    );
  }

  /* ---------- Modo: olvidé mi contraseña ---------- */
  if (!session && modoRecuperar) {
    return (
      <Marco>
        <form onSubmit={enviarRecuperacion} className="space-y-5">
          <div className="text-center mb-2">
            <div className="bg-blue-600/20 w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <KeyRound className="text-blue-400 w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-white">Recuperar contraseña</h1>
            <p className="text-slate-400 text-sm mt-1">Te enviaremos un enlace a tu correo.</p>
          </div>

          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
            <input type="email" required value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-slate-500 outline-none focus:border-blue-500" />
          </div>

          {msgRecuperar && (
            <div className={`text-xs p-3 rounded-xl text-center border ${
              msgRecuperar.t === 'ok'
                ? 'bg-blue-500/10 border-blue-500/20 text-blue-300'
                : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
              {msgRecuperar.m}
            </div>
          )}

          <button disabled={enviandoLink}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl disabled:opacity-50">
            {enviandoLink ? 'Enviando...' : 'Enviar enlace'}
          </button>

          <button type="button"
            onClick={() => { setModoRecuperar(false); setMsgRecuperar(null); }}
            className="w-full text-slate-500 text-xs font-bold hover:text-slate-300 flex items-center justify-center gap-1.5">
            <ArrowLeft size={13} /> Volver al inicio de sesión
          </button>
        </form>
      </Marco>
    );
  }

  /* ---------- Login ---------- */
  if (!session) {
    return (
      <Marco>
        <div className="text-center mb-8">
          <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
            <Lock className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Sistema de Gestión</h1>
          <p className="text-slate-400 text-sm mt-1">Ingresa tus credenciales para acceder</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">Correo Electrónico</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
              <input type="email" required value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="tu@correo.com"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-colors" />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
              <input type="password" required value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-colors" />
            </div>
          </div>

          {loginError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-xl text-center">
              {loginError}
            </div>
          )}

          <button type="submit" disabled={entrando}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50">
            {entrando ? 'Entrando...' : 'Iniciar Sesión'}
          </button>

          <button type="button"
            onClick={() => { setModoRecuperar(true); setLoginError(''); setMsgRecuperar(null); }}
            className="w-full text-slate-400 hover:text-slate-200 text-xs font-bold pt-1">
            ¿Olvidaste tu contraseña?
          </button>
        </form>
      </Marco>
    );
  }

  /* ---------- Contraseña temporal (antes de cargar el negocio) ---------- */
  if (session.user.user_metadata?.debe_cambiar_password) {
    return <CambioObligatorio />;
  }

  /* ---------- App ---------- */
  return (
    <NegocioProvider session={session}>
      <Shell session={session} />
    </NegocioProvider>
  );
}

/* ════════════════════════════════════════════
   SHELL — layout + rutas
   ════════════════════════════════════════════ */
function Shell({ session }) {
  const { cargando, error, esSuperAdmin } = useNegocio();

  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Cargando negocio...</div>
      </div>
    );
  }

  if (error === 'SIN_NEGOCIO' && !esSuperAdmin) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-2xl max-w-md text-center border border-slate-700">
          <h2 className="text-white font-bold text-xl mb-2">Cuenta sin negocio asignado</h2>
          <p className="text-slate-400 text-sm mb-6">
            Tu cuenta existe pero no está vinculada a ningún negocio.
            Pídele al administrador que te dé de alta con este correo.
          </p>
          <p className="text-slate-500 text-xs font-mono mb-6">{session.user.email}</p>
          <button onClick={() => supabase.auth.signOut()}
            className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2.5 rounded-xl font-medium">
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex bg-slate-50 min-h-screen font-sans">
      <Sidebar session={session} />
      <div className="flex-1 md:ml-64 pt-16 md:pt-0 min-h-screen w-full overflow-x-hidden">
        <Routes>
          <Route path="/" element={<Dashboard session={session} />} />
          <Route path="/presupuestos" element={<Presupuestos session={session} />} />
          <Route path="/historial" element={<Historial session={session} />} />
          <Route path="/clientes" element={<Clientes session={session} />} />
          <Route path="/mi-cuenta" element={<MiCuenta session={session} />} />

          <Route path="/finanzas" element={
            <Protegido permiso="ver_finanzas"><Finanzas session={session} /></Protegido>
          } />
          <Route path="/configuracion" element={
            <Protegido permiso="editar_configuracion"><Configuracion session={session} /></Protegido>
          } />
          <Route path="/equipo" element={
            <Protegido permiso="gestionar_equipo"><Equipo /></Protegido>
          } />
          <Route path="/administracion" element={<Administracion />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   Componentes auxiliares
   ════════════════════════════════════════════ */

function Marco({ children }) {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700">
        {children}
      </div>
    </div>
  );
}

function CambioObligatorio({
  titulo = 'Crea tu contraseña',
  subtitulo = 'Estás usando una contraseña temporal. Define una propia para continuar.',
}) {
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [err, setErr] = useState('');
  const [load, setLoad] = useState(false);

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
    window.location.href = '/';
  };

  return (
    <Marco>
      <form onSubmit={guardar} className="space-y-5">
        <div className="text-center">
          <div className="bg-amber-500/20 w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <KeyRound className="text-amber-400 w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-white">{titulo}</h1>
          <p className="text-slate-400 text-sm mt-1">{subtitulo}</p>
        </div>

        <input type="password" value={pass} onChange={(e) => setPass(e.target.value)}
          placeholder="Nueva contraseña" required autoComplete="new-password"
          className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-4 text-white placeholder-slate-500 outline-none focus:border-blue-500" />
        <input type="password" value={pass2} onChange={(e) => setPass2(e.target.value)}
          placeholder="Confirmar contraseña" required autoComplete="new-password"
          className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-4 text-white placeholder-slate-500 outline-none focus:border-blue-500" />

        {err && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-xl text-center">
            {err}
          </div>
        )}

        <button disabled={load}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl disabled:opacity-50">
          {load ? 'Guardando...' : 'Guardar y entrar'}
        </button>

        <button type="button" onClick={() => supabase.auth.signOut()}
          className="w-full text-slate-500 text-xs font-bold hover:text-slate-300">
          Cerrar sesión
        </button>
      </form>
    </Marco>
  );
}