-- Módulos opcionales por negocio. Desactivarlos solo cambia la experiencia;
-- no elimina historial ni tablas.

alter table public.configuracion
  add column if not exists modulos jsonb not null default '{"agenda": true, "finanzas": true, "nomina": true}'::jsonb;
