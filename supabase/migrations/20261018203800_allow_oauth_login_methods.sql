-- The original login audit constraint predates managed OAuth identities.
-- Preserve both historical methods while allowing the exact methods emitted
-- by authController.issueSession. A failed audit write must still block login.
alter table public.logins drop constraint if exists logins_method_check;
alter table public.logins add constraint logins_method_check
  check (method in (
    'PASSWORD',
    'PASSWORD_2FA',
    'MANAGED_PASSWORD_TOTP',
    'OAUTH_AZURE',
    'OAUTH_GOOGLE'
  ));
