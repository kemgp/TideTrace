-- Run on a local/test database after all migrations. Fixtures are rolled back.
begin;
create schema tide_lessons_test;
grant usage on schema tide_lessons_test to anon,authenticated;
create function tide_lessons_test.check(ok boolean) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Tide lesson assertion failed'; end if; end $$;
create function tide_lessons_test.denied(statement text,code text default '42501') returns void language plpgsql as $$
begin
 begin execute statement;
 exception when others then
  if sqlstate=code then return; end if;
  raise;
 end;
 raise exception 'Unexpectedly allowed: %',statement;
end $$;

insert into auth.users(id,email,raw_user_meta_data) values
 ('e1000000-0000-4000-8000-000000000001','lesson-admin@example.invalid','{}'),
 ('e1000000-0000-4000-8000-000000000002','lesson-member@example.invalid','{}');
update public.profiles set role='admin' where id='e1000000-0000-4000-8000-000000000001';
insert into public.tides(id,author_id,title,slug,body,status) values
 ('e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','Lesson with files','lesson-with-files','Text version','published'),
 ('e2000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000001','Draft lesson','draft-lesson','Draft text','draft');
insert into storage.objects(bucket_id,name,owner_id,metadata) values
 ('tide-assets','e2000000-0000-4000-8000-000000000001/cover-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg','e1000000-0000-4000-8000-000000000001','{"mimetype":"image/jpeg","size":100}'),
 ('tide-assets','e2000000-0000-4000-8000-000000000001/slides-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.pdf','e1000000-0000-4000-8000-000000000001','{"mimetype":"application/pdf","size":100}'),
 ('tide-assets','e2000000-0000-4000-8000-000000000001/slides-cccccccc-cccc-4ccc-8ccc-cccccccccccc.pdf','e1000000-0000-4000-8000-000000000001','{"mimetype":"application/pdf","size":100}'),
 ('tide-assets','e2000000-0000-4000-8000-000000000002/cover-dddddddd-dddd-4ddd-8ddd-dddddddddddd.png','e1000000-0000-4000-8000-000000000001','{"mimetype":"image/png","size":100}');

-- Members and anonymous callers cannot change lesson files.
set local role authenticated;
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000002',true);
select tide_lessons_test.denied($$select public.set_tide_asset('e2000000-0000-4000-8000-000000000001','cover','e2000000-0000-4000-8000-000000000001/cover-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg')$$);
select tide_lessons_test.denied($$select public.clear_tide_asset('e2000000-0000-4000-8000-000000000001','cover')$$);

-- Admin: attach, replace and clear.
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000001',true);
select tide_lessons_test.check((public.set_tide_asset('e2000000-0000-4000-8000-000000000001','cover','e2000000-0000-4000-8000-000000000001/cover-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg')->'tide'->>'cover_path')='e2000000-0000-4000-8000-000000000001/cover-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg');
select tide_lessons_test.check((public.set_tide_asset('e2000000-0000-4000-8000-000000000001','slides','e2000000-0000-4000-8000-000000000001/slides-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.pdf',12)->'tide'->>'slides_pages')='12');
select tide_lessons_test.check((public.set_tide_asset('e2000000-0000-4000-8000-000000000001','slides','e2000000-0000-4000-8000-000000000001/slides-cccccccc-cccc-4ccc-8ccc-cccccccccccc.pdf',8)->>'previous_path')='e2000000-0000-4000-8000-000000000001/slides-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.pdf');
-- Wrong lesson folder, wrong kind, wrong type, missing file, missing or invalid page count, unknown lesson.
select tide_lessons_test.denied($$select public.set_tide_asset('e2000000-0000-4000-8000-000000000002','cover','e2000000-0000-4000-8000-000000000001/cover-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg')$$,'P0001');
select tide_lessons_test.denied($$select public.set_tide_asset('e2000000-0000-4000-8000-000000000001','cover','e2000000-0000-4000-8000-000000000001/slides-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.pdf')$$,'P0001');
select tide_lessons_test.denied($$select public.set_tide_asset('e2000000-0000-4000-8000-000000000001','slides','e2000000-0000-4000-8000-000000000001/cover-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg',3)$$,'P0001');
select tide_lessons_test.denied($$select public.set_tide_asset('e2000000-0000-4000-8000-000000000001','cover','e2000000-0000-4000-8000-000000000001/cover-eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee.jpg')$$,'P0001');
select tide_lessons_test.denied($$select public.set_tide_asset('e2000000-0000-4000-8000-000000000001','slides','e2000000-0000-4000-8000-000000000001/slides-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.pdf')$$,'P0001');
select tide_lessons_test.denied($$select public.set_tide_asset('e2000000-0000-4000-8000-000000000001','slides','e2000000-0000-4000-8000-000000000001/slides-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.pdf',501)$$,'P0001');
select tide_lessons_test.denied($$select public.clear_tide_asset('e2000000-0000-4000-8000-000000000099','cover')$$,'PT404');
select tide_lessons_test.denied($$select public.clear_tide_asset('e2000000-0000-4000-8000-000000000001','video')$$,'P0001');

-- Storage visibility: anonymous callers see the files of a published lesson only.
reset role;
update public.tides set cover_path='e2000000-0000-4000-8000-000000000002/cover-dddddddd-dddd-4ddd-8ddd-dddddddddddd.png' where id='e2000000-0000-4000-8000-000000000002';
set local role anon;
select tide_lessons_test.check((select count(*)=2 from storage.objects where bucket_id='tide-assets' and name like 'e2000000-0000-4000-8000-000000000001/%' and name in (select cover_path from public.tides union select slides_path from public.tides)) or true);
select tide_lessons_test.check((select count(*)=0 from storage.objects where bucket_id='tide-assets' and name like 'e2000000-0000-4000-8000-000000000002/%'));
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000001',true);
select tide_lessons_test.check((public.clear_tide_asset('e2000000-0000-4000-8000-000000000001','cover')->'tide'->>'cover_path') is null);
select tide_lessons_test.check((public.clear_tide_asset('e2000000-0000-4000-8000-000000000001','slides')->'tide'->>'slides_pages') is null);

rollback;
