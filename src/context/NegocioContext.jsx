import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

const NegocioContext = createContext(null);
export const useNegocio = () => useContext(NegocioContext);

export function NegocioProvider({ session, children }) {
  const [miembro, setMiembro] = useState(null);
  const [esSuperAdmin, setEsSuperAdmin] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!session?.user?.id) return;
    let activo = true;
    

    (async () => {
      const { data, error } = await supabase
        .from('miembros')
        .select('*, negocios(nombre)')
        .eq('user_id', session.user.id)
        .maybeSingle();
      const { data: sa } = await supabase.rpc('es_super_admin');
if (activo) setEsSuperAdmin(sa === true);

      if (!activo) return;
      if (error) setError(error.message);
      else if (!data) setError('SIN_NEGOCIO');
      else setMiembro(data);
      setCargando(false);
    })();
    
    

    return () => { activo = false; };
  }, [session?.user?.id]);

  const esDueno = miembro?.rol === 'dueno';
  const puede = (permiso) => esDueno || miembro?.permisos?.[permiso] === true;
  

  return (
    <NegocioContext.Provider value={{
      miembro,
      negocioId: miembro?.negocio_id ?? null,
      nombreNegocio: miembro?.negocios?.nombre ?? '',
      esDueno,
      puede,
      cargando,
      error,
      esSuperAdmin,
    }}>
      {children}
      
    </NegocioContext.Provider>
  );
}

/** Envuelve una página que requiere permiso */
export function Protegido({ permiso, children }) {
  const { puede } = useNegocio();
  if (!puede(permiso)) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center max-w-md shadow-sm">
          <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">🔒</div>
          <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">Acceso restringido</h3>
          <p className="text-slate-500 font-medium text-sm mt-2">
            No tienes permiso para ver esta sección. Pídele al dueño del negocio que te lo habilite.
          </p>
        </div>
      </div>
    );
  }
  return children;
}