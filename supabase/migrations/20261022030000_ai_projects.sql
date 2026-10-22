-- Private folders for assistant conversations. A deleted folder leaves its
-- conversations intact and returns them to the unfiled view.
create table if not exists public.vera_ai_projects (
  id uuid primary key,
  owner_id bigint not null references public.vera_users(id) on delete cascade,
  owner_role text not null check (owner_role in ('SUPER_ADMIN', 'DIRECTOR', 'GERENTE', 'JEFATURA', 'AUDITOR')),
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vera_ai_projects_owner_updated_idx
  on public.vera_ai_projects (owner_id, owner_role, updated_at desc);
alter table public.vera_ai_projects enable row level security;
revoke all on public.vera_ai_projects from public, anon, authenticated;
grant select, insert, update, delete on public.vera_ai_projects to service_role;

alter table public.vera_ai_conversations
  add column if not exists project_id uuid references public.vera_ai_projects(id) on delete set null;
create index if not exists vera_ai_conversations_project_idx
  on public.vera_ai_conversations (owner_id, owner_role, project_id, updated_at desc);

-- Even service-role writes cannot attach a conversation to another account's
-- folder if an API regression ever skips the ownership check.
create or replace function public.vera_ai_check_project_owner()
returns trigger language plpgsql as $$
begin
  if new.project_id is not null and not exists (
    select 1 from public.vera_ai_projects p
    where p.id = new.project_id and p.owner_id = new.owner_id
      and p.owner_role = new.owner_role
  ) then
    raise exception 'assistant project does not belong to conversation owner';
  end if;
  return new;
end;
$$;
revoke all on function public.vera_ai_check_project_owner() from public, anon, authenticated;
drop trigger if exists vera_ai_conversations_project_owner on public.vera_ai_conversations;
create trigger vera_ai_conversations_project_owner before insert or update of project_id, owner_id, owner_role
  on public.vera_ai_conversations for each row execute function public.vera_ai_check_project_owner();
