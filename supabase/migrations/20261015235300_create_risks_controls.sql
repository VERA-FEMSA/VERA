-- HU-14/HU-15: risks, assessments, controls and evaluations.
create table if not exists public.vera_risks (
  id text primary key,
  payload jsonb not null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vera_risks_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint vera_risks_id_matches check (payload ->> 'id' = id)
);
create unique index if not exists vera_risks_business_key
  on public.vera_risks (lower(btrim(payload ->> 'title')), lower(btrim(payload ->> 'area')));
alter table public.vera_risks enable row level security;
revoke all on public.vera_risks from public, anon, authenticated;
grant usage on schema public to service_role;
grant select, insert, update, delete on public.vera_risks to service_role;

create table if not exists public.vera_controls (
  id text primary key,
  payload jsonb not null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vera_controls_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint vera_controls_id_matches check (payload ->> 'id' = id)
);
alter table public.vera_controls enable row level security;
revoke all on public.vera_controls from public, anon, authenticated;
grant select, insert, update, delete on public.vera_controls to service_role;
