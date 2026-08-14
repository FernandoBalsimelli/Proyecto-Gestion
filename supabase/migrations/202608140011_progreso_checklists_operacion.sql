-- Progreso persistente para las listas de verificación del Centro de operaciones.
alter table public.checklists_operativas
  add column if not exists progreso jsonb not null default '[]'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.checklists_operativas
  drop constraint if exists checklists_operativas_progreso_es_arreglo,
  add constraint checklists_operativas_progreso_es_arreglo
  check (jsonb_typeof(progreso) = 'array' and jsonb_array_length(progreso) <= 30);
