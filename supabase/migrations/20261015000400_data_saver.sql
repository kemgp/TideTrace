begin;
alter table public.profiles add column if not exists data_saver boolean not null default false;
create or replace function public.set_data_saver(p_enabled boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if private.current_role() is null then raise exception 'Active account required' using errcode='42501'; end if;
 if p_enabled is null then raise exception 'Choose on or off' using errcode='22023'; end if;
 update public.profiles set data_saver=p_enabled where id=auth.uid();
 return jsonb_build_object('id',auth.uid(),'data_saver',p_enabled);
end $$;
revoke all on function public.set_data_saver(boolean) from public,anon;
grant execute on function public.set_data_saver(boolean) to authenticated;
commit;
