-- Centro de operación opcional: tareas, metas, notas, gastos recurrentes y checklists.
create table if not exists public.tareas_operativas (
  id uuid primary key default gen_random_uuid(), negocio_id uuid not null references public.negocios(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete set null, agenda_id uuid references public.agenda(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null, titulo text not null check (char_length(titulo) between 1 and 120),
  detalle text check (char_length(coalesce(detalle,'')) <= 1500), prioridad text not null default 'normal' check (prioridad in ('baja','normal','alta')),
  estado text not null default 'pendiente' check (estado in ('pendiente','en_proceso','hecha','cancelada')),
  fecha_limite date, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.metas_negocio (
  id uuid primary key default gen_random_uuid(), negocio_id uuid not null references public.negocios(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  nombre text not null check (char_length(nombre) between 1 and 100), metrica text not null check (metrica in ('ingresos','ventas','clientes','cobranza','personalizada')),
  objetivo numeric(14,2) not null check (objetivo > 0), periodo text not null default 'mes' check (periodo in ('mes','trimestre','anio')), activa boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.notas_negocio (
  id uuid primary key default gen_random_uuid(), negocio_id uuid not null references public.negocios(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null, titulo text not null check (char_length(titulo) between 1 and 120),
  contenido text not null check (char_length(contenido) between 1 and 3000), color text not null default 'amarillo' check (color in ('amarillo','azul','verde','rosa')), fijada boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.gastos_recurrentes (
  id uuid primary key default gen_random_uuid(), negocio_id uuid not null references public.negocios(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null, descripcion text not null check (char_length(descripcion) between 1 and 180), categoria text not null default 'Servicios' check (char_length(categoria) <= 40), proveedor text check (char_length(coalesce(proveedor,'')) <= 120), monto numeric(14,2) not null check (monto > 0), frecuencia text not null default 'mensual' check (frecuencia in ('mensual','semanal')), proxima_fecha date not null, activo boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.checklists_operativas (
  id uuid primary key default gen_random_uuid(), negocio_id uuid not null references public.negocios(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  nombre text not null check (char_length(nombre) between 1 and 120), tipo text not null default 'general' check (char_length(tipo) <= 50), items jsonb not null default '[]'::jsonb, created_at timestamptz not null default now(), check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 30)
);
create index if not exists tareas_operativas_fecha_idx on public.tareas_operativas(negocio_id, estado, fecha_limite);
create index if not exists gastos_recurrentes_fecha_idx on public.gastos_recurrentes(negocio_id, activo, proxima_fecha);
create or replace function public.puede_operaciones(p_negocio uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.miembros m where m.negocio_id=p_negocio and m.user_id=auth.uid() and (m.rol='dueno' or coalesce((m.permisos->>'gestionar_operaciones')::boolean,false))) $$;
alter table public.tareas_operativas enable row level security; alter table public.metas_negocio enable row level security; alter table public.notas_negocio enable row level security; alter table public.gastos_recurrentes enable row level security; alter table public.checklists_operativas enable row level security;
drop policy if exists tareas_operativas_leer on public.tareas_operativas; drop policy if exists tareas_operativas_escribir on public.tareas_operativas;
drop policy if exists metas_negocio_leer on public.metas_negocio; drop policy if exists metas_negocio_escribir on public.metas_negocio;
drop policy if exists notas_negocio_leer on public.notas_negocio; drop policy if exists notas_negocio_escribir on public.notas_negocio;
drop policy if exists gastos_recurrentes_leer on public.gastos_recurrentes; drop policy if exists gastos_recurrentes_escribir on public.gastos_recurrentes;
drop policy if exists checklists_operativas_leer on public.checklists_operativas; drop policy if exists checklists_operativas_escribir on public.checklists_operativas;
create policy tareas_operativas_leer on public.tareas_operativas for select using (exists(select 1 from public.miembros m where m.negocio_id=tareas_operativas.negocio_id and m.user_id=auth.uid()));
create policy tareas_operativas_escribir on public.tareas_operativas for all using (public.puede_operaciones(negocio_id)) with check (public.puede_operaciones(negocio_id));
create policy metas_negocio_leer on public.metas_negocio for select using (exists(select 1 from public.miembros m where m.negocio_id=metas_negocio.negocio_id and m.user_id=auth.uid()));
create policy metas_negocio_escribir on public.metas_negocio for all using (public.puede_operaciones(negocio_id)) with check (public.puede_operaciones(negocio_id));
create policy notas_negocio_leer on public.notas_negocio for select using (exists(select 1 from public.miembros m where m.negocio_id=notas_negocio.negocio_id and m.user_id=auth.uid()));
create policy notas_negocio_escribir on public.notas_negocio for all using (public.puede_operaciones(negocio_id)) with check (public.puede_operaciones(negocio_id));
create policy gastos_recurrentes_leer on public.gastos_recurrentes for select using (exists(select 1 from public.miembros m where m.negocio_id=gastos_recurrentes.negocio_id and m.user_id=auth.uid()));
create policy gastos_recurrentes_escribir on public.gastos_recurrentes for all using (public.puede_operaciones(negocio_id)) with check (public.puede_operaciones(negocio_id));
create policy checklists_operativas_leer on public.checklists_operativas for select using (exists(select 1 from public.miembros m where m.negocio_id=checklists_operativas.negocio_id and m.user_id=auth.uid()));
create policy checklists_operativas_escribir on public.checklists_operativas for all using (public.puede_operaciones(negocio_id)) with check (public.puede_operaciones(negocio_id));
