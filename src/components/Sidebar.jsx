import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';
import { useNegocio } from '../context/NegocioContext.jsx';
import { useUI } from './ui/UI.jsx';
import {
  LayoutDashboard, FileText, History, Wallet, Users, Settings,
  Shield, Zap, Menu, X, LogOut, Building2, UserCircle,
} from 'lucide-react';

const ESTILOS = {
  oscuro: {
    fondo: 'bg-slate-900', texto: 'text-slate-300', borde: 'border-white/5',
    hover: 'hover:bg-white/5 hover:text-white', activo: 'text-white',
    titulo: 'text-white', sub: 'text-slate-500', dato: 'text-slate-300',
    btn: 'border-slate-700 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 hover:bg-rose-500/10',
  },
  claro: {
    fondo: 'bg-white', texto: 'text-slate-600', borde: 'border-slate-200',
    hover: 'hover:bg-slate-100 hover:text-slate-900', activo: 'text-white',
    titulo: 'text-slate-900', sub: 'text-slate-400', dato: 'text-slate-700',
    btn: 'border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50',
  },
  color: {
    fondo: 'bg-primario-dark', texto: 'text-white/70', borde: 'border-white/10',
    hover: 'hover:bg-white/10 hover:text-white', activo: 'text-primario-dark',
    titulo: 'text-white', sub: 'text-white/50', dato: 'text-white/90',
    btn: 'border-white/20 text-white/70 hover:text-white hover:border-white/40 hover:bg-white/10',
  },
};

export default function Sidebar({ session }) {
  const location = useLocation();
  const { confirmar } = useUI();
  const { negocioId, puede, esDueno, nombreNegocio, esSuperAdmin, tema } = useNegocio();

  const S = ESTILOS[tema?.sidebar] || ESTILOS.oscuro;
  const bgActivo = tema?.sidebar === 'color' ? 'bg-white' : 'bg-primario';

  const [menuAbierto, setMenuAbierto] = useState(false);
  const [logo, setLogo] = useState(null);
  const [nombre, setNombre] = useState('SISTEMA ERP');

  useEffect(() => {
    if (!negocioId) return;
    const cargar = async () => {
      const { data } = await supabase.from('configuracion')
        .select('nombre, logo').eq('negocio_id', negocioId).maybeSingle();
      setNombre(data?.nombre || nombreNegocio || 'SISTEMA ERP');
      setLogo(data?.logo || null);
    };
    cargar();

    const canal = supabase.channel(`sidebar-${negocioId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'configuracion',
        filter: `negocio_id=eq.${negocioId}`,
      }, cargar).subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [negocioId, nombreNegocio]);

  useEffect(() => { setMenuAbierto(false); }, [location.pathname]);

  // Bloquea el scroll del body con el menú abierto en móvil
  useEffect(() => {
    document.body.style.overflow = menuAbierto ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuAbierto]);

  const cerrarSesion = async () => {
    const ok = await confirmar({
      titulo: 'Cerrar sesión',
      mensaje: '¿Seguro que quieres salir del sistema?',
      okTexto: 'Cerrar sesión', peligro: true,
    });
    if (ok) await supabase.auth.signOut();
  };

  const menuItems = [
    { icon: <LayoutDashboard size={20} />, label: 'Dashboard',        path: '/' },
    { icon: <FileText size={20} />,        label: 'Nueva Cotización', path: '/presupuestos' },
    { icon: <History size={20} />,         label: 'Historial',        path: '/historial' },
    ...(puede('ver_finanzas')         ? [{ icon: <Wallet size={20} />,   label: 'Finanzas',      path: '/finanzas' }] : []),
    { icon: <Users size={20} />,           label: 'Clientes',         path: '/clientes' },
    ...(puede('editar_configuracion') ? [{ icon: <Settings size={20} />, label: 'Configuración', path: '/configuracion' }] : []),
    ...(puede('gestionar_equipo')     ? [{ icon: <Shield size={20} />,   label: 'Equipo',        path: '/equipo' }] : []),
    ...(esSuperAdmin                  ? [{ icon: <Building2 size={20} />,label: 'Administración',path: '/administracion' }] : []),
    { icon: <UserCircle size={20} />,      label: 'Mi Cuenta',        path: '/mi-cuenta' },
  ];

  const Marca = ({ chico }) => (
    <div className="flex items-center gap-3 overflow-hidden min-w-0">
      {logo ? (
        <img src={logo} alt="Logo"
          className={`${chico ? 'h-8 w-8' : 'h-10 w-10'} object-contain rounded-lg bg-white p-1 shrink-0 shadow-sm`} />
      ) : (
        <div className={`${chico ? 'p-1.5' : 'p-2'} bg-primario rounded-xl text-white shrink-0 shadow-lg`}>
          <Zap size={chico ? 18 : 24} fill="white" />
        </div>
      )}
      <h1 className={`text-sm font-black ${S.titulo} tracking-tighter uppercase truncate`}>{nombre}</h1>
    </div>
  );

  return (
    <>
      {/* ── Barra superior móvil ── */}
      <div className={`md:hidden fixed top-0 left-0 w-full h-16 ${S.fondo} flex items-center
                       justify-between px-4 z-40 shadow-lg border-b ${S.borde}`}>
        <Marca chico />
        <button onClick={() => setMenuAbierto(true)}
          className={`p-2 rounded-xl ${S.texto} ${S.hover} transition`}>
          <Menu size={24} />
        </button>
      </div>

      {menuAbierto && (
        <div className="md:hidden fixed inset-0 bg-slate-900/60 z-40 backdrop-blur-sm animate-[fadeIn_.2s]"
          onClick={() => setMenuAbierto(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`fixed top-0 left-0 h-screen ${S.fondo} ${S.texto} flex flex-col shadow-2xl z-50 w-64
                         transition-transform duration-300 ease-out
                         ${menuAbierto ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>

        <div className={`px-6 md:px-6 py-4 md:py-6 flex items-center justify-between border-b ${S.borde} h-16 md:h-auto shrink-0`}>
          <div className="hidden md:block w-full"><Marca /></div>
          <span className={`md:hidden font-black ${S.titulo} uppercase tracking-widest text-xs`}>Menú</span>
          <button onClick={() => setMenuAbierto(false)}
            className={`md:hidden p-2 rounded-xl ${S.texto} ${S.hover} transition`}>
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1 py-4 md:py-6 overflow-y-auto scroll-sidebar">
          {menuItems.map(item => {
            const activo = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl transition-all font-bold text-[13px]
                  ${activo ? `${bgActivo} ${S.activo} shadow-lg` : S.hover}`}>
                <span className={activo ? 'scale-110 transition-transform' : ''}>{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={`p-4 border-t ${S.borde} space-y-3 shrink-0`}>
          <div className="px-2">
            <p className={`text-[9px] font-black ${S.sub} uppercase tracking-widest`}>
              {esDueno ? 'Dueño' : 'Empleado'}
            </p>
            <p className={`text-[11px] font-bold ${S.dato} truncate`} title={session?.user?.email}>
              {session?.user?.email}
            </p>
          </div>
          <button onClick={cerrarSesion}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl
                        text-[13px] font-bold border transition-all ${S.btn}`}>
            <LogOut size={16} /> Cerrar Sesión
          </button>
        </div>
      </aside>
    </>
  );
}