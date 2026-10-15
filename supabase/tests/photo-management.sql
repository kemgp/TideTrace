begin;
create schema photo_test;
grant usage on schema photo_test to anon,authenticated;
create function photo_test.check(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; end $$;
create function photo_test.reject(statement text) returns void language plpgsql as $$
begin
 begin execute statement; exception when others then return; end;
 raise exception 'FAIL: statement unexpectedly succeeded: %',statement;
end $$;
insert into auth.users(id,email,raw_user_meta_data) values
 ('71000000-0000-0000-0000-000000000001','photo-owner@example.invalid','{}'),
 ('71000000-0000-0000-0000-000000000002','photo-other@example.invalid','{}');
insert into storage.objects(bucket_id,name,owner_id,metadata,created_at) values
 ('profile-photos','71000000-0000-0000-0000-000000000001/current.png','71000000-0000-0000-0000-000000000001','{"mimetype":"image/png","size":4096}',now()-interval '2 days'),
 ('profile-photos','71000000-0000-0000-0000-000000000001/unused.png','71000000-0000-0000-0000-000000000001','{"mimetype":"image/png","size":4096}',now()-interval '2 days'),
 ('profile-photos','71000000-0000-0000-0000-000000000001/recent.png','71000000-0000-0000-0000-000000000001','{"mimetype":"image/png","size":4096}',now()),
 ('profile-photos','71000000-0000-0000-0000-000000000002/other.png','71000000-0000-0000-0000-000000000002','{"mimetype":"image/png","size":4096}',now()-interval '2 days');
set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-0000-0000-000000000001',true);
select public.set_profile_photo(auth.uid()::text||'/current.png');
select photo_test.check((select count(*)=1 from public.claim_profile_photo_cleanup()),'Only old unused own photo is claimed');
select photo_test.check((select count(*)=1 from public.claim_profile_photo_cleanup()),'Failed cleanup can be retried');
select photo_test.reject($q$select public.set_profile_photo(auth.uid()::text||'/unused.png')$q$);
select photo_test.reject($q$select public.set_profile_photo('71000000-0000-0000-0000-000000000002/other.png')$q$);
-- In this local Storage stub only, simulate the DELETE performed by Storage API.
delete from storage.objects where bucket_id='profile-photos' and name=auth.uid()::text||'/current.png';
select photo_test.check((select count(*)=1 from storage.objects where name=auth.uid()::text||'/current.png'),'Current photo cannot be deleted');
delete from storage.objects where bucket_id='profile-photos' and name=auth.uid()::text||'/recent.png';
select photo_test.check((select count(*)=1 from storage.objects where name=auth.uid()::text||'/recent.png'),'Recent unattached upload cannot be deleted');
delete from storage.objects where bucket_id='profile-photos' and name='71000000-0000-0000-0000-000000000002/other.png';
delete from storage.objects where bucket_id='profile-photos' and name=auth.uid()::text||'/unused.png';
select photo_test.check((select count(*)=0 from storage.objects where name=auth.uid()::text||'/unused.png'),'Retired unused photo can be deleted');
select photo_test.reject($q$insert into storage.objects(bucket_id,name,owner_id,metadata) values('profile-photos',auth.uid()::text||'/unused.png',auth.uid()::text,'{"mimetype":"image/png","size":4096}')$q$);
select public.remove_profile_photo();
select photo_test.check((select avatar_path is null from public.get_my_profile()),'Removal clears saved profile');
select public.remove_profile_photo();
select photo_test.check((select count(*)=1 from public.claim_profile_photo_cleanup()),'Removed old photo becomes cleanup eligible');
select photo_test.reject($q$select public.set_profile_photo(auth.uid()::text||'/current.png')$q$);
select public.set_profile_photo(auth.uid()::text||'/recent.png');
reset role;
select photo_test.check((select count(*)=1 from storage.objects where name='71000000-0000-0000-0000-000000000002/other.png'),'Other account photo is preserved');
insert into public.traces(id,author_id,category_id,title,description,location_name,status)
values('72000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000002',(select id from public.categories limit 1),'Public trace','Observation','Coast','approved');
insert into public.comments(trace_id,author_id,body)
values('72000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001','Comment from a member without their own published Trace');
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select photo_test.check((select count(*)=1 from storage.objects where name='71000000-0000-0000-0000-000000000001/recent.png'),'Visible comment makes current photo readable');
select photo_test.check((select count(*)=0 from storage.objects where name='71000000-0000-0000-0000-000000000001/current.png'),'Old commenter photo stays private');
select photo_test.reject('select public.remove_profile_photo()');
select photo_test.reject('select public.claim_profile_photo_cleanup()');
reset role;
update public.comments set status='hidden' where author_id='71000000-0000-0000-0000-000000000001';
set local role anon;
select photo_test.check((select count(*)=0 from storage.objects where name='71000000-0000-0000-0000-000000000001/recent.png'),'Hidden comment no longer exposes photo');
reset role;
update public.comments set status='visible' where author_id='71000000-0000-0000-0000-000000000001';
update public.traces set is_hidden=true where id='72000000-0000-0000-0000-000000000001';
set local role anon;
select photo_test.check((select count(*)=0 from storage.objects where name='71000000-0000-0000-0000-000000000001/recent.png'),'Hidden Trace no longer exposes commenter photo');
reset role;
update public.profiles set status='suspended' where id='71000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-0000-0000-000000000001',true);
select photo_test.reject('select public.remove_profile_photo()');
select photo_test.reject('select public.claim_profile_photo_cleanup()');
select photo_test.reject($q$select public.set_profile_photo(auth.uid()::text||'/recent.png')$q$);
reset role;
rollback;
