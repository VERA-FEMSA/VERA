-- Private assistant conversations. The API always scopes reads and writes to
-- the authenticated account; a role change makes earlier conversations
-- inaccessible until the user explicitly starts a new one.
create table if not exists public.vera_ai_conversations (
  id uuid primary key,
  owner_id bigint not null references public.vera_users(id) on delete cascade,
  owner_role text not null check (owner_role in ('SUPER_ADMIN', 'DIRECTOR', 'GERENTE', 'JEFATURA', 'AUDITOR')),
  title text not null check (char_length(title) between 1 and 80),
  focus_type text check (focus_type in ('audit', 'risk', 'control', 'finding')),
  focus_id text check (char_length(focus_id) between 1 and 80),
  scope_hash text not null check (scope_hash ~ '^[0-9a-f]{64}$'),
  messages jsonb not null default '[]'::jsonb check (jsonb_typeof(messages) = 'array' and
    jsonb_array_length(messages) <= 40 and octet_length(messages::text) <= 160000),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vera_ai_conversations_focus_pair check ((focus_type is null) = (focus_id is null))
);
create index if not exists vera_ai_conversations_owner_updated_idx
  on public.vera_ai_conversations (owner_id, owner_role, updated_at desc);
alter table public.vera_ai_conversations enable row level security;
revoke all on public.vera_ai_conversations from public, anon, authenticated;
grant select, insert, update, delete on public.vera_ai_conversations to service_role;
