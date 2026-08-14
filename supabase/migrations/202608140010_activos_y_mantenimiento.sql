-- Activos físicos: herramientas, vehículos, equipo o maquinaria.
create table if not exists public.activos_negocio (
  id uuid primary key default gen_random_uuid(), negocio_id uuid not null references public.negocios(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null, nombre text not null check (char_length(nombre) between 1 and 140),
  categoria text not null default 'Herramienta' check (char_length(categoria) <= 60), codigo text check (char_length(coalesce(codigo,'')) <= 60),
  estado text not null default 'disponible' check (estado in ('disponible','en_uso','mantenimiento','baja')),
  proximo_mantenimiento date, notas text check (char_length(coalesce(notas,'')) <= 1000), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.mantenimientos_activos (
  id uuid primary key default gen_random_uuid(), negocio_id uuid not null references public.negocios(id) on delete cascade,
  activo_id uuid not null references public.activos_negocio(id) on delete cascade, user_id uuid references auth.users(id) on delete set null,
  fecha date not null default current_date, descripcion text not null check (char_length(descripcion) between 1 and 500), costo numeric(14,2) not null default 0 check (costo >= 0), proximo_mantenimiento date, created_at timestamptz not null default now()
);
create index if not exists activos_mantenimiento_idx on public.activos_negocio(negocio_id, estado, proximo_mantenimiento);
create index if not exists mantenimientos_activo_idx on public.mantenimientos_activos(activo_id, fecha desc);
alter table public.activos_negocio enable row level security; alter table public.mantenimientos_activos enable row level security;
drop policy if exists activos_negocio_leer on public.activos_negocio; drop policy if exists activos_negocio_escribir on public.activos_negocio;
drop policy if exists mantenimientos_activos_leer on public.mantenimientos_activos; drop policy if exists mantenimientos_activos_escribir on public.mantenimientos_activos;
create policy activos_negocio_leer on public.activos_negocio for select using (exists(select 1 from public.miembros m where m.negocio_id=activos_negocio.negocio_id and m.user_id=auth.uid()));
create policy activos_negocio_escribir on public.activos_negocio for all using (public.puede_operaciones(negocio_id)) with check (public.puede_operaciones(negocio_id));
create policy mantenimientos_activos_leer on public.mantenimientos_activos for select using (exists(select 1 from public.miembros m where m.negocio_id=mantenimientos_activos.negocio_id and m.user_id=auth.uid()));
create policy mantenimientos_activos_escribir on public.mantenimientos_activos for all using (public.puede_operaciones(negocio_id)) with check (public.puede_operaciones(negocio_id));
