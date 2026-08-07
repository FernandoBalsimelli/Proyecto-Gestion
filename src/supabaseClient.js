import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  const msg = 'Faltan las variables VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY.'
  console.error('[Supabase]', msg)
  if (typeof document !== 'undefined') {
    document.body.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;
                  background:#0f172a;color:#fff;font-family:system-ui;padding:2rem;text-align:center">
        <div style="max-width:28rem">
          <div style="font-size:3rem;margin-bottom:1rem">⚙️</div>
          <h1 style="font-size:1.25rem;font-weight:700;margin-bottom:.5rem">Configuración incompleta</h1>
          <p style="color:#94a3b8;font-size:.875rem;line-height:1.5">${msg}</p>
          <p style="color:#64748b;font-size:.75rem;margin-top:1rem">
            En Vercel: Settings → Environment Variables → agrégalas y haz Redeploy.
          </p>
        </div>
      </div>`
  }
  throw new Error(msg)
}

export const supabase = createClient(url, key, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})