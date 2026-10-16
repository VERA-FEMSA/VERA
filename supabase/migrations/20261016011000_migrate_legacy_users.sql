-- Preserve the accounts and numeric IDs of a preexisting VERA public.users table.
-- Fresh projects without that table keep vera_users empty for bootstrap-admin.
do $$
declare
  legacy_count bigint;
begin
  if to_regclass('public.users') is null then
    return;
  end if;

  select count(*) into legacy_count from public.users;
  if legacy_count = 0 then
    return;
  end if;

  if exists (select 1 from public.vera_users) then
    raise exception 'vera_users is not empty; reconcile accounts before migrating legacy users';
  end if;

  if exists (
    select 1 from public.users
    where status = 'ACTIVE'
      and not (
        left(password, 4) in ('$2a$', '$2b$', '$2y$')
        and length(password) = 60
      )
  ) then
    raise exception 'an active legacy account lacks a bcrypt hash; resolve it before migration';
  end if;

  insert into public.vera_users (
    id, username, email, name, password_hash, role, status, requested_at,
    two_factor_enabled, two_factor_secret, pending_secret, created_at, updated_at
  )
  select
    id, username, email, name,
    case
      when left(password, 4) in ('$2a$', '$2b$', '$2y$') and length(password) = 60
        then password
      else extensions.crypt(password, extensions.gen_salt('bf', 12))
    end,
    role, status, requested_at, two_factor_enabled, two_factor_secret,
    pending_secret, created_at, now()
  from public.users;

  if (select count(*) from public.vera_users) <> legacy_count then
    raise exception 'legacy account count differs after migration';
  end if;
end;
$$;
