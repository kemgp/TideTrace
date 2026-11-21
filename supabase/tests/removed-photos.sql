-- Removed Trace photos: drafts delete at once, revision photos are kept for staff until 30 days after the
-- final decision, only the author can delete due files, and removed paths cannot be attached again.
-- Run on a local/test database after all migrations. Fixtures are rolled back.
begin;
create schema removed_test;
grant usage on schema removed_test to anon,authenticated;
create function removed_test.check(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Removed photos check failed: %',label; end if; end $$;
create function removed_test.denied(statement text,code text) returns void language plpgsql as $$
begin
 begin execute statement;
 exception when others then
  if sqlstate=code then return; end if;
  raise;
 end;
 raise exception 'Unexpectedly allowed: %',statement;
end $$;
-- Test helper only: move a kept photo's clock, as if days had passed.
create function removed_test.age(p_path text,p_due timestamptz) returns void language sql security definer as $$
 update private.retired_trace_media set delete_after=p_due where object_path=p_path
$$;
grant execute on function removed_test.age(text,timestamptz) to authenticated;

insert into auth.users(id,email,raw_user_meta_data) values
 ('e1000000-0000-4000-8000-000000000001','removed-author@example.invalid','{}'),
 ('e1000000-0000-4000-8000-000000000002','removed-other@example.invalid','{}'),
 ('e1000000-0000-4000-8000-000000000003','removed-staff@example.invalid','{}');
update public.profiles set role='moderator' where id='e1000000-0000-4000-8000-000000000003';
-- e2..01: a draft never submitted; e2..02: a submitted Trace sent back for revision.
insert into public.traces(id,author_id,category_id,title,description,location_name,status,submitted_at)
values
 ('e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001',(select id from public.categories limit 1),'Removed fixture draft','Observation','Coast','draft',null),
 ('e2000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000001',(select id from public.categories limit 1),'Removed fixture revision','Observation','Coast','revision_requested',now()-interval '2 days');
insert into storage.objects(bucket_id,name,owner_id,metadata)
 select 'trace-media','e1000000-0000-4000-8000-000000000001/e2000000-0000-4000-8000-00000000000'||n||'/'||f,'e1000000-0000-4000-8000-000000000001',m::jsonb
 from (values (1,'a.webp','{"mimetype":"image/webp","size":200000}'),(1,'a.thumb.webp','{"mimetype":"image/webp","size":20000}'),
              (2,'b.webp','{"mimetype":"image/webp","size":200000}'),(2,'b.thumb.webp','{"mimetype":"image/webp","size":20000}'),
              (2,'c.webp','{"mimetype":"image/webp","size":200000}')) as files(n,f,m);
insert into public.trace_media(id,trace_id,object_path,thumb_path,mime_type,size_bytes) values
 ('e3000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001/e2000000-0000-4000-8000-000000000001/a.webp','e1000000-0000-4000-8000-000000000001/e2000000-0000-4000-8000-000000000001/a.thumb.webp','image/webp',200000),
 ('e3000000-0000-4000-8000-000000000002','e2000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000001/e2000000-0000-4000-8000-000000000002/b.webp','e1000000-0000-4000-8000-000000000001/e2000000-0000-4000-8000-000000000002/b.thumb.webp','image/webp',200000),
 ('e3000000-0000-4000-8000-000000000003','e2000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000001/e2000000-0000-4000-8000-000000000002/c.webp',null,'image/webp',200000);

set local role authenticated;
-- Only the author can remove.
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000002',true);
select removed_test.denied($q$select public.detach_trace_media('e3000000-0000-4000-8000-000000000001')$q$,'42501');
select removed_test.check((select count(*)=0 from public.removed_trace_media_due()),'nothing due for another member');

select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000001',true);
select public.detach_trace_media('e3000000-0000-4000-8000-000000000001');
select public.detach_trace_media('e3000000-0000-4000-8000-000000000002');
-- The draft photo and its thumbnail are due at once; the revision photo is kept.
select removed_test.check((select count(*)=2 from public.removed_trace_media_due()),'draft photo and thumbnail due');
select removed_test.check((select bool_and(object_path like '%/e2000000-0000-4000-8000-000000000001/%') from public.removed_trace_media_due()),'only the draft files are due');
-- A removed path cannot be attached again, even a kept one.
select removed_test.denied($q$select public.attach_trace_media('e2000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000001/e2000000-0000-4000-8000-000000000002/b.webp')$q$,'22023');
-- The author cannot delete the kept file, and staff functions are refused.
delete from storage.objects where name='e1000000-0000-4000-8000-000000000001/e2000000-0000-4000-8000-000000000002/b.webp';
reset role;
select removed_test.check((select count(*)=1 from storage.objects where name like '%/b.webp'),'kept revision photo cannot be deleted');
set local role authenticated;
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000001',true);
select removed_test.denied($q$select * from public.staff_removed_trace_media('e2000000-0000-4000-8000-000000000002')$q$,'42501');
-- Another member cannot delete the due draft files (in this Storage stub, deleting the row stands in for the Storage API).
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000002',true);
delete from storage.objects where name like 'e1000000-0000-4000-8000-000000000001/e2000000-0000-4000-8000-000000000001/%';
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000001',true);
select removed_test.check((select count(*)=2 from public.removed_trace_media_due()),'other member deleted nothing');
-- The author can.
delete from storage.objects where name like 'e1000000-0000-4000-8000-000000000001/e2000000-0000-4000-8000-000000000001/%';
select removed_test.check((select count(*)=0 from public.removed_trace_media_due()),'author deleted the due draft files');

-- Staff see the kept photo (with its thumbnail) and can read it; another member cannot.
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000003',true);
select removed_test.check((select count(*)=1 from public.staff_removed_trace_media('e2000000-0000-4000-8000-000000000002') where thumb_path like '%/b.thumb.webp' and delete_after is null),'staff list the kept photo');
select removed_test.check((select count(*)=2 from storage.objects where name like '%/e2000000-0000-4000-8000-000000000002/b%'),'staff read the kept files');
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000002',true);
select removed_test.check((select count(*)=0 from storage.objects where name like '%/e2000000-0000-4000-8000-000000000002/b%'),'other member cannot read kept files');

-- The final decision starts the 30 day clock; other status changes do not.
reset role;
update public.traces set status='pending' where id='e2000000-0000-4000-8000-000000000002';
select removed_test.check((select delete_after is null from private.retired_trace_media where object_path like '%/b.webp'),'resubmitting does not start the clock');
update public.traces set status='approved',published_at=now() where id='e2000000-0000-4000-8000-000000000002';
select removed_test.check((select delete_after between now()+interval '29 days' and now()+interval '31 days' from private.retired_trace_media where object_path like '%/b.webp'),'approval keeps it 30 days');
set local role authenticated;
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000001',true);
select removed_test.check((select count(*)=0 from public.removed_trace_media_due()),'not due before 30 days');
-- 29 days later: still kept. 31 days later: due, and gone from the staff view.
select removed_test.age('e1000000-0000-4000-8000-000000000001/e2000000-0000-4000-8000-000000000002/b.webp',now()+interval '1 day');
select removed_test.check((select count(*)=0 from public.removed_trace_media_due()),'still kept on day 29');
select removed_test.age('e1000000-0000-4000-8000-000000000001/e2000000-0000-4000-8000-000000000002/b.webp',now()-interval '1 day');
select removed_test.age('e1000000-0000-4000-8000-000000000001/e2000000-0000-4000-8000-000000000002/b.thumb.webp',now()-interval '1 day');
select removed_test.check((select count(*)=2 from public.removed_trace_media_due()),'due on day 31');
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000003',true);
select removed_test.check((select count(*)=0 from public.staff_removed_trace_media('e2000000-0000-4000-8000-000000000002')),'staff view drops it once due');
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000001',true);
delete from storage.objects where name like '%/e2000000-0000-4000-8000-000000000002/b%';
reset role;
select removed_test.check((select count(*)=0 from storage.objects where name like '%/e2000000-0000-4000-8000-000000000002/b%'),'author deletes the due kept files');
-- The photo still attached to the Trace is untouched.
select removed_test.check((select count(*)=1 from public.trace_media where id='e3000000-0000-4000-8000-000000000003'),'attached photo stays');
select removed_test.check((select count(*)=1 from storage.objects where name like '%/c.webp'),'attached file stays');
rollback;
