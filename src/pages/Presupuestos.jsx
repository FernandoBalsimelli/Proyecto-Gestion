import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Lock, AlertTriangle, CalendarDays, UserX } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Presupuestos() {
  const location = useLocation();
  const navigate = useNavigate();
  const editandoData = location.state?.editando;
  const primerInputRef = useRef(null);

  const [clientes, setClientes] = useState([]);
  const [conceptos, setConceptos] = useState(editandoData?.conceptos || [{ descripcion: '', cantidad: 1, precio: 0 }]);
  const [seleccion, setSeleccion] = useState({ clienteId: '' });
  const [config, setConfig] = useState({});
  const [datosExtra, setDatosExtra] = useState({ 
    numPresupuesto: editandoData?.folio || 1, 
    diasVigencia: editandoData?.diasVigencia || '30', 
    preparadoPor: editandoData?.preparadoPor || '' 
  });

  useEffect(() => {
    const clientesGuardados = JSON.parse(localStorage.getItem('erp_clientes')) || [];
    const empresaGuardada = JSON.parse(localStorage.getItem('erp_datos_empresa')) || {};
    const historial = JSON.parse(localStorage.getItem('erp_historial_presupuestos')) || [];
    
    const clientesProcesados = clientesGuardados
      .filter(c => (c.status === 'ACTIVE' || !c.status) && (c.name || c.nombre))
      .map(c => ({ ...c, name: c.name || c.nombre }));
    
    setClientes(clientesProcesados);
    setConfig(empresaGuardada);

    if (!editandoData) {
      if (historial.length > 0) {
        const ultimoFolio = Math.max(...historial.map(h => h.folio));
        setDatosExtra(prev => ({ ...prev, numPresupuesto: ultimoFolio + 1 }));
      }
    } else {
      const cliente = clientesProcesados.find(c => c.name === editandoData.cliente);
      if (cliente) setSeleccion({ clienteId: cliente.id });
    }
    if (primerInputRef.current) primerInputRef.current.focus();
  }, [editandoData]);

  const seleccionarTodo = (e) => e.target.select();

  const agregarFila = () => {
    setConceptos([...conceptos, { descripcion: '', cantidad: 1, precio: 0 }]);
  };

  // --- ATAJOS DE TECLADO ---
  const manejarTabulacionExtra = (e, index, campo) => {
    // Si presiona Enter en cualquier campo, o Tab en el último campo (precio)
    if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey && campo === 'precio' && index === conceptos.length - 1)) {
      e.preventDefault();
      agregarFila();
      // Pequeño delay para que React renderice la nueva fila y podamos darle focus
      setTimeout(() => {
        const descripciones = document.querySelectorAll('.input-descripcion');
        descripciones[index + 1]?.focus();
      }, 10);
    }
  };

  const actualizarFila = (index, campo, valor) => {
    const nuevos = [...conceptos];
    let valorFinal = valor;
    if (campo === 'cantidad' || campo === 'precio') {
      valorFinal = Math.max(0, parseFloat(valor) || 0);
    }
    nuevos[index][campo] = valorFinal;
    setConceptos(nuevos);
  };

  const subtotal = conceptos.reduce((acc, c) => acc + (parseFloat(c.cantidad || 0) * parseFloat(c.precio || 0)), 0);
  const total = subtotal * 1.16;

  const guardarYGenerar = () => {
    const clienteActivo = clientes.find(c => c.id == seleccion.clienteId);
    if (!clienteActivo || !datosExtra.preparadoPor) return alert("Falta cliente o responsable.");

    const conceptosLimpios = conceptos.filter(c => c.descripcion.trim() !== "" && c.cantidad > 0);
    const totalLimpio = conceptosLimpios.reduce((acc, c) => acc + (c.cantidad * c.precio), 0) * 1.16;

    const doc = new jsPDF();
    const hoy = new Date().toLocaleDateString('es-MX');
    const fechaVenceObj = new Date();
    fechaVenceObj.setDate(fechaVenceObj.getDate() + parseInt(datosExtra.diasVigencia));
    const fechaVence = fechaVenceObj.toLocaleDateString('es-MX');

    doc.setFontSize(22);
    doc.setFont(undefined, 'bold');
    doc.text(config.tituloDocumento || "PRESUPUESTO", 14, 25);
    doc.setFontSize(14);
    doc.text(config.especialidad || "ELECTRICO", 14, 32);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(config.nombre || "Servicios Eléctricos", 14, 42);
    doc.text(config.direccion || "Dirección no configurada", 14, 47);
    doc.text(`Tel: ${config.telefono || ""}`, 14, 52);

    autoTable(doc, {
      startY: 20, margin: { left: 130 },
      body: [
        ["Fecha:", hoy],
        ["Folio:", datosExtra.numPresupuesto],
        ["Vence:", fechaVence],
        ["Atendió:", datosExtra.preparadoPor]
      ],
      theme: 'plain', styles: { fontSize: 9 }
    });

    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text("PRESUPUESTO PARA:", 14, 70);
    doc.setFont(undefined, 'normal');
    doc.text(`${clienteActivo.name}`, 14, 77);
    doc.text(`RFC: ${clienteActivo.RFC || 'N/A'}`, 14, 82);

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
    doc.text(`TOTAL (IVA Inc.): $${totalLimpio.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, 120, finalY);

    const nuevoRegistro = {
      id: editandoData?.id || Date.now(),
      folio: datosExtra.numPresupuesto,
      fecha: hoy,
      vencimiento: fechaVence,
      cliente: clienteActivo.name,
      total: totalLimpio,
      conceptos: conceptosLimpios,
      preparadoPor: datosExtra.preparadoPor,
      diasVigencia: datosExtra.diasVigencia
    };

    let historial = JSON.parse(localStorage.getItem('erp_historial_presupuestos')) || [];
    if (editandoData) {
      historial = historial.map(h => h.id === editandoData.id ? nuevoRegistro : h);
    } else {
      historial = [nuevoRegistro, ...historial];
    }

    localStorage.setItem('erp_historial_presupuestos', JSON.stringify(historial));
    doc.save(`Presupuesto_${datosExtra.numPresupuesto}.pdf`);
    navigate('/historial');
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Cotización</h2>
        <button onClick={guardarYGenerar} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-blue-700 transition shadow-lg">
          Generar y Guardar
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200">
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Folio</label>
            <div className="bg-slate-900 p-4 rounded-2xl flex justify-between items-center mb-6">
              <p className="text-2xl font-black text-white">{datosExtra.numPresupuesto}</p>
              <Lock size={18} className="text-blue-400 opacity-50"/>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Cliente</label>
                <select className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold outline-none" value={seleccion.clienteId} onChange={(e) => setSeleccion({...seleccion, clienteId: e.target.value})}>
                  <option value="">Seleccionar...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Validez</label>
                <div className="relative">
                    <CalendarDays className="absolute left-3 top-3 text-slate-400" size={18}/>
                    <select 
                      className="w-full p-3 pl-10 bg-slate-50 rounded-xl border border-slate-100 font-bold outline-none appearance-none" 
                      value={datosExtra.diasVigencia} 
                      onChange={e => setDatosExtra({...datosExtra, diasVigencia: e.target.value})}
                    >
                      <option value="30">30 Días</option>
                      <option value="15">15 Días</option>
                      <option value="7">7 Días</option>
                    </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Atendió</label>
                <input 
                  className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold outline-none" 
                  value={datosExtra.preparadoPor} 
                  onChange={e => setDatosExtra({...datosExtra, preparadoPor: e.target.value})}
                  onFocus={seleccionarTodo}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 bg-white p-6 rounded-3xl border border-slate-200 min-h-[400px]">
          <div className="space-y-3">
            {conceptos.map((c, i) => (
              <div key={i} className="grid grid-cols-12 gap-3 items-center">
                <input 
                  type="number" className="col-span-1 p-3 bg-slate-50 rounded-xl text-center font-bold outline-none" 
                  value={c.cantidad} onChange={(e) => actualizarFila(i, 'cantidad', e.target.value)}
                  onFocus={seleccionarTodo}
                  onKeyDown={(e) => manejarTabulacionExtra(e, i, 'cantidad')}
                />
                <input 
                  className="input-descripcion col-span-8 p-3 bg-slate-50 rounded-xl outline-none" 
                  placeholder="Descripción del servicio" value={c.descripcion} 
                  onChange={(e) => actualizarFila(i, 'descripcion', e.target.value)} 
                  onKeyDown={(e) => manejarTabulacionExtra(e, i, 'descripcion')}
                />
                <input 
                  type="number" className="col-span-2 p-3 bg-slate-50 rounded-xl font-bold text-right outline-none" 
                  value={c.precio} onChange={(e) => actualizarFila(i, 'precio', e.target.value)}
                  onFocus={seleccionarTodo}
                  onKeyDown={(e) => manejarTabulacionExtra(e, i, 'precio')}
                />
                <button className="col-span-1 text-slate-300 hover:text-red-500 flex justify-center" onClick={() => setConceptos(conceptos.filter((_, idx) => idx !== i))}>
                  <Trash2 size={18}/>
                </button>
              </div>
            ))}
            <button onClick={agregarFila} className="text-blue-600 font-bold p-2 flex items-center gap-2 mt-4">
              <Plus size={18}/> Agregar Línea
            </button>
          </div>
          <div className="mt-10 text-right border-t pt-6">
            <p className="text-5xl font-black text-slate-900">${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">IVA Incluido (16%)</p>
          </div>
        </div>
      </div>
    </div>
  );
}