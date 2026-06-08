import React, { useState, useEffect } from 'react';
import { UserPlus, Search, Edit2, Trash2, Save, Mail, Smartphone, MapPin } from 'lucide-react';
import { supabase } from '../supabaseClient.js'; // Asegúrate de que la ruta sea correcta

export default function Clientes({ session }) {
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [cargando, setCargando] = useState(false);
  

  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    correo: '',
    direccion: ''
  });

  // CARGAR DATOS DESDE SUPABASE
  const fetchClientes = async () => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      console.error('Error al cargar clientes:', error.message);
    }
  };

  useEffect(() => {
    fetchClientes();
  }, []);

  const manejarCambio = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // GUARDAR O ACTUALIZAR CLIENTE EN SUPABASE
  const guardarCliente = async (e) => {
    e.preventDefault();
    setCargando(true);

    if (!formData.nombre || formData.nombre.length < 3) {
      alert("El nombre debe tener al menos 3 caracteres");
      setCargando(false);
      return;
    }
    
    try {
      if (editandoId) {
        // Actualizar registro existente
        const { error } = await supabase
          .from('clientes')
          .update({
            nombre: formData.nombre,
            telefono: formData.telefono,
            correo: formData.correo,
            direccion: formData.direccion
          })
          .eq('id', editandoId);

        if (error) throw error;
      } else {
        // Insertar nuevo registro
        const { error } = await supabase
          .from('clientes')
          .insert([{
            user_id: session.user.id,
            nombre: formData.nombre,
            telefono: formData.telefono,
            correo: formData.correo,
            direccion: formData.direccion
          }]);

        if (error) throw error;
      }

      // Recargar la lista y limpiar el formulario
      await fetchClientes();
      resetForm();
    } catch (error) {
      alert("Error al guardar: " + error.message);
    } finally {
      setCargando(false);
    }
  };

  const resetForm = () => {
    setFormData({ nombre: '', telefono: '', correo: '', direccion: '' });
    setEditandoId(null);
  };

  const iniciarEdicion = (cliente) => {
    setEditandoId(cliente.id);
    setFormData({
      nombre: cliente.nombre,
      telefono: cliente.telefono || '',
      correo: cliente.correo || '',
      direccion: cliente.direccion || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ELIMINAR CLIENTE EN SUPABASE
  const eliminarCliente = async (id) => {
    if (window.confirm("¿Estás seguro de eliminar este registro?")) {
      try {
        const { error } = await supabase
          .from('clientes')
          .delete()
          .eq('id', id);

        if (error) throw error;
        await fetchClientes();
      } catch (error) {
        alert("Error al eliminar: " + error.message);
      }
    }
  };

  const clientesFiltrados = clientes.filter(c => {
    const search = busqueda.toLowerCase();
    const nombreMatches = (c.nombre || "").toLowerCase().includes(search);
    return nombreMatches;
  });

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tighter uppercase">
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
                <input 
                  name="nombre" 
                  value={formData.nombre} 
                  onChange={manejarCambio} 
                  className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/10" 
                  placeholder="Ej. Juan Pérez" 
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Teléfono</label>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input 
                    name="telefono" 
                    value={formData.telefono} 
                    onChange={manejarCambio} 
                    className="w-full p-3 pl-9 bg-slate-50 rounded-xl border border-slate-100 font-bold outline-none" 
                    placeholder="Número de contacto" 
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input 
                    name="correo" 
                    type="email"
                    value={formData.correo} 
                    onChange={manejarCambio} 
                    className="w-full p-3 pl-9 bg-slate-50 rounded-xl border border-slate-100 font-bold outline-none" 
                    placeholder="correo@ejemplo.com" 
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Dirección de Servicio</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                  <textarea 
                    name="direccion" 
                    value={formData.direccion} 
                    onChange={manejarCambio} 
                    rows="3"
                    className="w-full p-3 pl-9 bg-slate-50 rounded-xl border border-slate-100 font-bold outline-none resize-none" 
                    placeholder="Calle y colonia" 
                  ></textarea>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button 
                type="submit" 
                disabled={cargando}
                className="flex-1 bg-slate-900 text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition shadow-lg disabled:opacity-50"
              >
                <Save size={18}/> 
                {cargando ? 'Guardando...' : (editandoId ? 'Guardar Cambios' : 'Registrar')}
              </button>
              
              {editandoId && (
                <button 
                  type="button" 
                  onClick={resetForm} 
                  className="bg-slate-100 text-slate-500 p-4 rounded-2xl font-bold hover:bg-slate-200 transition"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>

        {/* LISTA DE CLIENTES */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Buscar por nombre..." 
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full bg-white border border-slate-200 p-4 pl-12 rounded-2xl font-bold text-slate-700 outline-none focus:border-blue-500 shadow-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {clientesFiltrados.length === 0 ? (
              <div className="col-span-full p-8 text-center text-slate-400 bg-white rounded-3xl border border-slate-200 border-dashed">
                No se encontraron clientes. Registra tu primer cliente para comenzar.
              </div>
            ) : (
              clientesFiltrados.map((cliente) => (
                <div key={cliente.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition group">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-black text-slate-800 text-lg">{cliente.nombre}</h4>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => iniciarEdicion(cliente)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl">
                        <Edit2 size={16}/>
                      </button>
                      <button onClick={() => eliminarCliente(cliente.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-xl">
                        <Trash2 size={16}/>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-slate-500 font-medium">
                    {cliente.telefono && (
                      <p className="flex items-center gap-2"><Smartphone size={14}/> {cliente.telefono}</p>
                    )}
                    {cliente.correo && (
                      <p className="flex items-center gap-2"><Mail size={14}/> {cliente.correo}</p>
                    )}
                    {cliente.direccion && (
                      <p className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
                        <MapPin size={14} className="min-w-max"/> {cliente.direccion}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}