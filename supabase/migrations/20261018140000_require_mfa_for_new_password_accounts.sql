-- Existing accounts keep their current sign-in flow. New password accounts
-- cannot receive a VERA session until they enroll a TOTP factor.
alter table public.vera_users
  add column if not exists mfa_required boolean not null default false;
