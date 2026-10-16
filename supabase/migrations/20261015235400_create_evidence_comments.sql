-- HU-16/HU-18: evidence references and audit comments.
create table if not exists public.vera_evidence (
  id text primary key,
  entity_type text not null check (entity_type in ('RISK', 'CONTROL', 'AUDIT')),
  entity_id text not null,
  payload jsonb not null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vera_evidence_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint vera_evidence_id_matches check (payload ->> 'id' = id),
  constraint vera_evidence_entity_matches check (
    payload ->> 'entityType' = entity_type and payload ->> 'entityId' = entity_id
  )
);
create index if not exists vera_evidence_entity_idx
  on public.vera_evidence (entity_type, entity_id);
alter table public.vera_evidence enable row level security;
revoke all on public.vera_evidence from public, anon, authenticated;
grant usage on schema public to service_role;
grant select, insert, update, delete on public.vera_evidence to service_role;

create table if not exists public.vera_audit_comments (
  id text primary key,
  proposal_id text not null,
  payload jsonb not null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vera_audit_comments_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint vera_audit_comments_id_matches check (payload ->> 'id' = id),
  constraint vera_audit_comments_proposal_matches check (payload ->> 'proposalId' = proposal_id)
);
create index if not exists vera_audit_comments_proposal_idx
  on public.vera_audit_comments (proposal_id);
alter table public.vera_audit_comments enable row level security;
revoke all on public.vera_audit_comments from public, anon, authenticated;
grant select, insert, update, delete on public.vera_audit_comments to service_role;
