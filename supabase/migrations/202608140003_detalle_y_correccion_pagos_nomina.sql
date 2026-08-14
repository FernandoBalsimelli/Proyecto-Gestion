-- Fechas exactas cubiertas y correcciones auditables de pagos de empleados.

alter table public.empleado_pagos
  add column if not exists fechas_cubiertas date[] not null default '{}';

-- Al corregir un pago, se corrige su gasto asociado en la misma transacción.
create or replace function public.sincronizar_gasto_pago_empleado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text;
begin
  if new.monto is not distinct from old.monto
     and new.fecha_inicio is not distinct from old.fecha_inicio
     and new.empleado_id is not distinct from old.empleado_id
     and new.dias_pagados is not distinct from old.dias_pagados then
    return new;
  end if;

  select nombre into v_nombre from public.empleados where id = new.empleado_id;
  if old.gasto_id is not null then
    update public.gastos
      set monto = new.monto,
          fecha = new.fecha_inicio,
          descripcion = 'Pago de empleado — ' || coalesce(v_nombre, 'Empleado') || ' · ' || new.dias_pagados || ' día(s)',
          categoria = 'Nómina'
      where id = old.gasto_id;
  end if;
  return new;
end;
$$;

drop trigger if exists empleado_pagos_sincronizar_gasto on public.empleado_pagos;
create trigger empleado_pagos_sincronizar_gasto
before update on public.empleado_pagos
for each row execute function public.sincronizar_gasto_pago_empleado();

create or replace function public.eliminar_gasto_pago_empleado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.gasto_id is not null then
    delete from public.gastos where id = old.gasto_id;
  end if;
  return old;
end;
$$;

drop trigger if exists empleado_pagos_eliminar_gasto on public.empleado_pagos;
create trigger empleado_pagos_eliminar_gasto
before delete on public.empleado_pagos
for each row execute function public.eliminar_gasto_pago_empleado();

drop policy if exists empleado_pagos_actualizar on public.empleado_pagos;
create policy empleado_pagos_actualizar on public.empleado_pagos for update
using (exists (
  select 1 from public.miembros m
  where m.negocio_id = empleado_pagos.negocio_id and m.user_id = auth.uid()
    and (m.rol = 'dueno' or coalesce((m.permisos ->> 'gestionar_nomina')::boolean, false))
))
with check (exists (
  select 1 from public.miembros m
  where m.negocio_id = empleado_pagos.negocio_id and m.user_id = auth.uid()
    and (m.rol = 'dueno' or coalesce((m.permisos ->> 'gestionar_nomina')::boolean, false))
));

drop policy if exists empleado_pagos_eliminar on public.empleado_pagos;
create policy empleado_pagos_eliminar on public.empleado_pagos for delete
using (exists (
  select 1 from public.miembros m
  where m.negocio_id = empleado_pagos.negocio_id and m.user_id = auth.uid()
    and (m.rol = 'dueno' or coalesce((m.permisos ->> 'gestionar_nomina')::boolean, false))
));
