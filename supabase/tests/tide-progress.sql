-- Run on a local/test database after all migrations. Fixtures are rolled back.
begin;
create schema tide_progress_test;
grant usage on schema tide_progress_test to anon,authenticated;
create function tide_progress_test.check(ok boolean) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Tide progress assertion failed'; end if; end $$;
create function tide_progress_test.denied(statement text,code text default '42501') returns void language plpgsql as $$
begin
 begin execute statement;
 exception when others then
  if sqlstate=code then return; end if;
  raise;
 end;
 raise exception 'Unexpectedly allowed: %',statement;
end $$;
grant execute on all functions in schema tide_progress_test to anon,authenticated;

insert into auth.users(id,email,raw_user_meta_data) values
 ('e5000000-0000-4000-8000-000000000001','progress-a@example.invalid','{}'),
 ('e5000000-0000-4000-8000-000000000002','progress-b@example.invalid','{}');
insert into public.tides(id,author_id,title,slug,body,status) values
 ('e6000000-0000-4000-8000-000000000001','e5000000-0000-4000-8000-000000000001','Published','progress-published','Text','published'),
 ('e6000000-0000-4000-8000-000000000002','e5000000-0000-4000-8000-000000000001','Draft','progress-draft','Text','draft');

set local role authenticated;
select set_config('request.jwt.claim.sub','e5000000-0000-4000-8000-000000000001',true);
-- Saving works, and saving again updates the same row.
select public.save_tide_progress('e6000000-0000-4000-8000-000000000001',2,5);
select public.save_tide_progress('e6000000-0000-4000-8000-000000000001',4,5);
select tide_progress_test.check((select count(*)=1 and max(part)=4 from public.tide_progress));
-- Bad numbers and unpublished lessons are refused.
select tide_progress_test.denied($$select public.save_tide_progress('e6000000-0000-4000-8000-000000000001',6,5)$$,'P0001');
select tide_progress_test.denied($$select public.save_tide_progress('e6000000-0000-4000-8000-000000000001',0,5)$$,'P0001');
select tide_progress_test.denied($$select public.save_tide_progress('e6000000-0000-4000-8000-000000000001',1,1)$$,'P0001');
select tide_progress_test.denied($$select public.save_tide_progress('e6000000-0000-4000-8000-000000000002',1,3)$$,'PT404');
-- No direct writes.
select tide_progress_test.denied($$insert into public.tide_progress(user_id,tide_id,part,total) values(auth.uid(),'e6000000-0000-4000-8000-000000000001',1,3)$$);
select tide_progress_test.denied($$update public.tide_progress set part=1$$);
select tide_progress_test.denied($$delete from public.tide_progress$$);

-- Another member sees nothing of it.
select set_config('request.jwt.claim.sub','e5000000-0000-4000-8000-000000000002',true);
select tide_progress_test.check((select count(*)=0 from public.tide_progress));

-- Signed-out callers cannot save.
reset role;
set local role anon;
select tide_progress_test.denied($$select public.save_tide_progress('e6000000-0000-4000-8000-000000000001',2,5)$$);
rollback;
