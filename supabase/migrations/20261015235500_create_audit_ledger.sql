-- Append-only audit ledger. Database triggers record committed changes atomically.
create table if not exists public.vera_audit_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  source text not null check (source in ('DATABASE', 'APPLICATION')),
  action text not null,
  actor jsonb not null default '{}'::jsonb,
  actor_username text,
  target jsonb,
  details jsonb not null default '{}'::jsonb,
  entity_id text,
  constraint vera_audit_events_actor_object check (jsonb_typeof(actor) = 'object'),
  constraint vera_audit_events_details_object check (jsonb_typeof(details) = 'object')
);
create index if not exists vera_audit_events_time_idx on public.vera_audit_events (occurred_at desc);
create index if not exists vera_audit_events_entity_idx on public.vera_audit_events (entity_id, occurred_at desc);
create index if not exists vera_audit_events_action_idx on public.vera_audit_events (action, occurred_at desc);
alter table public.vera_audit_events enable row level security;
revoke all on public.vera_audit_events from public, anon, authenticated;
revoke all on public.vera_audit_events from service_role;
grant usage on schema public to service_role;
grant select, insert on public.vera_audit_events to service_role;

create or replace function public.vera_record_database_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  changed_id text;
  changed_entity_id text;
  changed_target jsonb;
  changed_details jsonb;
begin
  if tg_table_name = 'logins' then
    changed_id := new.id::text;
    changed_entity_id := new.user_id::text;
    changed_target := jsonb_build_object('id', new.user_id, 'username', new.username);
    changed_details := jsonb_build_object('method', new.method);
  elsif tg_table_name = 'vera_users' then
    if tg_op = 'DELETE' then
      changed_id := old.id::text;
      changed_target := jsonb_build_object('id', old.id, 'username', old.username);
      changed_details := jsonb_build_object('previousRole', old.role, 'previousStatus', old.status);
    else
      changed_id := new.id::text;
      changed_target := jsonb_build_object('id', new.id, 'username', new.username);
      changed_details := jsonb_build_object('role', new.role, 'status', new.status, 'version', new.version);
    end if;
    changed_entity_id := changed_id;
  else
    if tg_op = 'DELETE' then
      changed_id := old.id::text;
      changed_entity_id := coalesce(old.payload ->> 'proposalId', old.payload ->> 'entityId', changed_id);
      changed_details := jsonb_build_object('previousVersion', old.version);
    else
      changed_id := new.id::text;
      changed_entity_id := coalesce(new.payload ->> 'proposalId', new.payload ->> 'entityId', changed_id);
      changed_details := jsonb_build_object('version', new.version);
    end if;
    changed_target := jsonb_build_object('id', changed_id);
  end if;

  insert into public.vera_audit_events (source, action, actor, target, details, entity_id)
  values ('DATABASE', upper(tg_table_name || '_' || tg_op), '{}'::jsonb,
          changed_target, changed_details, changed_entity_id);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.vera_record_database_change() from public, anon, authenticated, service_role;

drop trigger if exists vera_audit_proposals_ledger on public.vera_audit_proposals;
create trigger vera_audit_proposals_ledger after insert or update or delete on public.vera_audit_proposals
  for each row execute function public.vera_record_database_change();
drop trigger if exists vera_users_ledger on public.vera_users;
create trigger vera_users_ledger after insert or update or delete on public.vera_users
  for each row execute function public.vera_record_database_change();
drop trigger if exists vera_risks_ledger on public.vera_risks;
create trigger vera_risks_ledger after insert or update or delete on public.vera_risks
  for each row execute function public.vera_record_database_change();
drop trigger if exists vera_controls_ledger on public.vera_controls;
create trigger vera_controls_ledger after insert or update or delete on public.vera_controls
  for each row execute function public.vera_record_database_change();
drop trigger if exists vera_evidence_ledger on public.vera_evidence;
create trigger vera_evidence_ledger after insert or update or delete on public.vera_evidence
  for each row execute function public.vera_record_database_change();
drop trigger if exists vera_audit_comments_ledger on public.vera_audit_comments;
create trigger vera_audit_comments_ledger after insert or update or delete on public.vera_audit_comments
  for each row execute function public.vera_record_database_change();
drop trigger if exists logins_ledger on public.logins;
create trigger logins_ledger after insert on public.logins
  for each row execute function public.vera_record_database_change();
