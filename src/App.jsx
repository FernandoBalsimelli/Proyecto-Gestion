import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient.js';
import { Lock, Mail } from 'lucide-react';

// Importamos tu Sidebar y todas tus pantallas reales
import Sidebar from './components/Sidebar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Presupuestos from './pages/Presupuestos.jsx';
import Historial from './pages/Historial.jsx';
import Finanzas from './pages/Finanzas.jsx';
import Clientes from './pages/Clientes.jsx';
import Configuracion from './pages/Configuracion.jsx';

export default function App() {
  const [session, setSession] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Estados del Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    if (error) setLoginError('Correo o contraseña incorrectos');
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Cargando sistema seguro...</div>
      </div>
    );
  }

  // =========================================================
  // 1. PANTALLA DE LOGIN INTEGRADA
  // =========================================================
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700">
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
                <input 
                  type="email" 
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                <input 
                  type="password" 
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            {loginError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-xl text-center">
                {loginError}
              </div>
            )}

            <button 
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-colors shadow-lg shadow-blue-600/20"
            >
              Iniciar Sesión
            </button>
          </form>
        </div>
      </div>
    );
  }

  // =========================================================
  // 2. SISTEMA PRINCIPAL (Con tus pantallas reales)
  // =========================================================
  return (
<div className="flex bg-slate-50 min-h-screen font-sans">
      
      {/* 1. EL MENÚ RESPONSIVO */}
      <Sidebar />

      {/* 2. EL CONTENEDOR DE LAS PÁGINAS */}
      {/* md:ml-64 = En PC deja espacio a la izquierda para el menú */}
      {/* pt-16 md:pt-0 = En celular deja espacio arriba para la barra superior */}
      <div className="flex-1 md:ml-64 pt-16 md:pt-0 min-h-screen w-full overflow-x-hidden">
        {/* Pasamos 'session' por si tus componentes necesitan el ID del usuario después */}
        <Routes>
          <Route path="/" element={<Dashboard session={session} />} />
          <Route path="/presupuestos" element={<Presupuestos session={session} />} />
          <Route path="/historial" element={<Historial session={session} />} />
          <Route path="/finanzas" element={<Finanzas session={session} />} />
          <Route path="/clientes" element={<Clientes session={session} />} />
          <Route path="/configuracion" element={<Configuracion session={session} />} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}