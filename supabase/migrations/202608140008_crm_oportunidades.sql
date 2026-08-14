-- CRM comercial opcional. Las oportunidades se pueden ocultar desde
-- Configuración → Producto sin borrar el historial.
create table if not exists public.oportunidades (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete set null,
  venta_id uuid references public.ventas(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  nombre text not null,
  contacto text,
  telefono text,
  correo text,
  origen text not null default 'referido' check (origen in ('referido','redes','web','llamada','visita','otro')),
  etapa text not null default 'nuevo' check (etapa in ('nuevo','contactado','cotizado','negociacion','ganado','perdido')),
  monto_estimado numeric(14,2) not null default 0 check (monto_estimado >= 0),
  probabilidad smallint not null default 30 check (probabilidad between 0 and 100),
  proximo_contacto date,
  notas text,
  motivo_perdida text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists oportunidades_negocio_etapa_idx on public.oportunidades(negocio_id, etapa);
create index if not exists oportunidades_seguimiento_idx on public.oportunidades(negocio_id, proximo_contacto) where proximo_contacto is not null;

create or replace function public.puede_comercial(p_negocio uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.miembros m where m.negocio_id=p_negocio and m.user_id=auth.uid()
    and (m.rol='dueno' or coalesce((m.permisos->>'gestionar_comercial')::boolean,false)))
$$;

alter table public.oportunidades enable row level security;
drop policy if exists oportunidades_leer on public.oportunidades;
drop policy if exists oportunidades_escribir on public.oportunidades;
create policy oportunidades_leer on public.oportunidades for select using (
  exists(select 1 from public.miembros m where m.negocio_id=oportunidades.negocio_id and m.user_id=auth.uid())
);
create policy oportunidades_escribir on public.oportunidades for all
  using (public.puede_comercial(negocio_id)) with check (public.puede_comercial(negocio_id));
