-- Optional, private vector index for the bounded project-file library.
-- It never grants browser access; the API checks project/file ownership first.
create schema if not exists extensions;
create extension if not exists vector with schema extensions;

create table if not exists public.vera_ai_project_vectors (
  attachment_id uuid not null references public.vera_ai_attachments(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0 and chunk_index < 50),
  model text not null check (char_length(model) between 1 and 80),
  embedding extensions.vector(512) not null,
  created_at timestamptz not null default now(),
  primary key (attachment_id, chunk_index, model)
);
create index if not exists vera_ai_project_vectors_cosine_idx
  on public.vera_ai_project_vectors using hnsw (embedding extensions.vector_cosine_ops);
alter table public.vera_ai_project_vectors enable row level security;
revoke all on public.vera_ai_project_vectors from public, anon, authenticated;
grant select, insert, update, delete on public.vera_ai_project_vectors to service_role;

create or replace function public.vera_ai_project_vector_status(
  p_owner_id bigint, p_owner_role text, p_project_id uuid, p_model text
)
returns table (attachment_id uuid, indexed_chunks bigint)
language sql stable security invoker set search_path = public, extensions
as $$
  select a.id, count(v.chunk_index)
  from public.vera_ai_attachments a
  left join public.vera_ai_project_vectors v
    on v.attachment_id = a.id and v.model = p_model
  where a.owner_id = p_owner_id and a.owner_role = p_owner_role
    and a.project_id = p_project_id
  group by a.id;
$$;
revoke all on function public.vera_ai_project_vector_status(bigint, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.vera_ai_project_vector_status(bigint, text, uuid, text) to service_role;

create or replace function public.vera_ai_search_project_vectors(
  p_owner_id bigint, p_owner_role text, p_project_id uuid,
  p_model text, p_embedding extensions.vector(512), p_limit integer default 5
)
returns table (attachment_id uuid, chunk_index integer, score real)
language sql stable security invoker set search_path = public, extensions
as $$
  select v.attachment_id, v.chunk_index,
    (1 - (v.embedding <=> p_embedding))::real as score
  from public.vera_ai_project_vectors v
  join public.vera_ai_attachments a on a.id = v.attachment_id
  where a.owner_id = p_owner_id and a.owner_role = p_owner_role
    and a.project_id = p_project_id and v.model = p_model
  order by v.embedding <=> p_embedding, v.attachment_id, v.chunk_index
  limit least(greatest(p_limit, 1), 5);
$$;
revoke all on function public.vera_ai_search_project_vectors(bigint, text, uuid, text, extensions.vector, integer)
  from public, anon, authenticated;
grant execute on function public.vera_ai_search_project_vectors(bigint, text, uuid, text, extensions.vector, integer)
  to service_role;
