import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Save, FileDown, User, Calendar, CreditCard, FileText, Calculator, CheckCircle } from 'lucide-react';
import { supabase } from '../supabaseClient.js';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Presupuestos({ session }) {
  const location = useLocation();
  const navigate = useNavigate();

  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [config, setConfig] = useState({});

  // Estados del formulario general
  const [ventaId, setVentaId] = useState(null); // Nuevo: para saber si editamos
  const [clienteSeleccionado, setClienteSeleccionado] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [estado, setEstado] = useState('pendiente'); // Nuevo: Pendiente o Pagado

  // Estado de las líneas de la cotización
  const [conceptos, setConceptos] = useState([
    { cantidad: 1, descripcion: '', precio: '' }
  ]);

  useEffect(() => {
    // 1. Cargar datos base (clientes y configuración)
    const fetchDatosBase = async () => {
      const { data } = await supabase.from('clientes').select('nombre').order('nombre');
      if (data) setClientes(data);

      const { data: cfg } = await supabase.from('configuracion').select('*').eq('user_id', session.user.id).single();
      if (cfg) setConfig({
        tituloDocumento: cfg.titulo_documento, especialidad: cfg.especialidad,
        nombre: cfg.nombre, direccion: cfg.direccion, telefono: cfg.telefono
      });
    };
    fetchDatosBase();

// 2. RECIBIR DATOS DEL HISTORIAL (Desglose Inteligente para Formatos Viejos y Nuevos)
    if (location.state?.ventaEditar) {
      const v = location.state.ventaEditar;
      setVentaId(v.id);
      setClienteSeleccionado(v.cliente || '');
      setFecha(v.fecha || new Date().toISOString().split('T')[0]);
      setMetodoPago(v.metodo_pago || 'Efectivo');
      setEstado(v.estado || 'pendiente');

      if (v.descripcion) {
        const conceptosDesglosados = v.descripcion.split(' | ').map(item => {
          item = item.trim();
          // Expresión regular que soporta formato viejo "2x Cable" y nuevo "2x Cable ($150)"
          const match = item.match(/^(\d+)x\s+(.+?)(?:\s+\(\$([\d.]+)\))?$/);
          
          if (match) {
            return {
              cantidad: Number(match[1]),
              descripcion: match[2].trim(),
              precio: match[3] ? Number(match[3]) : '' // Si no tiene precio (formato viejo), lo deja en blanco para que lo llenes
            };
          }
          // Si por alguna razón el texto está súper raro, lo mete todo como descripción sin romper la app
          return { cantidad: 1, descripcion: item, precio: '' };
        });
        
        setConceptos(conceptosDesglosados.length > 0 ? conceptosDesglosados : [{ cantidad: 1, descripcion: '', precio: '' }]);
      }
    }
  }, [location.state, session.user.id]);

  // ==========================================
  // FUNCIONES DE INTERFAZ Y ATAJOS DE TECLADO
  // ==========================================
  const seleccionarTodo = (e) => e.target.select();

  const agregarFila = () => {
    setConceptos([...conceptos, { cantidad: 1, descripcion: '', precio: '' }]);
  };

  const eliminarFila = (index) => {
    const nuevosConceptos = conceptos.filter((_, i) => i !== index);
    setConceptos(nuevosConceptos);
  };

  const actualizarFila = (index, campo, valor) => {
    const nuevosConceptos = [...conceptos];
    nuevosConceptos[index][campo] = valor;
    setConceptos(nuevosConceptos);
  };

  const manejarTabulacionExtra = (e, index, campo) => {
    if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey && campo === 'precio' && index === conceptos.length - 1)) {
      e.preventDefault();
      agregarFila();
      setTimeout(() => {
        const descripciones = document.querySelectorAll('.input-descripcion');
        if (descripciones[index + 1]) {
          descripciones[index + 1].focus();
        }
      }, 10);
    }
  };

  const total = conceptos.reduce((acc, c) => {
    const cant = Number(c.cantidad) || 0;
    const prec = Number(c.precio) || 0;
    return acc + (cant * prec);
  }, 0);

  // ==========================================
  // 1. GENERAR DOCUMENTO PDF (Formato Original tuyo)
  // ==========================================
  const generarPDF = () => {
    const conceptosLimpios = conceptos.filter(c => c.descripcion.trim() !== "" && c.cantidad > 0);
    if (conceptosLimpios.length === 0) return alert("Agrega al menos un concepto válido para el PDF.");

    const doc = new jsPDF();
    const hoy = fecha.split('-').reverse().join('/');
    
    doc.setFontSize(22);
    doc.setFont(undefined, 'bold');
    doc.text(config.tituloDocumento || "PRESUPUESTO", 14, 25);
    
    doc.setFontSize(14);
    doc.text(config.especialidad || "SERVICIOS PROFESIONALES", 14, 32);
    
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(config.nombre || "Mi Empresa", 14, 42);
    doc.text(config.direccion || "Dirección no configurada", 14, 47);
    doc.text(`Tel: ${config.telefono || "No registrado"}`, 14, 52);

    autoTable(doc, {
      startY: 20, 
      margin: { left: 130 },
      body: [
        ["Fecha:", hoy],
        ["Método de Pago:", metodoPago]
      ],
      theme: 'plain', 
      styles: { fontSize: 9 }
    });

    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text("PRESUPUESTO PARA:", 14, 70);
    doc.setFont(undefined, 'normal');
    doc.text(`${clienteSeleccionado || 'Público en General'}`, 14, 77);

    autoTable(doc, {
      startY: 90,
      head: [['CANT.', 'DESCRIPCIÓN', 'UNITARIO', 'IMPORTE']],
      body: conceptosLimpios.map(c => [
        c.cantidad, 
        c.descripcion, 
        `$${parseFloat(c.precio).toLocaleString('es-MX', {minimumFractionDigits:2})}`,
        `$${(c.cantidad * c.precio).toLocaleString('es-MX', {minimumFractionDigits:2})}`
      ]),
      theme: 'grid',
      headStyles: { fillColor: [0, 0, 0] },
      columnStyles: { 0: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' } }
    });

    const finalY = doc.lastAutoTable.finalY + 15;
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`TOTAL: $${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, 120, finalY);

    doc.save(`Cotizacion_${clienteSeleccionado || 'General'}_${hoy.replace(/\//g, '-')}.pdf`);
  };

  // ==========================================
  // 2. GUARDAR / ACTUALIZAR EN SUPABASE
  // ==========================================
  const guardarVenta = async () => {
    if (!clienteSeleccionado) return alert("Por favor selecciona o escribe el nombre de un cliente.");
    if (total === 0) return alert("El presupuesto está en ceros. Agrega un precio válido.");

    setCargando(true);
    try {
      // Ahora guardamos el precio exacto para recuperarlo al editar sin errores matemáticos
      const descripcionCompleta = conceptos
        .filter(c => c.descripcion.trim() !== '')
        .map(c => `${c.cantidad}x ${c.descripcion} ($${c.precio || 0})`)
        .join(' | ');

      if (ventaId) {
        // MODO EDICIÓN
        const { error } = await supabase
          .from('ventas')
          .update({
            cliente: clienteSeleccionado,
            descripcion: descripcionCompleta,
            monto: total,
            fecha: fecha,
            metodo_pago: metodoPago,
            estado: estado
          })
          .eq('id', ventaId);
        if (error) throw error;
        alert("Cotización actualizada correctamente.");
        navigate('/historial'); // Volvemos al historial tras editar
      } else {
        // MODO NUEVO REGISTRO
        const { error } = await supabase
          .from('ventas')
          .insert([{
            user_id: session.user.id,
            cliente: clienteSeleccionado,
            descripcion: descripcionCompleta,
            monto: total,
            fecha: fecha,
            metodo_pago: metodoPago,
            estado: estado
          }]);
        if (error) throw error;
        alert("Cotización registrada exitosamente en tu historial.");
        setClienteSeleccionado('');
        setConceptos([{ cantidad: 1, descripcion: '', precio: '' }]);
      }
    } catch (error) {
      alert("Error al guardar: " + error.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tighter uppercase flex items-center gap-2">
            <Calculator className="text-blue-600" /> 
            {ventaId ? 'Editar Presupuesto' : 'Nuevo Presupuesto'}
          </h2>
          <p className="text-slate-500 font-medium">Genera cotizaciones y regístralas como ventas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* PANEL IZQUIERDO: Datos Generales */}
        <div className="xl:col-span-1 space-y-4">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-5">
            <h3 className="font-bold text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-3">
              <FileText size={18} /> Datos del Documento
            </h3>

            <div>
              <label className="text-xs font-black text-slate-400 uppercase ml-1">Cliente</label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                  type="text" 
                  list="lista-clientes"
                  placeholder="Selecciona o escribe..."
                  value={clienteSeleccionado}
                  onChange={(e) => setClienteSeleccionado(e.target.value)}
                  className="w-full p-3 pl-9 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 border border-slate-100 font-medium text-slate-700"
                />
                <datalist id="lista-clientes">
                  {clientes.map((c, i) => (
                    <option key={i} value={c.nombre} />
                  ))}
                </datalist>
              </div>
            </div>

            <div>
              <label className="text-xs font-black text-slate-400 uppercase ml-1">Fecha</label>
              <div className="relative mt-1">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                  type="date" 
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full p-3 pl-9 bg-slate-50 rounded-xl outline-none border border-slate-100 font-medium text-slate-700"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-black text-slate-400 uppercase ml-1">Método de Pago</label>
              <div className="relative mt-1">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <select 
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  className="w-full p-3 pl-9 bg-slate-50 rounded-xl outline-none border border-slate-100 font-medium text-slate-700"
                >
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Tarjeta">Tarjeta</option>
                  <option value="Por definir">Por definir</option>
                </select>
              </div>
            </div>

            {/* SECTOR ESTADO DE PAGO (Pendiente/Pagado) INTEGRADITO EN EL DISEÑO */}
            <div className="pt-2">
              <label className="text-xs font-black text-slate-400 uppercase ml-1">Estado del Servicio</label>
              <div className="relative mt-1">
                <CheckCircle className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${estado === 'pagado' ? 'text-emerald-500' : 'text-amber-500'}`} />
                <select 
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className={`w-full p-3 pl-9 rounded-xl outline-none border font-bold transition-colors ${estado === 'pagado' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}
                >
                  <option value="pendiente">Pendiente (Por cobrar)</option>
                  <option value="pagado">Pagado (Completado)</option>
                </select>
              </div>
            </div>

          </div>
        </div>

        {/* PANEL DERECHO: Conceptos y Total */}
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-700">Conceptos del Servicio</h3>
              <button 
                onClick={agregarFila}
                className="text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 text-sm transition"
              >
                <Plus size={16} /> Agregar línea
              </button>
            </div>

            <div className="space-y-3">
              <div className="hidden md:flex gap-2 text-xs font-black text-slate-400 uppercase px-2">
                <div className="w-20">Cant.</div>
                <div className="flex-1">Descripción del Servicio / Material</div>
                <div className="w-32 text-right pr-4">Precio</div>
                <div className="w-12"></div>
              </div>

              {conceptos.map((c, i) => (
  <div key={i} className="bg-slate-50 p-4 rounded-2xl mb-4 border border-slate-100 shadow-sm w-full overflow-hidden">
    {/* Agregué 'min-w-0' al contenedor flex y a los inputs */}
    <div className="flex gap-2 mb-3 min-w-0">
      <input 
        type="number" 
        placeholder="Cant" 
        className="w-16 p-3 bg-white rounded-xl outline-none border border-slate-200 font-bold text-center flex-shrink-0" 
        value={c.cantidad} 
        onChange={(e) => actualizarFila(i, 'cantidad', e.target.value)} 
      />
      <input 
        type="text" 
        placeholder="Descripción..." 
        className="input-descripcion flex-1 p-3 bg-white rounded-xl outline-none border border-slate-200 font-medium min-w-0" 
        value={c.descripcion} 
        onChange={(e) => actualizarFila(i, 'descripcion', e.target.value)} 
        onKeyDown={(e) => manejarTabulacionExtra(e, i, 'descripcion')}
      />
    </div>
    
    <div className="flex gap-2">
      <input 
        type="number" 
        placeholder="Precio" 
        className="flex-1 p-3 bg-white rounded-xl outline-none border border-slate-200 text-right font-bold text-slate-700 min-w-0" 
        value={c.precio} 
        onChange={(e) => actualizarFila(i, 'precio', e.target.value)} 
        onFocus={seleccionarTodo}
        onKeyDown={(e) => manejarTabulacionExtra(e, i, 'precio')}
      />
      <button 
        onClick={() => eliminarFila(i)} 
        className="w-14 flex justify-center items-center text-red-400 bg-red-50 hover:bg-red-100 rounded-xl transition flex-shrink-0"
      >
        <Trash2 size={20}/>
      </button>
    </div>
  </div>
))}
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="text-center md:text-left">
                <p className="text-sm font-bold text-slate-400 uppercase">Total Estimado</p>
                <p className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter">
                  ${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
              </div>

              {/* BOTONES ORIGINALES INTACTOS */}
              <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3">
                <button 
                  onClick={generarPDF}
                  className="bg-slate-100 text-slate-700 px-6 py-4 rounded-2xl font-bold hover:bg-slate-200 transition flex justify-center items-center gap-2"
                >
                  <FileDown size={20} /> Generar PDF
                </button>
                <button 
                  onClick={guardarVenta}
                  disabled={cargando}
                  className="bg-blue-600 text-white px-6 py-4 rounded-2xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-500/30 flex justify-center items-center gap-2 disabled:opacity-50"
                >
                  <Save size={20} /> {cargando ? 'Guardando...' : (ventaId ? 'Actualizar Venta' : 'Registrar Venta')}
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}