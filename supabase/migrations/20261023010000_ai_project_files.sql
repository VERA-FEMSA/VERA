-- A private assistant file belongs to exactly one conversation or project.
-- Existing conversation rows remain unchanged. The same owner/role and quota
-- checks apply to both containers; clients have no direct table access.
alter table public.vera_ai_attachments
  alter column conversation_id drop not null;
alter table public.vera_ai_attachments
  add column project_id uuid references public.vera_ai_projects(id) on delete cascade;
alter table public.vera_ai_attachments
  add constraint vera_ai_attachment_one_container
  check (num_nonnulls(conversation_id, project_id) = 1);
create index vera_ai_attachments_owner_project_idx
  on public.vera_ai_attachments (owner_id, owner_role, project_id, created_at desc)
  where project_id is not null;

create or replace function public.vera_ai_check_attachment_owner()
returns trigger language plpgsql as $$
begin
  if new.conversation_id is not null and not exists (
    select 1 from public.vera_ai_conversations c
    where c.id = new.conversation_id and c.owner_id = new.owner_id
      and c.owner_role = new.owner_role
  ) then
    raise exception 'assistant attachment does not belong to conversation owner';
  end if;
  if new.project_id is not null and not exists (
    select 1 from public.vera_ai_projects p
    where p.id = new.project_id and p.owner_id = new.owner_id
      and p.owner_role = new.owner_role
  ) then
    raise exception 'assistant attachment does not belong to project owner';
  end if;
  return new;
end;
$$;
revoke all on function public.vera_ai_check_attachment_owner() from public, anon, authenticated;
drop trigger if exists vera_ai_attachments_owner on public.vera_ai_attachments;
create trigger vera_ai_attachments_owner
  before insert or update of conversation_id, project_id, owner_id, owner_role
  on public.vera_ai_attachments for each row execute function public.vera_ai_check_attachment_owner();

create or replace function public.vera_ai_check_attachment_quota()
returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.owner_id::text || ':' || new.owner_role));
  if (select count(*) from public.vera_ai_attachments a
      where a.owner_id = new.owner_id and a.owner_role = new.owner_role) >= 20
     or (new.conversation_id is not null and
       (select count(*) from public.vera_ai_attachments a
        where a.conversation_id = new.conversation_id) >= 2)
     or (new.project_id is not null and
       (select count(*) from public.vera_ai_attachments a
        where a.project_id = new.project_id) >= 4) then
    raise exception 'assistant attachment quota exceeded' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.vera_ai_check_attachment_quota() from public, anon, authenticated;
