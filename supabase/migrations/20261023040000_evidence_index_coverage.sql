-- Estado de lectura de cada archivo de evidencia. Las filas anteriores a esta
-- migración quedan sin estado: no se infiere que su extracción fue completa.
create table if not exists public.vera_evidence_index_coverage (
  evidence_id text primary key references public.vera_evidence(id) on delete cascade,
  status text not null check (status in ('ready', 'no-text', 'pending', 'unsupported')),
  indexed_chunks integer not null default 0 check (indexed_chunks between 0 and 60),
  truncated boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.vera_evidence_index_coverage enable row level security;
revoke all on public.vera_evidence_index_coverage from public, anon, authenticated;
grant select, insert, update, delete on public.vera_evidence_index_coverage to service_role;
