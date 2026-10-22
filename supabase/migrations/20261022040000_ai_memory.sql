-- Explicit, user-controlled assistant preferences. Never populated from chat
-- transcripts or records without the owner's direct action.
create table if not exists public.vera_ai_memory (
  id uuid primary key,
  owner_id bigint not null references public.vera_users(id) on delete cascade,
  owner_role text not null check (owner_role in ('SUPER_ADMIN', 'DIRECTOR', 'GERENTE', 'JEFATURA', 'AUDITOR')),
  content text not null check (char_length(content) between 1 and 200),
  enabled boolean not null default true,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vera_ai_memory_owner_created_idx
  on public.vera_ai_memory (owner_id, owner_role, created_at desc);
alter table public.vera_ai_memory enable row level security;
revoke all on public.vera_ai_memory from public, anon, authenticated;
grant select, insert, update, delete on public.vera_ai_memory to service_role;
