-- Tablas propias de almacén para evitar conflictos con módulos existentes
-- o instalaciones anteriores.
create table if not exists public.almacen_proveedores (
  id uuid primary key default gen_random_uuid(), negocio_id uuid not null references public.negocios(id) on delete cascade,
  nombre text not null, telefono text, email text, contacto text, notas text, created_at timestamptz not null default now()
);
create table if not exists public.almacen_articulos (
  id uuid primary key default gen_random_uuid(), negocio_id uuid not null references public.negocios(id) on delete cascade,
  proveedor_id uuid references public.almacen_proveedores(id) on delete set null, nombre text not null, sku text, unidad text not null default 'pieza',
  existencias numeric(14,2) not null default 0, minimo numeric(14,2) not null default 0, costo numeric(14,2) not null default 0, activo boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.almacen_movimientos (
  id uuid primary key default gen_random_uuid(), negocio_id uuid not null references public.negocios(id) on delete cascade,
  articulo_id uuid not null references public.almacen_articulos(id) on delete cascade, user_id uuid references auth.users(id) on delete set null,
  tipo text not null check (tipo in ('entrada','salida','ajuste')), cantidad numeric(14,2) not null check (cantidad > 0), nota text, fecha date not null default current_date, created_at timestamptz not null default now()
);
create index if not exists almacen_proveedores_negocio_idx on public.almacen_proveedores(negocio_id);
create index if not exists almacen_articulos_negocio_idx on public.almacen_articulos(negocio_id, activo);
create index if not exists almacen_movimientos_articulo_idx on public.almacen_movimientos(articulo_id, fecha desc);
create or replace function public.puede_inventario(p_negocio uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from miembros m where m.negocio_id=p_negocio and m.user_id=auth.uid() and (m.rol='dueno' or coalesce((m.permisos->>'gestionar_inventario')::boolean,false))) $$;
alter table public.almacen_proveedores enable row level security;
alter table public.almacen_articulos enable row level security;
alter table public.almacen_movimientos enable row level security;
drop policy if exists almacen_proveedores_leer on public.almacen_proveedores;
drop policy if exists almacen_proveedores_escribir on public.almacen_proveedores;
drop policy if exists almacen_articulos_leer on public.almacen_articulos;
drop policy if exists almacen_articulos_escribir on public.almacen_articulos;
drop policy if exists almacen_movimientos_leer on public.almacen_movimientos;
drop policy if exists almacen_movimientos_insertar on public.almacen_movimientos;
create policy almacen_proveedores_leer on public.almacen_proveedores for select using (exists(select 1 from public.miembros m where m.negocio_id=almacen_proveedores.negocio_id and m.user_id=auth.uid()));
create policy almacen_proveedores_escribir on public.almacen_proveedores for all using (public.puede_inventario(negocio_id)) with check (public.puede_inventario(negocio_id));
create policy almacen_articulos_leer on public.almacen_articulos for select using (exists(select 1 from public.miembros m where m.negocio_id=almacen_articulos.negocio_id and m.user_id=auth.uid()));
create policy almacen_articulos_escribir on public.almacen_articulos for all using (public.puede_inventario(negocio_id)) with check (public.puede_inventario(negocio_id));
create policy almacen_movimientos_leer on public.almacen_movimientos for select using (exists(select 1 from public.miembros m where m.negocio_id=almacen_movimientos.negocio_id and m.user_id=auth.uid()));
create policy almacen_movimientos_insertar on public.almacen_movimientos for insert with check (public.puede_inventario(negocio_id));
