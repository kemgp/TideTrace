-- Run AFTER the migration, in Supabase SQL Editor as postgres.
-- First create your own account through Supabase Auth / the app's real signup.
-- Replace the placeholder with that account's UUID from Authentication > Users.
-- Do not put this script in a frontend or expose it as a callable RPC.
begin;
do $$
declare
 target_id uuid := 'REPLACE_WITH_YOUR_AUTH_USER_UUID';
 previous public.profiles;
begin
 perform pg_advisory_xact_lock(742819001);
 if exists(select 1 from public.profiles where role='admin' and status='active') then
 raise exception 'An active admin already exists; use admin_set_account for later changes';
 end if;
 select * into previous from public.profiles where id=target_id for update;
 if not found then raise exception 'Create the Auth account first'; end if;
 update public.profiles set role='admin',status='active' where id=target_id;
 insert into public.admin_audit_logs(actor_id,target_user_id,action,old_values,new_values,reason)
 values(null,target_id,'bootstrap_first_admin',jsonb_build_object('role',previous.role,'status',previous.status),
 jsonb_build_object('role','admin','status','active'),'Initial administrator assigned by project owner through SQL Editor');
end $$;
commit;
