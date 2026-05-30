import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Presupuestos from './pages/Presupuestos';
import Historial from './pages/Historial';
import Finanzas from './pages/Finanzas';
import Clientes from './pages/Clientes';
import Configuracion from './pages/Configuracion';

export default function App() {
  return (
    <div className="flex bg-slate-50 min-h-screen">
      {/* El Sidebar ahora funcionará correctamente con useLocation */}
      <Sidebar />

      {/* Contenido Principal */}
      <main className="flex-1 ml-64 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/presupuestos" element={<Presupuestos />} />
          <Route path="/historial" element={<Historial />} />
          <Route path="/finanzas" element={<Finanzas />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/configuracion" element={<Configuracion />} />
        </Routes>
      </main>
    </div>
  );
}