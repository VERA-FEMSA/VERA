-- Private files attached to one assistant conversation. Binary content remains
-- in the existing private Storage bucket; only metadata and bounded extracted
-- text live here. No browser role receives direct table permissions.
create table if not exists public.vera_ai_attachments (
  id uuid primary key,
  conversation_id uuid not null references public.vera_ai_conversations(id) on delete cascade,
  owner_id bigint not null references public.vera_users(id) on delete cascade,
  owner_role text not null check (owner_role in ('SUPER_ADMIN', 'DIRECTOR', 'GERENTE', 'JEFATURA', 'AUDITOR')),
  name text not null check (char_length(name) between 1 and 120),
  file jsonb not null check (jsonb_typeof(file) = 'object'),
  chunks jsonb not null default '[]'::jsonb check (jsonb_typeof(chunks) = 'array' and
    jsonb_array_length(chunks) <= 50 and octet_length(chunks::text) <= 60000),
  status text not null check (status in ('ready', 'no-text')),
  truncated boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists vera_ai_attachments_owner_conversation_idx
  on public.vera_ai_attachments (owner_id, owner_role, conversation_id, created_at desc);
alter table public.vera_ai_attachments enable row level security;
revoke all on public.vera_ai_attachments from public, anon, authenticated;
grant select, insert, delete on public.vera_ai_attachments to service_role;

create or replace function public.vera_ai_check_attachment_owner()
returns trigger language plpgsql as $$
begin
  if not exists (select 1 from public.vera_ai_conversations c
    where c.id = new.conversation_id and c.owner_id = new.owner_id
      and c.owner_role = new.owner_role) then
    raise exception 'assistant attachment does not belong to conversation owner';
  end if;
  return new;
end;
$$;
revoke all on function public.vera_ai_check_attachment_owner() from public, anon, authenticated;
drop trigger if exists vera_ai_attachments_owner on public.vera_ai_attachments;
create trigger vera_ai_attachments_owner before insert or update of conversation_id, owner_id, owner_role
  on public.vera_ai_attachments for each row execute function public.vera_ai_check_attachment_owner();
