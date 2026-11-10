-- STAGING ONLY. Do not run on production.
-- Run in the staging project's SQL Editor AFTER staging-setup.sql and bootstrap-first-admin.sql.
--
-- Step 1: in the staging Supabase dashboard, go to Authentication > Users > Add user > Create new user
-- for each email below, tick "Auto Confirm User", and set a password (keep passwords out of the repo).
-- Step 2: run this script. It looks users up by email, so no UUIDs are needed.
-- It sets display names and roles for these five accounts only, and is safe to run again.
-- To receive real emails (signup, recovery), change the addresses to a mailbox you control
-- (for example name+member1@yourmail.com) in BOTH Auth and the list below.
begin;
do $$
declare
 spec record;
 uid uuid;
 previous public.profiles;
begin
 perform pg_advisory_xact_lock(742819001);
 for spec in
  select * from (values
   ('member1@example.com'::text,    'Staging Member 1'::text,    'user'::public.app_role),
   ('member2@example.com'::text,    'Staging Member 2'::text,    'user'::public.app_role),
   ('member3@example.com'::text,    'Staging Member 3'::text,    'user'::public.app_role),
   ('moderator1@example.com'::text, 'Staging Moderator 1'::text, 'moderator'::public.app_role),
   ('moderator2@example.com'::text, 'Staging Moderator 2'::text, 'moderator'::public.app_role)
  ) as t(account_email, account_name, account_role)
 loop
  select id into uid from auth.users where lower(email) = lower(spec.account_email);
  if uid is null then
   raise exception 'Create the Auth user % first (Authentication > Users > Add user)', spec.account_email;
  end if;
  select * into previous from public.profiles where id = uid for update;
  if not found then raise exception 'No profile for %. Run staging-setup.sql first', spec.account_email; end if;
  if previous.role = 'admin' then raise exception '% is an admin; refusing to change it', spec.account_email; end if;
  update public.profiles set display_name = spec.account_name, role = spec.account_role where id = uid;
  if previous.role is distinct from spec.account_role then
   insert into public.admin_audit_logs(actor_id, target_user_id, action, old_values, new_values, reason)
   values (null, uid, 'staging_seed_account',
    jsonb_build_object('role', previous.role, 'status', previous.status),
    jsonb_build_object('role', spec.account_role, 'status', previous.status),
    'Staging test account seeded through SQL Editor');
  end if;
 end loop;
end $$;
commit;
