-- Acciones humanas de seguimiento. La API valida los vínculos polimórficos y los permisos.
create table if not exists public.vera_actions (
  id text primary key,
  source_type text not null check (source_type in ('AUDIT', 'RISK', 'CONTROL', 'FINDING')),
  source_id text not null,
  assignee_id bigint not null references public.vera_users(id),
  created_by_id bigint not null references public.vera_users(id),
  payload jsonb not null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vera_actions_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint vera_actions_id_matches check (payload ->> 'id' = id),
  constraint vera_actions_source_type_matches check (payload ->> 'sourceType' = source_type),
  constraint vera_actions_source_id_matches check (payload ->> 'sourceId' = source_id),
  constraint vera_actions_assignee_matches check ((payload ->> 'assigneeId')::bigint = assignee_id),
  constraint vera_actions_creator_matches check ((payload -> 'createdBy' ->> 'id')::bigint = created_by_id)
);
create index if not exists vera_actions_source_idx on public.vera_actions(source_type, source_id);
create index if not exists vera_actions_assignee_idx on public.vera_actions(assignee_id);
alter table public.vera_actions enable row level security;
revoke all on public.vera_actions from public, anon, authenticated;
grant usage on schema public to service_role;
grant select, insert, update, delete on public.vera_actions to service_role;
drop trigger if exists vera_actions_ledger on public.vera_actions;
create trigger vera_actions_ledger after insert or update or delete on public.vera_actions
  for each row execute function public.vera_record_database_change();
