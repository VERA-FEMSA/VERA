-- Only new managed accounts record acknowledgement. Existing users remain untouched.
alter table public.vera_users
  add column if not exists privacy_notice_version text,
  add column if not exists privacy_notice_acknowledged_at timestamptz;

alter table public.vera_users
  add constraint vera_users_privacy_notice_pair
    check ((privacy_notice_version is null and privacy_notice_acknowledged_at is null) or
           (privacy_notice_version is not null and privacy_notice_acknowledged_at is not null));
