import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Save, FileDown, User, Calendar, CreditCard, FileText, Calculator, CheckCircle } from 'lucide-react';
import { supabase } from '../supabaseClient.js';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useNegocio } from '../context/NegocioContext.jsx';
import { hoyLocal, formatoMX } from '../utils/fecha.js';

export default function Presupuestos({ session }) {
  const { negocioId, puede, esDueno } = useNegocio();

  const location = useLocation();
  const navigate = useNavigate();

  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(false);
  
  const [config, setConfig] = useState({
    tituloDocumento: 'PRESUPUESTO',
    especialidad: '',
    nombre: '',
    direccion: '',
    telefono: '',
    logo: null,
    banco: '',
    cuentaNombre: '',
    cuentaNumero: '',
    condiciones: 'Se solicitará el 50% de anticipo antes del comienzo de la obra. El presupuesto tiene una vigencia de 15 días.',
    sitioWeb: ''
  });

  const [ventaId, setVentaId] = useState(null);
  const [clienteSeleccionado, setClienteSeleccionado] = useState('');
  const [fecha, setFecha] = useState(hoyLocal());
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [estado, setEstado] = useState('pendiente');
  const [incluirIva, setIncluirIva] = useState(false);

  const [conceptos, setConceptos] = useState([{ cantidad: 1, descripcion: '', precio: '' }]);

  useEffect(() => {
     if (!negocioId) return;
        
    const fetchDatosBase = async () => {
      const { data } = await supabase
        .from('clientes')
        .select('nombre, alias')
        .eq('negocio_id', negocioId)          
        .order('nombre');
      if (data) setClientes(data);

      const { data: cfg } = await supabase
        .from('configuracion')
        .select('*')
        .eq('negocio_id', negocioId)         
        .maybeSingle();  
      if (cfg) {
        setConfig({
          tituloDocumento: cfg.titulo_documento || 'PRESUPUESTO',
          especialidad: cfg.especialidad || '',
          nombre: cfg.nombre || '',
          direccion: cfg.direccion || '',
          telefono: cfg.telefono || '',
          logo: cfg.logo || null,
          banco: cfg.banco || 'Por definir en configuración',
          cuentaNombre: cfg.cuenta_nombre || 'Por definir en configuración',
          cuentaNumero: cfg.cuenta_numero || 'Por definir en configuración',
          condiciones: cfg.condiciones || 'Se solicitará el 50% de anticipo antes del comienzo de la obra. El presupuesto tiene una vigencia de 15 días.',
          sitioWeb: cfg.sitio_web || '@tuempresa'
        });
      }
    };
    fetchDatosBase();

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
          const match = item.match(/^(\d+)x\s+(.+?)(?:\s+\(\$([\d.]+)\))?$/);
          if (match) {
            return {
              cantidad: Number(match[1]),
              descripcion: match[2].trim(),
              precio: match[3] ? Number(match[3]) : '' 
            };
          }
          return { cantidad: 1, descripcion: item, precio: '' };
        });
        setConceptos(conceptosDesglosados.length > 0 ? conceptosDesglosados : [{ cantidad: 1, descripcion: '', precio: '' }]);
      }
    }
  }, [location.state, negocioId, session.user.id]);

  const seleccionarTodo = (e) => e.target.select();
  const agregarFila = () => setConceptos([...conceptos, { cantidad: 1, descripcion: '', precio: '' }]);
  const eliminarFila = (index) => setConceptos(conceptos.filter((_, i) => i !== index));
  
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
        if (descripciones[index + 1]) descripciones[index + 1].focus();
      }, 10);
    }
  };

  const subtotal = conceptos.reduce((acc, c) => acc + ((Number(c.cantidad) || 0) * (Number(c.precio) || 0)), 0);
  const montoIva = incluirIva ? subtotal * 0.16 : 0;
  const totalNeto = subtotal + montoIva;
  const tituloBoton = (config.tituloDocumento || 'PRESUPUESTO').toLowerCase().replace(/^./, (c) => c.toUpperCase());

  const generarPDF = () => {
    const conceptosLimpios = conceptos.filter(c => c.descripcion.trim() !== "" && c.cantidad > 0);
    if (conceptosLimpios.length === 0) return alert("Agrega al menos un concepto válido para el PDF.");

    const doc = new jsPDF();
    const hoy = formatoMX(fecha);
    const colorAcento = [22, 65, 94]; 
    const colorTexto = [70, 70, 70];
    const colorGrisClaro = [245, 246, 248];
    const tituloDoc = (config.tituloDocumento || "PRESUPUESTO").toUpperCase();

    //HEADER//
    if (config.logo) {
      doc.addImage(config.logo, 'PNG', 14, 12, 30, 30, '', 'FAST');
    } else {
      doc.setFontSize(20);
      doc.setTextColor(colorAcento[0], colorAcento[1], colorAcento[2]);
      doc.setFont(undefined, 'bold');
      doc.text(config.nombre || "MI EMPRESA", 14, 25);
    }

    doc.setFontSize(28);
    doc.setTextColor(colorAcento[0], colorAcento[1], colorAcento[2]);
    doc.setFont(undefined, 'bold');
    doc.text(tituloDoc, 196, 25, { align: "right", letterSpacing: 2 });

    // ZONA ROSA (Despegada del Logo)
    const infoY = 52; 
    doc.setFontSize(11);
    doc.setTextColor(colorAcento[0], colorAcento[1], colorAcento[2]);
    doc.setFont(undefined, 'bold');
    doc.text("INFORMACIÓN DEL CLIENTE", 14, infoY);
    
    doc.setFontSize(9);
    doc.setTextColor(colorTexto[0], colorTexto[1], colorTexto[2]);
    doc.setFont(undefined, 'normal');
    doc.text(`Nombre:  ${clienteSeleccionado || 'Público en General'}`, 14, infoY + 7);

    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    const numeroDocumento = ventaId
  ? String(location.state?.ventaEditar?.folio ?? ventaId).padStart(5, '0')
  : 'BORRADOR';
    doc.text(`${tituloDoc}: N° ${numeroDocumento}`, 196, infoY, { align: "right" });
    doc.text(`FECHA: ${hoy}`, 196, infoY + 5, { align: "right" });
    doc.text(`PAGO: ${metodoPago.toUpperCase()}`, 196, infoY + 10, { align: "right" });

    // 2. TABLA DE CONCEPTOS (Con margen inferior estricto para evitar sobreescritura)
    autoTable(doc, {
      startY: 75, 
      margin: { left: 14, right: 14, bottom: 95 }, // <- EL SECRETO: 95mm de margen inferior reservado siempre
      head: [['DESCRIPCIÓN', 'CANT.', 'PRECIO', 'SUBTOTAL']],
      body: conceptosLimpios.map(c => [
        c.descripcion, 
        c.cantidad, 
        `$${Number(c.precio).toLocaleString('es-MX', {minimumFractionDigits:2})}`,
        `$${(c.cantidad * c.precio).toLocaleString('es-MX', {minimumFractionDigits:2})}`
      ]),
      theme: 'striped', 
      styles: { fontSize: 9, cellPadding: 4, textColor: colorTexto },
      headStyles: { fillColor: colorAcento, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: colorGrisClaro },
      columnStyles: { 
        0: { cellWidth: 92 }, 
        1: { halign: 'center', cellWidth: 20 }, 
        2: { halign: 'right', cellWidth: 35 }, 
        3: { halign: 'right', cellWidth: 35 } 
      },
      // Esto dibuja el pie de página en TODAS las hojas automáticamente
      didDrawPage: function (data) {
        doc.setFontSize(9);
        doc.setTextColor(colorTexto[0], colorTexto[1], colorTexto[2]);
        doc.setFont(undefined, 'normal');
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.3);
        doc.line(14, 280, 196, 280); 
        const footerText = `${config.telefono || "Sin teléfono"}    |    ${config.sitioWeb || "@tuempresa"}    |    ${config.direccion || "Sin dirección"}`;
        doc.text(footerText, 105, 287, { align: "center" });
        // Número de página
        doc.setFontSize(8);
        doc.text(`Página ${data.pageNumber}`, 196, 287, { align: "right" });
      }
    });

    // ========================================================
    // COORDENADAS CONSTANTES PARA LA ÚLTIMA PÁGINA
    // ========================================================
    // Como bloqueamos 95mm de margen inferior, sabemos que la tabla NUNCA pasará de Y=202.
    // Esto nos permite usar coordenadas fijas y perfectas para el final de la última hoja.
    const baseY = 210;  // Para Zonas Azul (Banco) y Verde (Totales)
    const termsY = 245; // Para Zona Roja (Términos)

    // ZONA VERDE: TOTALES (Derecha)
    doc.setFontSize(10);
    doc.setTextColor(colorTexto[0], colorTexto[1], colorTexto[2]);
    doc.text("Subtotal", 155, baseY, { align: "right" });
    doc.text(`$${subtotal.toLocaleString('es-MX', {minimumFractionDigits:2})}`, 196, baseY, { align: "right" });
    
    let totalBoxY = baseY + 6;
    if (incluirIva) {
      doc.text("IVA (16%)", 155, baseY + 7, { align: "right" });
      doc.text(`$${montoIva.toLocaleString('es-MX', {minimumFractionDigits:2})}`, 196, baseY + 7, { align: "right" });
      totalBoxY += 7;
    }

    doc.setFillColor(colorAcento[0], colorAcento[1], colorAcento[2]);
    doc.roundedRect(135, totalBoxY - 5, 61, 9, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.text("TOTAL", 140, totalBoxY + 1);
    doc.text(`$${totalNeto.toLocaleString('es-MX', {minimumFractionDigits:2})}`, 194, totalBoxY + 1, { align: "right" });

    // ZONA AZUL: INFORMACIÓN DE PAGO (Izquierda)
    doc.setTextColor(colorAcento[0], colorAcento[1], colorAcento[2]);
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text("INFORMACIÓN DE PAGO", 14, baseY);

    doc.setFontSize(9);
    doc.setTextColor(colorTexto[0], colorTexto[1], colorTexto[2]);
    doc.setFont(undefined, 'bold'); doc.text("Banco:", 14, baseY + 7);
    doc.setFont(undefined, 'normal'); doc.text(config.banco, 35, baseY + 7);
    doc.setFont(undefined, 'bold'); doc.text("Nombre:", 14, baseY + 13);
    doc.setFont(undefined, 'normal'); doc.text(config.cuentaNombre, 35, baseY + 13);
    doc.setFont(undefined, 'bold'); doc.text("Cuenta:", 14, baseY + 19);
    doc.setFont(undefined, 'normal'); doc.text(config.cuentaNumero, 35, baseY + 19);

    // ZONA ROJA: TÉRMINOS Y CONDICIONES (Izquierda, más abajo)
    doc.setTextColor(colorAcento[0], colorAcento[1], colorAcento[2]);
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text("TÉRMINOS Y CONDICIONES", 14, termsY);
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.setFont(undefined, 'normal');
    const terminosFormateados = doc.splitTextToSize(config.condiciones, 100); 
    doc.text(terminosFormateados, 14, termsY + 6);

    doc.save(`${tituloDoc}_${clienteSeleccionado || 'General'}_${hoy.replace(/\//g, '-')}.pdf`);
  };

  const guardarVenta = async () => {
    if (!clienteSeleccionado) return alert("Por favor selecciona o escribe el nombre de un cliente.");
    if (totalNeto === 0) return alert("El presupuesto está en ceros. Agrega un precio válido.");

    setCargando(true);
    try {
      const descripcionCompleta = conceptos
        .filter(c => c.descripcion.trim() !== '')
        .map(c => `${c.cantidad}x ${c.descripcion} ($${c.precio || 0})`)
        .join(' | ');

      const datosGuardar = {
        cliente: clienteSeleccionado,
        descripcion: descripcionCompleta,
        monto: totalNeto,
        fecha: fecha,
        metodo_pago: metodoPago,
        estado: estado
      };

      if (ventaId) {
        const { error } = await supabase.from('ventas').update(datosGuardar).eq('id', ventaId);
        if (error) throw error;
        alert("Cotización actualizada correctamente.");
        navigate('/historial');
      } else {
        const { error } = await supabase.from('ventas').insert
        ([{ negocio_id: negocioId, 
        user_id: session.user.id, 
        ...datosGuardar }]);
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
            {ventaId ? 'Editar Documento' : 'Nuevo Documento'}
          </h2>
          <p className="text-slate-500 font-medium">Genera cotizaciones profesionales y regístralas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* PANEL IZQUIERDO */}
        <div className="xl:col-span-1 space-y-4">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-5">
            <h3 className="font-bold text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-3">
              <FileText size={18} /> Datos del Documento
            </h3>

            <div>
              <label className="text-xs font-black text-slate-400 uppercase ml-1">Cliente</label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <select
                  value={clienteSeleccionado}
                  onChange={(e) => setClienteSeleccionado(e.target.value)}
                  className="w-full p-3 pl-9 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 border border-slate-100 font-medium text-slate-700"
                >
                  <option value="">Público en General</option>
                  {clienteSeleccionado && !clientes.some(c => c.nombre === clienteSeleccionado) && (
                    <option value={clienteSeleccionado}>{clienteSeleccionado} (no registrado)</option>
                  )}
                  {clientes.map((c, i) => (
                    <option key={i} value={c.nombre}>{c.nombre}</option>
                  ))}
                </select>
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

        {/* PANEL DERECHO */}
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
                <div className="w-14"></div>
              </div>

              {conceptos.map((c, i) => (
                <div key={i} className="bg-slate-50 p-4 rounded-2xl mb-4 border border-slate-100 shadow-sm w-full overflow-hidden">
                  <div className="flex gap-2 mb-3 min-w-0">
                    <input 
                      type="number" 
                      placeholder="Cant" 
                      className="w-16 p-3 bg-white rounded-xl outline-none border border-slate-200 font-bold text-center flex-shrink-0" 
                      value={c.cantidad} 
                      onChange={(e) => actualizarFila(i, 'cantidad', e.target.value)} 
                      onFocus={seleccionarTodo}
                      onKeyDown={(e) => manejarTabulacionExtra(e, i, 'cantidad')}
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

            <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col items-end gap-4">
              
              <div className="w-full md:w-64 space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex justify-between text-sm font-medium text-slate-500">
                  <span>Subtotal</span>
                  <span>${subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                </div>
                
                <label className="flex items-center justify-between cursor-pointer group">
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      checked={incluirIva} 
                      onChange={(e) => setIncluirIva(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer border-slate-300"
                    />
                    <span className="text-sm font-bold text-slate-600 group-hover:text-slate-900 transition-colors">IVA (16%)</span>
                  </div>
                  <span className="text-sm font-medium text-slate-500">${montoIva.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                </label>

                <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between items-center">
                  <span className="font-black text-slate-800 uppercase">Total</span>
                  <span className="text-2xl font-black text-blue-600 tracking-tighter">
                    ${totalNeto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3 pt-4">
                <button 
                  onClick={generarPDF}
                  className="bg-slate-800 text-white px-6 py-4 rounded-2xl font-bold hover:bg-slate-900 transition flex justify-center items-center gap-2 shadow-lg shadow-slate-800/20"
                >
                  <FileDown size={20} /> Descargar {tituloBoton}
                </button>
                <button 
                  onClick={guardarVenta}
                  disabled={cargando}
                  className="bg-blue-600 text-white px-6 py-4 rounded-2xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-500/30 flex justify-center items-center gap-2 disabled:opacity-50"
                >
                  <Save size={20} /> {cargando ? 'Guardando...' : (ventaId ? 'Actualizar Sistema' : 'Registrar Venta')}
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}