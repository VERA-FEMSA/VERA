-- Supabase does not reliably identify which provider issued a reused session
-- after Google and Microsoft identities are linked. Preserve historical rows
-- and record the honest, provider-agnostic method for these sessions.
alter table public.logins drop constraint if exists logins_method_check;
alter table public.logins add constraint logins_method_check
  check (method in (
    'PASSWORD',
    'PASSWORD_2FA',
    'MANAGED_PASSWORD_TOTP',
    'OAUTH_AZURE',
    'OAUTH_GOOGLE',
    'OAUTH_LINKED'
  ));
