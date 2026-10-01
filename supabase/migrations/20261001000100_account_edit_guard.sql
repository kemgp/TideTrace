-- Preserve the existing serialized account workflow and audit logging.
begin;
create or replace function public.admin_update_account(
 p_user_id uuid, p_role public.app_role, p_status public.account_status,
 p_reason text, p_expected_updated_at timestamptz
) returns void language plpgsql security definer set search_path = '' as $$
declare previous public.profiles;
begin
 perform pg_advisory_xact_lock(742819001);
 if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 select * into previous from public.profiles where id=p_user_id for update;
 if not found then raise exception 'Account not found'; end if;
 if p_expected_updated_at is null or previous.updated_at <> p_expected_updated_at then
  raise exception 'Account changed. Reload it before retrying.' using errcode='40001';
 end if;
 if coalesce(length(btrim(p_reason)),0) not between 1 and 2000 then raise exception 'A reason between 1 and 2000 characters is required'; end if;
 if previous.role=p_role and previous.status=p_status then raise exception 'No account changes selected'; end if;
 perform public.admin_set_account(p_user_id,p_role,p_status,p_reason);
end $$;
revoke all on function public.admin_update_account(uuid,public.app_role,public.account_status,text,timestamptz) from public,anon,authenticated;
grant execute on function public.admin_update_account(uuid,public.app_role,public.account_status,text,timestamptz) to authenticated;
commit;
