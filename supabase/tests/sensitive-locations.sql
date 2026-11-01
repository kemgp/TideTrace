begin;
create schema location_test;
grant usage on schema location_test to anon,authenticated;
create function location_test.check(ok boolean) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Location assertion failed'; end if; end $$;
create function location_test.denied(statement text,code text default '42501') returns void language plpgsql as $$
begin
 begin execute statement;
 exception when others then
  if sqlstate=code then return; end if;
  raise;
 end;
 raise exception 'Unauthorized or invalid statement succeeded: %',statement;
end $$;
insert into auth.users(id,email,raw_user_meta_data) values
 ('a0000000-0000-4000-8000-000000000001','location-owner@example.invalid','{}'),
 ('a0000000-0000-4000-8000-000000000002','location-other@example.invalid','{}'),
 ('a0000000-0000-4000-8000-000000000003','location-staff@example.invalid','{}');
update public.profiles set role='moderator' where id='a0000000-0000-4000-8000-000000000003';
select set_config('location.category',(select id::text from public.categories limit 1),true);
set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
select set_config('location.trace',id::text,true) from public.save_trace_draft(null,null,'Sensitive reef','Observation',current_setting('location.category')::uuid,'Broad coast',10,124,true);
select location_test.check((select is_sensitive and latitude is null and longitude is null from public.traces where id=current_setting('location.trace')::uuid));
select location_test.check((select latitude=10 and longitude=124 from public.get_trace_private_location(current_setting('location.trace')::uuid)));
select location_test.denied('select * from private.trace_locations');
-- A legacy caller omitting the flag preserves sensitivity.
select public.save_trace_draft(current_setting('location.trace')::uuid,1,'Sensitive reef','Updated',current_setting('location.category')::uuid,'Broad coast',11,125);
select location_test.check((select is_sensitive from public.traces where id=current_setting('location.trace')::uuid));
select location_test.denied(format('select public.hide_trace_location(%L,1)',current_setting('location.trace')),'40001');
-- Declassifying an editable draft moves coordinates atomically back to public storage.
select public.save_trace_draft(current_setting('location.trace')::uuid,2,'Sensitive reef','Updated',current_setting('location.category')::uuid,'Broad coast',11,125,false);
select location_test.check((select not is_sensitive and latitude=11 from public.traces where id=current_setting('location.trace')::uuid));
select location_test.check((select count(*)=0 from public.get_trace_private_location(current_setting('location.trace')::uuid)));
reset role;
update public.traces set status='approved',published_at=now() where id=current_setting('location.trace')::uuid;
set local role authenticated;
select public.hide_trace_location(current_setting('location.trace')::uuid,3);
select location_test.check((select latitude=11 from public.get_trace_private_location(current_setting('location.trace')::uuid)));
select location_test.denied(format('select public.save_trace_draft(%L,4,%L,%L,%L,%L,11,125,false)',current_setting('location.trace'),'Sensitive reef','Updated',current_setting('location.category'),'Broad coast'));
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000002',true);
select location_test.denied(format('select public.get_trace_private_location(%L)',current_setting('location.trace')));
select location_test.denied(format('select public.hide_trace_location(%L,4)',current_setting('location.trace')));
select location_test.check((select latitude is null and longitude is null from public.traces where id=current_setting('location.trace')::uuid));
select location_test.check((select latitude is null from public.search_public_traces('Sensitive reef') where id=current_setting('location.trace')::uuid));
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000003',true);
select location_test.check((select latitude=11 from public.get_trace_private_location(current_setting('location.trace')::uuid)));
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select location_test.denied(format('select public.get_trace_private_location(%L)',current_setting('location.trace')));
select location_test.check((select latitude is null from public.traces where id=current_setting('location.trace')::uuid));
reset role;
update public.profiles set status='suspended' where id in ('a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000003');
set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
select location_test.denied(format('select public.get_trace_private_location(%L)',current_setting('location.trace')));
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000003',true);
select location_test.denied(format('select public.get_trace_private_location(%L)',current_setting('location.trace')));
reset role;
rollback;
