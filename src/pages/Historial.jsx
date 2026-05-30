import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Search, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  Clock, 
  ExternalLink 
} from 'lucide-react';

export default function Historial() {
  const [presupuestos, setPresupuestos] = useState([]);
  const [filtro, setFiltro] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const datos = JSON.parse(localStorage.getItem('erp_historial_presupuestos')) || [];
    setPresupuestos(datos);
  }, []);

  const cambiarEstadoPago = (id) => {
    const nuevos = presupuestos.map(p => {
      if (p.id === id) {
        // Si no tiene estado, lo ponemos como PAGADO. Si ya es PAGADO, lo regresamos a PENDIENTE.
        return { ...p, estado: p.estado === 'PAGADO' ? 'PENDIENTE' : 'PAGADO' };
      }
      return p;
    });
    setPresupuestos(nuevos);
    localStorage.setItem('erp_historial_presupuestos', JSON.stringify(nuevos));
  };

  const eliminar = (id) => {
    if (!window.confirm("¿Seguro que quieres eliminar este presupuesto?")) return;
    const nuevos = presupuestos.filter(p => p.id !== id);
    setPresupuestos(nuevos);
    localStorage.setItem('erp_historial_presupuestos', JSON.stringify(nuevos));
  };

  const filtrados = presupuestos.filter(p => 
    p.cliente.toLowerCase().includes(filtro.toLowerCase()) || 
    p.folio.toString().includes(filtro)
  );

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Historial</h2>
          <p className="text-slate-500 font-medium">Gestiona y convierte presupuestos en ingresos</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-3 text-slate-400" size={20}/>
          <input 
            className="pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none w-80 font-bold text-slate-700 shadow-sm"
            placeholder="Buscar por cliente o folio..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="p-5 text-[10px] font-black text-slate-400 uppercase">Folio</th>
              <th className="p-5 text-[10px] font-black text-slate-400 uppercase">Cliente</th>
              <th className="p-5 text-[10px] font-black text-slate-400 uppercase text-center">Estado</th>
              <th className="p-5 text-[10px] font-black text-slate-400 uppercase text-right">Total</th>
              <th className="p-5 text-[10px] font-black text-slate-400 uppercase text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtrados.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/50 transition">
                <td className="p-5 font-black text-slate-900">#{p.folio}</td>
                <td className="p-5">
                  <p className="font-bold text-slate-700">{p.cliente}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{p.fecha}</p>
                </td>
                <td className="p-5">
                  <button 
                    onClick={() => cambiarEstadoPago(p.id)}
                    className={`mx-auto flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                      p.estado === 'PAGADO' 
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                      : 'bg-amber-50 text-amber-600 border border-amber-100'
                    }`}
                  >
                    {p.estado === 'PAGADO' ? <CheckCircle2 size={14}/> : <Clock size={14}/>}
                    {p.estado === 'PAGADO' ? 'Pagado' : 'Pendiente'}
                  </button>
                </td>
                <td className="p-5 text-right font-black text-slate-900">
                  ${p.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </td>
                <td className="p-5 text-right space-x-2">
                  <button onClick={() => navigate('/presupuestos', { state: { editando: p }})} className="p-2 text-slate-400 hover:text-blue-600 transition"><Edit3 size={18}/></button>
                  <button onClick={() => eliminar(p.id)} className="p-2 text-slate-400 hover:text-red-500 transition"><Trash2 size={18}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}