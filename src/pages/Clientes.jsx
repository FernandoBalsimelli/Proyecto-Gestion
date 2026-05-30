import React, { useState, useEffect } from 'react';
import { UserPlus, Search, Edit2, Trash2, Save, X, Building2, Smartphone, Mail, Hash, MapPin, CalendarDays } from 'lucide-react';

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  
  // Estado alineado con el DTO del Backend (NestJS / Class Validator)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    RFC: '',
    bussinessName: '',
    postalCode: '',
    city: '',
    taxRegime: '',
    status: 'ACTIVE'
  });

  // Cargar datos provisionales de LocalStorage
  useEffect(() => {
    const guardados = JSON.parse(localStorage.getItem('erp_clientes')) || [];
    setClientes(guardados);
  }, []);

  const manejarCambio = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const guardarCliente = (e) => {
    e.preventDefault();
    
    // Validaciones front-end (Espejo de los decorators del backend)
    if (!formData.name || formData.name.length < 3) return alert("El nombre debe tener al menos 3 caracteres");
    if (!formData.phone) return alert("El teléfono es obligatorio");
    if (!formData.city || formData.city.length < 3) return alert("La ciudad debe tener al menos 3 caracteres");

    let nuevosClientes;
    if (editandoId) {
      nuevosClientes = clientes.map(c => c.id === editandoId ? { ...formData, id: editandoId } : c);
    } else {
      const nuevo = { ...formData, id: Date.now() };
      nuevosClientes = [nuevo, ...clientes];
    }

    setClientes(nuevosClientes);
    localStorage.setItem('erp_clientes', JSON.stringify(nuevosClientes));
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '', email: '', phone: '', RFC: '',
      bussinessName: '', postalCode: '', city: '',
      taxRegime: '', status: 'ACTIVE'
    });
    setEditandoId(null);
  };

  const iniciarEdicion = (cliente) => {
    setEditandoId(cliente.id);
    setFormData(cliente);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const eliminarCliente = (id) => {
    if (window.confirm("¿Estás seguro de eliminar este registro?")) {
      const filtrados = clientes.filter(c => c.id !== id);
      setClientes(filtrados);
      localStorage.setItem('erp_clientes', JSON.stringify(filtrados));
    }
  };

  // FILTRADO SEGURO (Previene el error de 'toLowerCase' en campos nulos)
  const clientesFiltrados = clientes.filter(c => {
    const search = busqueda.toLowerCase();
    const nombreMatches = (c.name || "").toLowerCase().includes(search);
    const rfcMatches = (c.RFC || "").toLowerCase().includes(search);
    const businessMatches = (c.bussinessName || "").toLowerCase().includes(search);
    
    return nombreMatches || rfcMatches || businessMatches;
  });

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">
          Directorio de Clientes
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* FORMULARIO DE REGISTRO */}
        <div className="lg:col-span-1">
          <form onSubmit={guardarCliente} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 sticky top-8 space-y-4">
            <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2 mb-2">
              {editandoId ? <Edit2 size={20} className="text-blue-600"/> : <UserPlus size={20} className="text-blue-600"/>}
              {editandoId ? 'Actualizar Cliente' : 'Nuevo Cliente'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Nombre Completo *</label>
                <input name="name" value={formData.name} onChange={manejarCambio} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/10" placeholder="Nombre del contacto" />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Teléfono *</label>
                  <input name="phone" value={formData.phone} onChange={manejarCambio} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold outline-none" placeholder="614..." />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Email</label>
                  <input name="email" value={formData.email} onChange={manejarCambio} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold outline-none" placeholder="correo@ejemplo.com" />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-4">
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Información Fiscal</p>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">RFC</label>
                    <input name="RFC" value={formData.RFC} onChange={manejarCambio} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold outline-none" placeholder="XAXX01..." />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Código Postal</label>
                    <input name="postalCode" value={formData.postalCode} onChange={manejarCambio} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold outline-none" placeholder="31000" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Razón Social</label>
                  <input name="bussinessName" value={formData.bussinessName} onChange={manejarCambio} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold outline-none" placeholder="Nombre legal" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Ciudad *</label>
                    <input name="city" value={formData.city} onChange={manejarCambio} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold outline-none" placeholder="Chihuahua" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Estatus</label>
                    <select name="status" value={formData.status} onChange={manejarCambio} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold outline-none">
                      <option value="ACTIVE">Activo</option>
                      <option value="INACTIVE">Inactivo</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Régimen Fiscal</label>
                  <input name="taxRegime" value={formData.taxRegime} onChange={manejarCambio} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold outline-none" placeholder="Ej. 601" />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button type="submit" className="flex-1 bg-slate-900 text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition shadow-lg">
                  <Save size={18}/> {editandoId ? 'Guardar Cambios' : 'Registrar'}
                </button>
                {editandoId && (
                  <button type="button" onClick={resetForm} className="bg-slate-100 text-slate-500 p-4 rounded-2xl font-bold hover:bg-slate-200 transition">
                    <X size={18}/>
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* LISTADO DE TARJETAS */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-4 text-slate-400" size={20}/>
            <input 
              type="text" 
              placeholder="Buscar por nombre, RFC o razón social..." 
              className="w-full p-4 pl-12 bg-white rounded-3xl shadow-sm border border-slate-200 outline-none font-medium focus:ring-2 focus:ring-blue-500/10"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {clientesFiltrados.map(cliente => (
              <div key={cliente.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:border-blue-300 transition-all group relative overflow-hidden">
                <div className={`absolute top-0 right-0 w-1 h-full ${cliente.status === 'ACTIVE' ? 'bg-green-500' : 'bg-red-400'}`}></div>
                
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-slate-900 text-white p-2.5 rounded-xl">
                      <Building2 size={20}/>
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800 uppercase text-sm leading-tight">{cliente.name || "Sin nombre"}</h4>
                      <p className="text-[10px] font-bold text-blue-600">{cliente.RFC || 'PÚBLICO EN GENERAL'}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => iniciarEdicion(cliente)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                      <Edit2 size={16}/>
                    </button>
                    <button onClick={() => eliminarCliente(cliente.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 size={16}/>
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-50 text-[11px] font-bold text-slate-500">
                  <div className="flex items-center gap-2"><Smartphone size={14} className="text-slate-300"/> {cliente.phone}</div>
                  <div className="flex items-center gap-2"><MapPin size={14} className="text-slate-300"/> {cliente.city}</div>
                  <div className="flex items-center gap-2 col-span-2 truncate"><Mail size={14} className="text-slate-300"/> {cliente.email || 'Sin correo registrado'}</div>
                </div>
              </div>
            ))}
          </div>

          {clientesFiltrados.length === 0 && (
            <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
              <p className="text-slate-400 font-bold">No se encontraron clientes con ese criterio.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}