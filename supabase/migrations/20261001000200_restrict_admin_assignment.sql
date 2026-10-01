-- Block admin promotion through both account-management RPCs.
-- Existing admins may retain their role during status changes.
create or replace function public.admin_set_account(p_user_id uuid,p_role public.app_role,p_status public.account_status,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare previous public.profiles;
begin
 perform pg_advisory_xact_lock(742819001);
 if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_role is null or p_status is null or coalesce(length(btrim(p_reason)),0)=0 then raise exception 'Role, status and reason required'; end if;
 select * into previous from public.profiles where id=p_user_id for update;
 if not found then raise exception 'Account not found'; end if;
 if p_role='admin' and previous.role<>'admin' then raise exception 'Admin roles cannot be assigned through account management' using errcode='42501'; end if;
 if previous.role='admin' and previous.status='active' and (p_role<>'admin' or p_status<>'active') and
 (select count(*) from public.profiles where role='admin' and status='active')<=1 then raise exception 'Cannot remove the last active admin'; end if;
 update public.profiles set role=p_role,status=p_status where id=p_user_id;
 insert into public.admin_audit_logs(actor_id,target_user_id,action,old_values,new_values,reason)
 values(auth.uid(),p_user_id,'set_account',jsonb_build_object('role',previous.role,'status',previous.status),jsonb_build_object('role',p_role,'status',p_status),p_reason);
end $$;
