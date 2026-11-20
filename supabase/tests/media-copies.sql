-- Trace photo copies (thumbnails and display copies): who may attach them, naming, limits and who may read them.
-- Run on a local/test database after all migrations. Fixtures are rolled back.
begin;
create schema copies_test;
grant usage on schema copies_test to anon,authenticated;
create function copies_test.check(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Media copies check failed: %',label; end if; end $$;
create function copies_test.denied(statement text,code text) returns void language plpgsql as $$
begin
 begin execute statement;
 exception when others then
  if sqlstate=code then return; end if;
  raise;
 end;
 raise exception 'Unexpectedly allowed: %',statement;
end $$;

insert into auth.users(id,email,raw_user_meta_data) values
 ('c1000000-0000-4000-8000-000000000001','copies-owner@example.invalid','{}'),
 ('c1000000-0000-4000-8000-000000000002','copies-other@example.invalid','{}');
insert into public.traces(id,author_id,category_id,title,description,location_name,status,published_at)
 select ('c2000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'c1000000-0000-4000-8000-000000000001',
 (select id from public.categories limit 1),'Copies fixture','Observation','Coast',status::public.trace_state,now()
 from (values (1,'draft'),(2,'pending'),(3,'approved')) as statuses(n,status);
insert into storage.objects(bucket_id,name,owner_id,metadata)
 select 'trace-media','c1000000-0000-4000-8000-000000000001/c2000000-0000-4000-8000-00000000000'||n||'/'||file,'c1000000-0000-4000-8000-000000000001',meta::jsonb
 from (values
  (1,'photo.jpg','{"mimetype":"image/jpeg","size":3000000}'),
  (1,'photo.thumb.webp','{"mimetype":"image/webp","size":40000}'),
  (1,'photo.big.thumb.webp','{"mimetype":"image/webp","size":40000}'),
  (2,'photo.jpg','{"mimetype":"image/jpeg","size":3000000}'),
  (2,'photo.thumb.webp','{"mimetype":"image/webp","size":40000}'),
  (3,'photo.jpg','{"mimetype":"image/jpeg","size":3000000}'),
  (3,'photo.thumb.webp','{"mimetype":"image/webp","size":40000}')
 ) as files(n,file,meta);
insert into public.trace_media(id,trace_id,object_path,mime_type,size_bytes)
 select ('c3000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('c2000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'c1000000-0000-4000-8000-000000000001/c2000000-0000-4000-8000-00000000000'||n||'/photo.jpg','image/jpeg',3000000
 from generate_series(1,3) n;

-- The bucket and the table now stop at 8 MB.
select copies_test.check((select file_size_limit=8388608 from storage.buckets where id='trace-media'),'bucket limit is 8 MB');
select copies_test.denied($q$insert into public.trace_media(trace_id,object_path,mime_type,size_bytes) values('c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001/c2000000-0000-4000-8000-000000000001/huge.jpg','image/jpeg',8388609)$q$,'23514');
-- Copy names must match the original's name.
select copies_test.denied($q$update public.trace_media set display_path='c1000000-0000-4000-8000-000000000001/c2000000-0000-4000-8000-000000000001/other.display.webp' where id='c3000000-0000-4000-8000-000000000001'$q$,'23514');
update public.trace_media set display_path='c1000000-0000-4000-8000-000000000001/c2000000-0000-4000-8000-000000000003/photo.display.webp' where id='c3000000-0000-4000-8000-000000000003';
insert into storage.objects(bucket_id,name,owner_id,metadata) values
 ('trace-media','c1000000-0000-4000-8000-000000000001/c2000000-0000-4000-8000-000000000003/photo.display.webp','c1000000-0000-4000-8000-000000000001','{"mimetype":"image/webp","size":300000}');

select set_config('copies_test.version',(select version::text from public.traces where id='c2000000-0000-4000-8000-000000000001'),true);
set local role authenticated;
-- Someone else cannot attach a thumbnail.
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000002',true);
select copies_test.denied($q$select public.set_trace_media_thumb('c3000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001/c2000000-0000-4000-8000-000000000001/photo.thumb.webp')$q$,'42501');
-- The author: wrong name, missing file, and a Trace that is no longer editable are refused.
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000001',true);
select copies_test.denied($q$select public.set_trace_media_thumb('c3000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001/c2000000-0000-4000-8000-000000000001/photo.big.thumb.webp')$q$,'22023');
select copies_test.denied($q$select public.set_trace_media_thumb('c3000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000001/c2000000-0000-4000-8000-000000000002/photo.thumb.webp')$q$,'42501');
select copies_test.denied($q$select public.set_trace_media_thumb('c3000000-0000-4000-8000-000000000099','x')$q$,'PT404');
-- The right thumbnail on an editable draft is attached without changing the Trace version.
select copies_test.check((select thumb_path like '%/photo.thumb.webp' from public.set_trace_media_thumb('c3000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001/c2000000-0000-4000-8000-000000000001/photo.thumb.webp')),'thumbnail attached');
select copies_test.check((select version::text from public.traces where id='c2000000-0000-4000-8000-000000000001')=current_setting('copies_test.version'),'version unchanged');
reset role;
update public.trace_media set thumb_path='c1000000-0000-4000-8000-000000000001/c2000000-0000-4000-8000-000000000003/photo.thumb.webp' where id='c3000000-0000-4000-8000-000000000003';
update public.trace_media set thumb_path='c1000000-0000-4000-8000-000000000001/c2000000-0000-4000-8000-000000000002/photo.thumb.webp' where id='c3000000-0000-4000-8000-000000000002';
-- A thumbnail that is not WebP or too big is refused.
update storage.objects set metadata='{"mimetype":"image/png","size":40000}' where name='c1000000-0000-4000-8000-000000000001/c2000000-0000-4000-8000-000000000001/photo.thumb.webp';
set local role authenticated;
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000001',true);
select copies_test.denied($q$select public.set_trace_media_thumb('c3000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001/c2000000-0000-4000-8000-000000000001/photo.thumb.webp')$q$,'22023');

-- Reading copies follows the original: anyone for the approved Trace, nobody else for the pending one.
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select copies_test.check((select count(*)=1 from storage.objects where name like '%/c2000000-0000-4000-8000-000000000003/photo.thumb.webp'),'public thumbnail readable');
select copies_test.check((select count(*)=1 from storage.objects where name like '%/c2000000-0000-4000-8000-000000000003/photo.display.webp'),'public display copy readable');
select copies_test.check((select count(*)=0 from storage.objects where name like '%/c2000000-0000-4000-8000-000000000002/photo.thumb.webp'),'pending thumbnail hidden');
set local role authenticated;
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000002',true);
select copies_test.check((select count(*)=0 from storage.objects where name like '%/c2000000-0000-4000-8000-000000000002/photo.thumb.webp'),'other member cannot read pending thumbnail');
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000001',true);
select copies_test.check((select count(*)=1 from storage.objects where name like '%/c2000000-0000-4000-8000-000000000002/photo.thumb.webp'),'author reads own pending thumbnail');
-- Unattached files stay unreadable.
select copies_test.check((select count(*)=0 from storage.objects where name like '%/photo.big.thumb.webp'),'unattached copy hidden');
rollback;
