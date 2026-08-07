import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';
import { useNegocio } from '../context/NegocioContext.jsx';
import {
  LayoutDashboard, FileText, History, Wallet, Users,
  Settings, Shield, Zap, Menu, X, LogOut
} from 'lucide-react';
import { Building2 } from 'lucide-react';

const SIDEBAR_ESTILOS = {
  oscuro: {
    fondo: 'bg-slate-900',
    texto: 'text-slate-300',
    borde: 'border-white/5',
    hover: 'hover:bg-slate-800 hover:text-white',
    activo: 'text-white',
    titulo: 'text-white',
    sub: 'text-slate-500',
  },
  claro: {
    fondo: 'bg-white',
    texto: 'text-slate-600',
    borde: 'border-slate-200',
    hover: 'hover:bg-slate-100 hover:text-slate-900',
    activo: 'text-white',
    titulo: 'text-slate-900',
    sub: 'text-slate-400',
  },
  color: {
    fondo: 'bg-primario-dark',
    texto: 'text-white/70',
    borde: 'border-white/10',
    hover: 'hover:bg-white/10 hover:text-white',
    activo: 'text-primario-dark',
    titulo: 'text-white',
    sub: 'text-white/50',
  },
};
export default function Sidebar({ session }) {

  const location = useLocation();
  const { negocioId, puede, esDueno, nombreNegocio, esSuperAdmin, tema } = useNegocio();
  const S = SIDEBAR_ESTILOS[tema?.sidebar] || SIDEBAR_ESTILOS.oscuro;
  const bgActivo = tema?.sidebar === 'color' ? 'bg-white' : 'bg-primario';
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [logo, setLogo] = useState(null);
  const [nombre, setNombre] = useState('SISTEMA ERP');

  useEffect(() => {
    if (!negocioId) return;

    const cargarDatos = async () => {
      const { data } = await supabase
        .from('configuracion')
        .select('nombre, logo')
        .eq('negocio_id', negocioId)
        .maybeSingle();

      setNombre(data?.nombre || nombreNegocio || 'SISTEMA ERP');
      setLogo(data?.logo || null);
    };

    cargarDatos();

    const canal = supabase
      .channel(`sidebar-${negocioId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'configuracion',
        filter: `negocio_id=eq.${negocioId}`,
      }, cargarDatos)
      .subscribe();

    return () => { supabase.removeChannel(canal); };
  }, [negocioId, nombreNegocio]);

  useEffect(() => { setMenuAbierto(false); }, [location.pathname]);

  const cerrarSesion = async () => {
    if (!window.confirm('¿Cerrar sesión?')) return;
    await supabase.auth.signOut();
  };

  const menuItems = [
    { icon: <LayoutDashboard size={20} />, label: 'Dashboard', path: '/' },
    { icon: <FileText size={20} />, label: 'Nueva Cotización', path: '/presupuestos' },
    { icon: <History size={20} />, label: 'Historial', path: '/historial' },
    ...(puede('ver_finanzas') ? [{ icon: <Wallet size={20} />, label: 'Finanzas', path: '/finanzas' }] : []),
    { icon: <Users size={20} />, label: 'Clientes', path: '/clientes' },
    ...(puede('editar_configuracion') ? [{ icon: <Settings size={20} />, label: 'Configuración', path: '/configuracion' }] : []),
    ...(puede('gestionar_equipo') ? [{ icon: <Shield size={20} />, label: 'Equipo', path: '/equipo' }] : []),
    ...(esSuperAdmin ? [{ icon: <Building2 size={20} />, label: 'Administración', path: '/administracion' }] : []),
    { icon: <Users size={20} />, label: 'Mi Cuenta', path: '/mi-cuenta' },
  ];

  const Marca = ({ chico }) => (
    <div className="flex items-center gap-3 overflow-hidden">
      {logo ? (
        <img src={logo} alt="Logo"
          className={`${chico ? 'h-8 w-8' : 'h-10 w-10'} object-contain rounded-lg bg-white p-1 shrink-0`} />
      ) : (
        <div className={`${chico ? 'p-1.5' : 'p-2'} bg-primario rounded-xl text-white shrink-0`}>
          <Zap size={chico ? 18 : 24} fill="white" />
        </div>
      )}
      <h1 className={`text-sm font-black ${S.titulo} tracking-tighter uppercase truncate`}>{nombre}</h1>
    </div>
  );

  return (
    <>
      {/* Barra superior móvil */}
      <div className={`md:hidden fixed top-0 left-0 w-full h-16 ${S.fondo} flex items-center justify-between px-4 z-40 shadow-lg border-b border-slate-800`}>
        <Marca chico />
        <button onClick={() => setMenuAbierto(true)} className="p-2 text-slate-300 hover:text-white">
          <Menu size={24} />
        </button>
      </div>

      {menuAbierto && (
        <div className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          onClick={() => setMenuAbierto(false)} />
      )}

      {/* Sidebar */}
      <div className={`fixed top-0 left-0 h-screen ${S.fondo} ${S.texto} flex flex-col shadow-2xl z-50 w-64
      transition-transform duration-300 ease-in-out
      ${menuAbierto ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className={`p-6 md:p-8 flex items-center justify-between border-b ${S.borde} h-16 md:h-auto`}>
          <div className="hidden md:block"><Marca /></div>
          <span className="md:hidden font-black text-white uppercase tracking-widest text-xs">Menú</span>
          <button onClick={() => setMenuAbierto(false)} className="md:hidden p-2 text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4 md:mt-8 overflow-y-auto scroll-sidebar">
          {menuItems.map((item) => (
            <Link key={item.path} to={item.path}
              className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all font-bold text-[13px] ${location.pathname === item.path
                ? `${bgActivo} ${S.activo} shadow-lg md:translate-x-1`
                : S.hover
                }`}>
              {item.icon} {item.label}
            </Link>
          ))}
        </nav>

        {/* Usuario + Logout */}
        <div className="p-4 border-t border-white/5 space-y-3">
          <div className="px-2">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
              {esDueno ? 'Dueño' : 'Empleado'}
            </p>
            <p className="text-[11px] font-bold text-slate-300 truncate" title={session?.user?.email}>
              {session?.user?.email}
            </p>
          </div>

          <button onClick={cerrarSesion}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-[13px] font-bold
                       border border-slate-700 text-slate-400 hover:text-rose-400 hover:border-rose-500/40
                       hover:bg-rose-500/5 transition-all">
            <LogOut size={16} /> Cerrar Sesión
          </button>
        </div>
      </div>
    </>
  );
}