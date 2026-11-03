-- Run on a local/test database after all migrations. Fixtures are rolled back.
begin;
create schema tide_chapters_test;
grant usage on schema tide_chapters_test to anon,authenticated;
create function tide_chapters_test.check(ok boolean) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Tide chapters assertion failed'; end if; end $$;
create function tide_chapters_test.denied(statement text,code text default '42501') returns void language plpgsql as $$
begin
 begin execute statement;
 exception when others then
  if sqlstate=code then return; end if;
  raise;
 end;
 raise exception 'Unexpectedly allowed: %',statement;
end $$;
grant execute on all functions in schema tide_chapters_test to anon,authenticated;

insert into auth.users(id,email,raw_user_meta_data) values
 ('e3000000-0000-4000-8000-000000000001','chapters-admin@example.invalid','{}'),
 ('e3000000-0000-4000-8000-000000000002','chapters-member@example.invalid','{}');
update public.profiles set role='admin' where id='e3000000-0000-4000-8000-000000000001';
insert into public.tides(id,author_id,title,slug,body,status) values
 ('e4000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001','Published','chapters-published','Text','published'),
 ('e4000000-0000-4000-8000-000000000002','e3000000-0000-4000-8000-000000000001','Draft','chapters-draft','Text','draft');
insert into storage.objects(bucket_id,name,owner_id,metadata) values
 ('tide-assets','e4000000-0000-4000-8000-000000000001/image-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png','e3000000-0000-4000-8000-000000000001','{"mimetype":"image/png","size":10}'),
 ('tide-assets','e4000000-0000-4000-8000-000000000002/image-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png','e3000000-0000-4000-8000-000000000001','{"mimetype":"image/png","size":10}'),
 ('tide-assets','e4000000-0000-4000-8000-000000000001/image-cccccccc-cccc-4ccc-8ccc-cccccccccccc.pdf','e3000000-0000-4000-8000-000000000001','{"mimetype":"application/pdf","size":10}');

-- The paged switch defaults to off.
select tide_chapters_test.check((select not paged from public.tides where id='e4000000-0000-4000-8000-000000000001'));

-- Members cannot add or remove images.
set local role authenticated;
select set_config('request.jwt.claim.sub','e3000000-0000-4000-8000-000000000002',true);
select tide_chapters_test.denied($$select public.add_tide_image('e4000000-0000-4000-8000-000000000001','e4000000-0000-4000-8000-000000000001/image-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png','A shore')$$);
select tide_chapters_test.denied($$select public.remove_tide_image(gen_random_uuid())$$);
select tide_chapters_test.denied($$insert into public.tide_images(tide_id,object_path,alt) values('e4000000-0000-4000-8000-000000000001','x','y')$$);

-- Admin: add images, with the validation checks.
select set_config('request.jwt.claim.sub','e3000000-0000-4000-8000-000000000001',true);
select tide_chapters_test.check((public.add_tide_image('e4000000-0000-4000-8000-000000000001','e4000000-0000-4000-8000-000000000001/image-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png','  A shore at low tide  ')->>'alt')='A shore at low tide');
select public.add_tide_image('e4000000-0000-4000-8000-000000000002','e4000000-0000-4000-8000-000000000002/image-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png','Draft image');
select tide_chapters_test.denied($$select public.add_tide_image('e4000000-0000-4000-8000-000000000001','e4000000-0000-4000-8000-000000000001/image-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png','   ')$$,'P0001');
select tide_chapters_test.denied($$select public.add_tide_image('e4000000-0000-4000-8000-000000000001','e4000000-0000-4000-8000-000000000002/image-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png','Wrong lesson folder')$$,'P0001');
select tide_chapters_test.denied($$select public.add_tide_image('e4000000-0000-4000-8000-000000000001','e4000000-0000-4000-8000-000000000001/image-cccccccc-cccc-4ccc-8ccc-cccccccccccc.pdf','Not an image')$$,'P0001');
select tide_chapters_test.denied($$select public.add_tide_image('e4000000-0000-4000-8000-000000000001','e4000000-0000-4000-8000-000000000001/image-dddddddd-dddd-4ddd-8ddd-dddddddddddd.png','Missing file')$$,'P0001');
select tide_chapters_test.denied($$select public.add_tide_image('e4000000-0000-4000-8000-000000000099','e4000000-0000-4000-8000-000000000099/image-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png','No lesson')$$,'P0001');

-- Visibility: anonymous callers see the images (and files) of the published lesson only.
reset role;
set local role anon;
select tide_chapters_test.check((select count(*)=1 from public.tide_images));
select tide_chapters_test.check((select count(*)=1 from storage.objects where bucket_id='tide-assets' and name like 'e4000000-0000-4000-8000-00000000000%/image-%' and name like '%aaaaaaaa%'));
select tide_chapters_test.check((select count(*)=0 from storage.objects where bucket_id='tide-assets' and name like '%bbbbbbbb%'));
reset role;

-- Admin removes an image and gets its path back.
set local role authenticated;
select set_config('request.jwt.claim.sub','e3000000-0000-4000-8000-000000000001',true);
select tide_chapters_test.check((public.remove_tide_image((select id from public.tide_images where alt='A shore at low tide'))->>'object_path') like '%aaaaaaaa%');
select tide_chapters_test.denied($$select public.remove_tide_image(gen_random_uuid())$$,'PT404');

-- Deleting a lesson deletes its image rows.
reset role;
delete from public.tides where id='e4000000-0000-4000-8000-000000000002';
select tide_chapters_test.check((select count(*)=0 from public.tide_images));

rollback;
