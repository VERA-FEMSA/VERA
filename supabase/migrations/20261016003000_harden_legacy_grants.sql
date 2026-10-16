-- Existing projects may have broader grants than the original CREATE TABLE scripts.
-- Keep the login ledger append-only for the API's service role.
revoke all on public.logins from service_role;
grant insert on public.logins to service_role;

-- Existing VERA projects may have these tables; fresh projects need not.
-- Remove stale client grants without changing rows or service access.
do $$
declare
  legacy_table text;
begin
  foreach legacy_table in array array[
    'users', 'access_audit_logs', 'auth_attempts', 'api_request_logs'
  ] loop
    if to_regclass(format('public.%I', legacy_table)) is not null then
      execute format(
        'revoke all on table public.%I from public, anon, authenticated',
        legacy_table
      );
    end if;
  end loop;
end;
$$;
