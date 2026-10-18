-- Additive identity bridge. Existing VERA accounts retain their password and MFA behavior.
alter table public.vera_users
  add column if not exists auth_user_id uuid,
  add column if not exists auth_provider text;

alter table public.vera_users
  add constraint vera_users_managed_auth_pair
    check ((auth_user_id is null and auth_provider is null) or
           (auth_user_id is not null and auth_provider in ('email', 'google', 'azure')));

create unique index if not exists vera_users_auth_user_id_unique
  on public.vera_users (auth_user_id) where auth_user_id is not null;
