import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  History, 
  Wallet, 
  Users, 
  Settings, 
  Zap,
  Menu,
  X
} from 'lucide-react';

export default function Sidebar() {
  const location = useLocation();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [datosEmpresa, setDatosEmpresa] = useState({
    nombre: 'SISTEMA ERP',
    logo: null,
    pieSidebar: '2026'
  });

  const cargarDatos = () => {
    const guardado = JSON.parse(localStorage.getItem('erp_datos_empresa'));
    if (guardado) {
      setDatosEmpresa({
        nombre: guardado.nombre || 'SISTEMA ERP',
        logo: guardado.logo || null,
        pieSidebar: guardado.pieSidebar || '2026'
      });
    }
  };

  useEffect(() => {
    cargarDatos();
    window.addEventListener('storage', cargarDatos);
    return () => window.removeEventListener('storage', cargarDatos);
  }, []);

  // Cierra el menú al cambiar de página en el celular
  useEffect(() => {
    setMenuAbierto(false);
  }, [location.pathname]);

  const menuItems = [
    { icon: <LayoutDashboard size={20}/>, label: 'Dashboard', path: '/' },
    { icon: <FileText size={20}/>, label: 'Nueva Cotización', path: '/presupuestos' },
    { icon: <History size={20}/>, label: 'Historial', path: '/historial' },
    { icon: <Wallet size={20}/>, label: 'Finanzas', path: '/finanzas' },
    { icon: <Users size={20}/>, label: 'Clientes', path: '/clientes' },
    { icon: <Settings size={20}/>, label: 'Configuración', path: '/configuracion' },
  ];

  return (
    <>
      {/* BARRA SUPERIOR (SOLO MÓVIL) */}
      <div className="md:hidden fixed top-0 left-0 w-full h-16 bg-slate-900 flex items-center justify-between px-4 z-40 shadow-lg border-b border-slate-800">
        <div className="flex items-center gap-3">
          {datosEmpresa.logo ? (
            <img src={datosEmpresa.logo} alt="Logo" className="h-8 w-8 object-contain rounded-lg bg-white p-1" />
          ) : (
            <div className="p-1.5 bg-blue-600 rounded-lg text-white">
              <Zap size={18} fill="white"/>
            </div>
          )}
          <h1 className="text-sm font-black text-white tracking-tighter uppercase truncate">
            {datosEmpresa.nombre}
          </h1>
        </div>
        <button 
          onClick={() => setMenuAbierto(true)} 
          className="p-2 text-slate-300 hover:text-white transition-colors"
        >
          <Menu size={24} />
        </button>
      </div>

      {/* OVERLAY OSCURO PARA MÓVIL */}
      {menuAbierto && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm transition-opacity" 
          onClick={() => setMenuAbierto(false)}
        />
      )}

      {/* BARRA LATERAL (Fija en PC, deslizante en móvil) */}
      <div className={`
        fixed top-0 left-0 h-screen bg-slate-900 text-slate-300 flex flex-col shadow-2xl z-50 w-64 
        transition-transform duration-300 ease-in-out
        ${menuAbierto ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0
      `}>
        <div className="p-6 md:p-8 flex items-center justify-between border-b border-white/5 h-16 md:h-auto">
          <div className="flex items-center gap-3 overflow-hidden">
            {datosEmpresa.logo ? (
              <img src={datosEmpresa.logo} alt="Logo" className="h-10 w-10 object-contain rounded-lg bg-white p-1 shrink-0 hidden md:block" />
            ) : (
              <div className="p-2 bg-blue-600 rounded-xl text-white shadow-lg shrink-0 hidden md:block">
                <Zap size={24} fill="white"/>
              </div>
            )}
            <h1 className="text-sm font-black text-white tracking-tighter uppercase leading-tight truncate hidden md:block">
              {datosEmpresa.nombre}
            </h1>
            <span className="md:hidden font-black text-white uppercase tracking-widest text-xs">Menú</span>
          </div>
          
          <button 
            onClick={() => setMenuAbierto(false)} 
            className="md:hidden p-2 text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4 md:mt-8 overflow-y-auto">
          {menuItems.map((item) => (
            <Link 
              key={item.path} 
              to={item.path} 
              className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all font-bold text-[13px] ${
                location.pathname === item.path 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 md:translate-x-1' 
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              {item.icon} {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-8 border-t border-white/5">
          <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] text-center leading-relaxed">
            {datosEmpresa.pieSidebar}
          </p>
        </div>
      </div>
    </>
  );
}