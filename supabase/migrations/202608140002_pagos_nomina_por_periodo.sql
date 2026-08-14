-- Vincula los pagos automáticos con el periodo y recibo de nómina que los
-- originó. La restricción evita pagar dos veces al mismo empleado por el
-- mismo periodo desde el flujo automático.

alter table public.empleado_pagos
  add column if not exists periodo_id uuid references public.nomina_periodos(id) on delete set null;

create unique index if not exists empleado_pagos_unico_por_periodo_idx
  on public.empleado_pagos(periodo_id, empleado_id)
  where periodo_id is not null;

create index if not exists empleado_pagos_periodo_idx
  on public.empleado_pagos(periodo_id)
  where periodo_id is not null;
