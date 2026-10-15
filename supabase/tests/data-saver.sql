begin;
create schema saver_test;
grant usage on schema saver_test to anon,authenticated;
create function saver_test.check(ok boolean) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Data saver assertion failed'; end if; end $$;
create function saver_test.reject(statement text) returns void language plpgsql as $$
begin
 begin execute statement; exception when others then return; end;
 raise exception 'Unexpected success: %',statement;
end $$;
insert into auth.users(id,email,raw_user_meta_data) values
 ('77000000-0000-0000-0000-000000000001','saver@example.invalid','{}'),
 ('77000000-0000-0000-0000-000000000002','other-saver@example.invalid','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','77000000-0000-0000-0000-000000000001',true);
select saver_test.check((select data_saver=false from public.get_my_profile()));
select public.set_data_saver(true);
select saver_test.check((select data_saver=true from public.get_my_profile()));
select saver_test.reject('select public.set_data_saver(null)');
select set_config('request.jwt.claim.sub','77000000-0000-0000-0000-000000000002',true);
select saver_test.check((select data_saver=false from public.get_my_profile()));
reset role;
update public.profiles set status='suspended' where id='77000000-0000-0000-0000-000000000002';
set local role authenticated;
select saver_test.reject('select public.set_data_saver(true)');
set local role anon;
select saver_test.reject('select public.set_data_saver(true)');
rollback;
