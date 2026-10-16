-- Fragmentos de texto derivados de archivos privados de evidencia.
-- Solo la API con clave de servidor puede leer o escribir; el acceso del usuario
-- se comprueba contra la entidad vinculada antes de consultar esta tabla.
create table if not exists public.vera_evidence_text_chunks (
  evidence_id text not null references public.vera_evidence(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0 and chunk_index < 60),
  page_number integer check (page_number is null or page_number > 0),
  content text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now(),
  primary key (evidence_id, chunk_index)
);
alter table public.vera_evidence_text_chunks enable row level security;
revoke all on public.vera_evidence_text_chunks from public, anon, authenticated;
grant select, insert, update, delete on public.vera_evidence_text_chunks to service_role;
