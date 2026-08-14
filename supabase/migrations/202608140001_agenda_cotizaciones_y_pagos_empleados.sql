-- Agenda ↔ cotización y pagos de empleados.
-- Ejecuta esta migración con `supabase db push` o pégala completa en el SQL Editor.

alter table public.agenda
  add column if not exists venta_id uuid references public.ventas(id) on delete set null;

create index if not exists agenda_venta_id_idx on public.agenda(venta_id);

create table if not exists public.empleado_pagos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  empleado_id uuid not null references public.empleados(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  tipo text not null default 'anticipo' check (tipo in ('anticipo', 'nomina', 'ajuste')),
  fecha_inicio date not null,
  fecha_fin date not null,
  dias_pagados numeric(8,2) not null check (dias_pagados > 0),
  monto numeric(14,2) not null check (monto > 0),
  nota text,
  gasto_id uuid references public.gastos(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint empleado_pagos_rango_fechas check (fecha_fin >= fecha_inicio)
);

create index if not exists empleado_pagos_negocio_fecha_idx
  on public.empleado_pagos(negocio_id, fecha_inicio desc);
create index if not exists empleado_pagos_empleado_fecha_idx
  on public.empleado_pagos(empleado_id, fecha_inicio desc);

-- El trigger garantiza consistencia: nunca puede existir un pago que no se
-- refleje en los gastos y, por tanto, en utilidad neta.
create or replace function public.registrar_gasto_pago_empleado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text;
  v_gasto_id uuid;
begin
  select nombre into v_nombre from public.empleados where id = new.empleado_id;

  insert into public.gastos (
    negocio_id, user_id, descripcion, categoria, proveedor, monto, fecha
  ) values (
    new.negocio_id,
    new.user_id,
    'Pago de empleado — ' || coalesce(v_nombre, 'Empleado') || ' · ' || new.dias_pagados || ' día(s)',
    'Nómina',
    null,
    new.monto,
    new.fecha_inicio
  ) returning id into v_gasto_id;

  update public.empleado_pagos set gasto_id = v_gasto_id where id = new.id;
  return new;
end;
$$;

drop trigger if exists empleado_pagos_crear_gasto on public.empleado_pagos;
create trigger empleado_pagos_crear_gasto
after insert on public.empleado_pagos
for each row execute function public.registrar_gasto_pago_empleado();

alter table public.empleado_pagos enable row level security;

drop policy if exists empleado_pagos_leer on public.empleado_pagos;
create policy empleado_pagos_leer on public.empleado_pagos for select
using (exists (
  select 1 from public.miembros m
  where m.negocio_id = empleado_pagos.negocio_id and m.user_id = auth.uid()
));

drop policy if exists empleado_pagos_insertar on public.empleado_pagos;
create policy empleado_pagos_insertar on public.empleado_pagos for insert
with check (exists (
  select 1 from public.miembros m
  where m.negocio_id = empleado_pagos.negocio_id and m.user_id = auth.uid()
    and (m.rol = 'dueno' or coalesce((m.permisos ->> 'gestionar_nomina')::boolean, false))
));

-- Los pagos quedan inmutables para conservar una auditoría confiable. Si se
-- cometió un error, registra un ajuste en vez de borrar el pago original.
