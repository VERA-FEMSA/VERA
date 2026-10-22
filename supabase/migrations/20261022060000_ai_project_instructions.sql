-- Optional presentation preferences for one private AI project.
-- Existing projects keep an empty value; RLS and service-only access remain unchanged.
alter table public.vera_ai_projects
  add column if not exists instructions text not null default ''
  check (char_length(instructions) <= 800);
