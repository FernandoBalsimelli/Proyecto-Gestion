import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  History, 
  Wallet, 
  Users, 
  Settings, 
  Zap 
} from 'lucide-react';

export default function Sidebar() {
  const location = useLocation();
  const [datosEmpresa, setDatosEmpresa] = useState({
    nombre: 'SISTEMA ERP',
    logo: null,
    pieSidebar: '2026' // Valor por defecto limpio
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

  const menuItems = [
    { icon: <LayoutDashboard size={20}/>, label: 'Dashboard', path: '/' },
    { icon: <FileText size={20}/>, label: 'Nueva Cotización', path: '/presupuestos' },
    { icon: <History size={20}/>, label: 'Historial', path: '/historial' },
    { icon: <Wallet size={20}/>, label: 'Finanzas', path: '/finanzas' },
    { icon: <Users size={20}/>, label: 'Clientes', path: '/clientes' },
    { icon: <Settings size={20}/>, label: 'Configuración', path: '/configuracion' },
  ];

  return (
    <div className="w-64 h-screen bg-slate-900 text-slate-300 flex flex-col fixed left-0 top-0 shadow-2xl z-50">
      <div className="p-8 flex items-center gap-3 border-b border-white/5">
        {datosEmpresa.logo ? (
          <img src={datosEmpresa.logo} alt="Logo" className="h-10 w-10 object-contain rounded-lg bg-white p-1" />
        ) : (
          <div className="p-2 bg-blue-600 rounded-xl text-white shadow-lg">
            <Zap size={24} fill="white"/>
          </div>
        )}
        <h1 className="text-sm font-black text-white tracking-tighter uppercase leading-tight truncate">
          {datosEmpresa.nombre}
        </h1>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-8">
        {menuItems.map((item) => (
          <Link 
            key={item.path} 
            to={item.path} 
            className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all font-bold text-[13px] ${
              location.pathname === item.path 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 translate-x-1' 
                : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            {item.icon} {item.label}
          </Link>
        ))}
      </nav>

      {/* PIE DE PÁGINA PERSONALIZABLE */}
      <div className="p-8 border-t border-white/5">
        <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] text-center leading-relaxed">
          {datosEmpresa.pieSidebar}
        </p>
      </div>
    </div>
  );
}