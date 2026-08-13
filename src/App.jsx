import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient.js';
import { Lock, Mail, KeyRound, ArrowLeft, Building2, LogIn } from 'lucide-react';
import Nomina from './pages/Nomina.jsx';
import Agenda from './pages/Agenda.jsx';
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
import {
  LIMITES, EMAIL_RE, limpiarTexto, textoParaGuardar,
  verificarPolitica, limpiarIntentos,
} from './utils/seguridad.js';

/* ══════════════════════════════════════════════
   Botón de Google — marca oficial, sin dependencias
   ══════════════════════════════════════════════ */
const GoogleIcon = (props) => (
  <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true" {...props}>
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

function BotonGoogle({ texto = 'Continuar con Google', onError }) {
  const [cargando, setCargando] = useState(false);

  const entrar = async () => {
    const bloqueo = verificarPolitica('oauth');
    if (bloqueo) return onError?.(bloqueo);

    setCargando(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) { setCargando(false); onError?.('No se pudo abrir Google: ' + error.message); }
    // Si todo sale bien el navegador se redirige y este componente se desmonta.
  };

  return (
    <button type="button" onClick={entrar} disabled={cargando}
      className="w-full bg-white hover:bg-slate-100 text-slate-800 font-semibold py-2.5 rounded-xl
                 flex items-center justify-center gap-3 transition disabled:opacity-60 shadow-sm">
      <GoogleIcon />
      {cargando ? 'Abriendo Google...' : texto}
    </button>
  );
}

const Separador = () => (
  <div className="flex items-center gap-3 py-1">
    <div className="h-px bg-slate-700 flex-1" />
    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">o</span>
    <div className="h-px bg-slate-700 flex-1" />
  </div>
);

/* ══════════════════════════════════════════════
   APP — autenticación
   ══════════════════════════════════════════════ */
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) limpiarIntentos('rl_login');   // login exitoso: se reinicia el contador
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    const correo = loginEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(correo)) return setLoginError('Escribe un correo válido.');
    if (!loginPassword) return setLoginError('Escribe tu contraseña.');

    // Freno local: 6 intentos por cada 5 minutos. Evita el "too many requests"
    // de Supabase y corta el fuerza-bruta desde este navegador.
    const bloqueo = verificarPolitica('login');
    if (bloqueo) return setLoginError(bloqueo);

    setEntrando(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: correo,
      password: loginPassword,
    });
    setEntrando(false);

    if (error) {
      setLoginError(
        error.status === 429
          ? 'Demasiados intentos. Espera unos minutos antes de volver a probar.'
          : 'Correo o contraseña incorrectos.'
      );
    }
  };

  const enviarRecuperacion = async (e) => {
    e.preventDefault();
    setMsgRecuperar(null);

    const correo = loginEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(correo)) return setMsgRecuperar({ t: 'e', m: 'Escribe un correo válido.' });

    const bloqueo = verificarPolitica('recuperar');
    if (bloqueo) return setMsgRecuperar({ t: 'e', m: bloqueo });

    setEnviandoLink(true);
    await supabase.auth.resetPasswordForEmail(correo, {
      redirectTo: `${window.location.origin}/recuperar`,
    });
    setEnviandoLink(false);

    // Mensaje idéntico con o sin error: no revelamos qué correos existen.
    setMsgRecuperar({
      t: 'ok',
      m: 'Si ese correo está registrado, te llegará un enlace en unos minutos. Revisa también la carpeta de spam.',
    });
  };

  /* ---------- Página de recuperación (siempre accesible) ---------- */
  if (window.location.pathname === '/recuperar') return <Recuperar />;

  /* ---------- Cargando ---------- */
  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Cargando sistema seguro...</div>
      </div>
    );
  }

  /* ---------- Olvidé mi contraseña ---------- */
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
            <input type="email" required value={loginEmail} maxLength={LIMITES.correo}
              onChange={(e) => setLoginEmail(limpiarTexto(e.target.value, LIMITES.correo))}
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

          <button type="button" onClick={() => { setModoRecuperar(false); setMsgRecuperar(null); }}
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
          <p className="text-slate-400 text-sm mt-1">Entra con tu cuenta para continuar</p>
        </div>

        <div className="space-y-5">
          <BotonGoogle texto="Continuar con Google" onError={setLoginError} />
          <Separador />

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Correo electrónico</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                <input type="email" required value={loginEmail} maxLength={LIMITES.correo}
                  autoComplete="username"
                  onChange={(e) => setLoginEmail(limpiarTexto(e.target.value, LIMITES.correo))}
                  placeholder="tu@correo.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-colors" />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                <input type="password" required value={loginPassword} maxLength={LIMITES.password}
                  autoComplete="current-password"
                  onChange={(e) => setLoginPassword(e.target.value.slice(0, LIMITES.password))}
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
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center gap-2">
              <LogIn size={17} /> {entrando ? 'Entrando...' : 'Iniciar sesión'}
            </button>

            <button type="button"
              onClick={() => { setModoRecuperar(true); setLoginError(''); setMsgRecuperar(null); }}
              className="w-full text-slate-400 hover:text-slate-200 text-xs font-bold pt-1">
              ¿Olvidaste tu contraseña?
            </button>
          </form>
        </div>
      </Marco>
    );
  }

  /* ---------- Contraseña temporal ---------- */
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

/* ══════════════════════════════════════════════
   SHELL — layout + rutas
   ══════════════════════════════════════════════ */
function Shell({ session }) {
  const { cargando, error, esSuperAdmin, recargarMiembro } = useNegocio();

  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Cargando negocio...</div>
      </div>
    );
  }

  // Una cuenta recién creada con Google todavía no pertenece a ningún negocio.
  // Aquí puede crear el suyo o esperar a que un administrador la dé de alta.
  if (error === 'SIN_NEGOCIO' && !esSuperAdmin) {
    return <AltaNegocio session={session} onListo={recargarMiembro} />;
  }

  return (
    <div className="flex bg-slate-50 min-h-screen">
      <Sidebar session={session} />
      <div className="flex-1 md:ml-64 pt-16 md:pt-0 min-h-screen w-full overflow-x-hidden">
        <Routes>
          <Route path="/" element={<Dashboard session={session} />} />
          <Route path="/presupuestos" element={<Presupuestos session={session} />} />
          <Route path="/historial" element={<Historial session={session} />} />
          <Route path="/clientes" element={<Clientes session={session} />} />
          <Route path="/agenda" element={<Agenda session={session} />} />
          <Route path="/mi-cuenta" element={<MiCuenta session={session} />} />

          <Route path="/nomina" element={
            <Protegido permiso="gestionar_equipo"><Nomina session={session} /></Protegido>
          } />
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

/* ══════════════════════════════════════════════
   Alta de negocio (primer acceso con Google)
   ══════════════════════════════════════════════ */
function AltaNegocio({ session, onListo }) {
  const [nombre, setNombre] = useState('');
  const [cargando, setCargando] = useState(false);
  const [err, setErr] = useState('');

  const crear = async (e) => {
    e.preventDefault();
    setErr('');

    const limpio = textoParaGuardar(nombre, LIMITES.nombreNegocio);
    if (limpio.length < 2) return setErr('Escribe el nombre de tu negocio.');

    const bloqueo = verificarPolitica('crearCuenta');
    if (bloqueo) return setErr(bloqueo);

    setCargando(true);
    // RPC con SECURITY DEFINER: valida que el usuario no tenga negocio y
    // crea negocio + miembro dueño en una sola transacción del servidor.
    const { error } = await supabase.rpc('crear_mi_negocio', { p_nombre: limpio });
    setCargando(false);

    if (error) return setErr(error.message);
    await onListo?.();
  };

  return (
    <Marco>
      <form onSubmit={crear} className="space-y-5">
        <div className="text-center">
          <div className="bg-blue-600/20 w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="text-blue-400 w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-white">Configura tu negocio</h1>
          <p className="text-slate-400 text-sm mt-1">
            Tu cuenta ya está lista. Ponle nombre a tu negocio para empezar.
          </p>
        </div>

        <input value={nombre} maxLength={LIMITES.nombreNegocio}
          onChange={(e) => setNombre(limpiarTexto(e.target.value, LIMITES.nombreNegocio))}
          placeholder="Ej. Balsimelli Electric" required
          className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-4 text-white placeholder-slate-500 outline-none focus:border-blue-500" />

        {err && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-xl text-center">
            {err}
          </div>
        )}

        <button disabled={cargando}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl disabled:opacity-50">
          {cargando ? 'Creando...' : 'Crear mi negocio'}
        </button>

        <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-3">
          <p className="text-[11px] text-slate-400 leading-snug">
            ¿Te invitó alguien? Pídele que te dé de alta con este correo y luego recarga la página:
          </p>
          <p className="text-slate-300 text-xs font-mono mt-1 break-all">{session.user.email}</p>
        </div>

        <button type="button" onClick={() => supabase.auth.signOut()}
          className="w-full text-slate-500 text-xs font-bold hover:text-slate-300">
          Cerrar sesión
        </button>
      </form>
    </Marco>
  );
}

/* ══════════════════════════════════════════════
   Componentes auxiliares
   ══════════════════════════════════════════════ */
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
    if (pass.length > LIMITES.password) return setErr('La contraseña es demasiado larga.');
    if (pass !== pass2) return setErr('Las contraseñas no coinciden.');

    const bloqueo = verificarPolitica('cambiarPassword');
    if (bloqueo) return setErr(bloqueo);

    setLoad(true);
    const { error } = await supabase.auth.updateUser({
      password: pass,
      data: { debe_cambiar_password: false },
    });
    setLoad(false);
    if (error) return setErr(error.message);
    window.location.href = '/';
  };

  const input = 'w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-4 text-white placeholder-slate-500 outline-none focus:border-blue-500';

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

        <input type="password" value={pass} maxLength={LIMITES.password}
          onChange={(e) => setPass(e.target.value)} placeholder="Nueva contraseña"
          required autoComplete="new-password" className={input} />
        <input type="password" value={pass2} maxLength={LIMITES.password}
          onChange={(e) => setPass2(e.target.value)} placeholder="Confirmar contraseña"
          required autoComplete="new-password" className={input} />

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