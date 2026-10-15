begin;
create schema search_test;
grant usage on schema search_test to anon,authenticated;
create function search_test.check(ok boolean) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Search assertion failed'; end if; end $$;
insert into auth.users(id,email,raw_user_meta_data) values
 ('73000000-0000-0000-0000-000000000001','search@example.invalid','{"display_name":"Searchable Person"}');
insert into public.traces(author_id,category_id,title,description,location_name,status,is_hidden,deleted_at)
select '73000000-0000-0000-0000-000000000001', (select id from public.categories limit 1),
 'Unique reef '||n, 'Underwater 100% survey', 'Distant coast',
 case when n=32 then 'draft'::public.trace_state else 'approved'::public.trace_state end,
 n=33, case when n=34 then now() else null end
from generate_series(1,34) n;
set local role anon;
select search_test.check((select count(*)=31 from public.search_public_traces('REEF')));
select search_test.check((select count(*)=31 from public.search_public_traces('Searchable Person')));
select search_test.check((select count(*)=31 from public.search_public_traces(' distant COAST ')));
select search_test.check((select count(*)=31 from public.search_public_traces('100%')));
select search_test.check((select count(*)=0 from public.search_public_traces('_')));
select search_test.check((select count(*)=0 from public.search_public_traces(' ')));
select search_test.check((select count(*)=6 from (select * from public.search_public_traces('reef') order by id offset 25 limit 25) page));
reset role;
-- Even a privileged caller must see only public archive results.
select search_test.check((select count(*)=31 from public.search_public_traces('reef')));
rollback;
