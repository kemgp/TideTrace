begin;
create or replace function public.get_workflow_settings() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare saved public.settings;
begin
 if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 select * into saved from public.settings where key='workflow';
 return jsonb_build_object('id','workflow','value',coalesce(saved.value,'{"submissions_paused":false,"max_media_per_trace":10}'::jsonb),'updated_at',saved.updated_at);
end $$;
create or replace function private.validate_workflow_settings() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.key<>'workflow' then return new; end if;
 if jsonb_typeof(new.value)<>'object' or not(new.value ?& array['submissions_paused','max_media_per_trace']) or
 (new.value - 'submissions_paused' - 'max_media_per_trace')<>'{}'::jsonb or
 jsonb_typeof(new.value->'submissions_paused')<>'boolean' or jsonb_typeof(new.value->'max_media_per_trace')<>'number' then
 raise exception 'Invalid workflow settings'; end if;
 if (new.value->>'max_media_per_trace')::numeric not between 1 and 10 or
 (new.value->>'max_media_per_trace')::numeric<>trunc((new.value->>'max_media_per_trace')::numeric) then raise exception 'Media limit must be an integer from 1 to 10'; end if;
 insert into public.admin_audit_logs(actor_id,target_user_id,action,old_values,new_values,reason)
 values(auth.uid(),auth.uid(),'update_workflow_settings',case when tg_op='INSERT' then '{}'::jsonb else old.value end,new.value,'Platform workflow settings updated');
 return new;
end $$;
create trigger validate_workflow_settings before insert or update on public.settings for each row execute function private.validate_workflow_settings();
create or replace function public.save_workflow_settings(p_value jsonb,p_expected_updated_at timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare saved public.settings;
begin
 if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(742819002);
 select * into saved from public.settings where key='workflow' for update;
 if saved.updated_at is distinct from p_expected_updated_at then raise exception 'Settings changed. Reload before saving' using errcode='40001'; end if;
 insert into public.settings(key,value) values('workflow',p_value) on conflict(key) do update set value=excluded.value;
 return public.get_workflow_settings();
end $$;
create or replace function private.enforce_submission_setting() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status='pending' and (tg_op='INSERT' or old.status is distinct from new.status) and
 coalesce((select (value->>'submissions_paused')::boolean from public.settings where key='workflow'),false) then
 raise exception 'Trace submissions are temporarily paused. Save your draft and try again later'; end if;
 return new;
end $$;
create trigger enforce_submission_setting before insert or update on public.traces for each row execute function private.enforce_submission_setting();
create or replace function private.enforce_media_limit() returns trigger
language plpgsql security definer set search_path='' as $$
declare maximum integer;
begin
 perform 1 from public.traces where id=new.trace_id for update;
 select coalesce((select (value->>'max_media_per_trace')::integer from public.settings where key='workflow'),10) into maximum;
 if (select count(*) from public.trace_media where trace_id=new.trace_id)>=maximum then raise exception 'This Trace has reached the media limit'; end if;
 return new;
end $$;
create trigger enforce_media_limit before insert on public.trace_media for each row execute function private.enforce_media_limit();
revoke all on function private.validate_workflow_settings(),private.enforce_submission_setting(),private.enforce_media_limit() from public,anon,authenticated;
revoke all on function public.get_workflow_settings(),public.save_workflow_settings(jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.get_workflow_settings(),public.save_workflow_settings(jsonb,timestamptz) to authenticated;
commit;
