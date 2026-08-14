-- Seguimiento operativo por trabajo. Es opcional y no altera trabajos previos.

alter table public.agenda
  add column if not exists recordatorio_fecha date;

create index if not exists agenda_recordatorio_idx
  on public.agenda(negocio_id, recordatorio_fecha)
  where recordatorio_fecha is not null;
