-- Run against a DISPOSABLE development database after the initial migration.
-- No persisted fixtures: all changes are rolled back on successful completion.
begin;
do $$ begin
 if exists(select 1 from auth.users) then raise exception 'Tests require a fresh disposable project with no Auth users'; end if;
end $$;
create schema tidetrace_test;
grant usage on schema tidetrace_test to anon,authenticated;
create function tidetrace_test.assert_ok(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; end $$;
create function tidetrace_test.reject(statement text,expected_code text default null) returns void language plpgsql as $$
begin
 begin
 execute statement;
 exception when others then
 if expected_code is not null and SQLSTATE <> expected_code then raise exception 'Wrong error code %, expected %: %',SQLSTATE,expected_code,SQLERRM; end if;
 return;
 end;
 raise exception 'FAIL: unauthorized/invalid statement succeeded: %',statement;
end $$;

insert into auth.users(id,email,raw_user_meta_data) values
 ('10000000-0000-0000-0000-000000000001','tt-admin@example.invalid','{"display_name":"Admin"}'),
 ('10000000-0000-0000-0000-000000000002','tt-member@example.invalid','{"display_name":"Member","role":"admin"}'),
 ('10000000-0000-0000-0000-000000000003','tt-other@example.invalid','{"display_name":"Other"}'),
 ('10000000-0000-0000-0000-000000000004','tt-staff@example.invalid','{"display_name":"Moderator"}');
select tidetrace_test.assert_ok((select role='user' from public.profiles where id='10000000-0000-0000-0000-000000000002'),'Signup metadata cannot grant admin');
update public.profiles set role='admin' where id='10000000-0000-0000-0000-000000000001';
update public.profiles set role='moderator' where id='10000000-0000-0000-0000-000000000004';
select set_config('test.category_id',(select id::text from public.categories where name='Pollution'),true);

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select tidetrace_test.assert_ok((select role='user' from public.get_my_profile()),'Own protected profile is readable');
select tidetrace_test.reject($q$update public.profiles set role='admin' where id=auth.uid()$q$,'42501');
select tidetrace_test.reject($q$select public.admin_set_account(auth.uid(),'admin','active','Escalate')$q$,'42501');
select tidetrace_test.reject($q$select * from public.admin_list_profiles()$q$,'42501');
select tidetrace_test.reject($q$insert into public.notifications(recipient_id,type,message) values(auth.uid(),'forged','Forged')$q$,'42501');
select tidetrace_test.reject($q$select * from public.profiles$q$,'42501');
update public.profiles set display_name='Updated Member' where id=auth.uid();
-- The ERD requires an image; a video-only draft must remain unsubmitted.
select set_config('test.video_trace_id',id::text,true) from public.save_trace_draft(null,null,'Video only','Video evidence',current_setting('test.category_id')::uuid,'Coast',null,null);
insert into storage.objects(bucket_id,name,owner_id,metadata)
values('trace-media',auth.uid()::text||'/'||current_setting('test.video_trace_id')||'/clip.mp4',auth.uid()::text,'{"mimetype":"video/mp4","size":4096}');
select public.attach_trace_media(current_setting('test.video_trace_id')::uuid,auth.uid()::text||'/'||current_setting('test.video_trace_id')||'/clip.mp4');
select tidetrace_test.reject($q$select public.submit_trace(current_setting('test.video_trace_id')::uuid,2)$q$);
select public.detach_trace_media(id) from public.trace_media where trace_id=current_setting('test.video_trace_id')::uuid;
select tidetrace_test.assert_ok((select count(*)=0 from storage.objects where name like '%/clip.mp4'),'Detached uploads are no longer accessible');
select set_config('test.trace_id',id::text,true) from public.save_trace_draft(null,null,'Coastal debris','Plastic along the coast',current_setting('test.category_id')::uuid,'Brgy. Lawis',null,null);
select tidetrace_test.reject($q$update public.traces set status='approved' where id=current_setting('test.trace_id')::uuid$q$,'42501');
select tidetrace_test.reject($q$select public.submit_trace(current_setting('test.trace_id')::uuid,1)$q$);
select tidetrace_test.reject($q$select public.attach_trace_media(current_setting('test.trace_id')::uuid,auth.uid()::text||'/'||current_setting('test.trace_id')||'/missing.jpg')$q$);

-- This is a Storage metadata fixture, not a real upload. Hosted tests must also
-- verify actual HTTP uploads. Production code must never insert Storage rows.
insert into storage.objects(bucket_id,name,owner_id,metadata)
values('trace-media',auth.uid()::text||'/'||current_setting('test.trace_id')||'/evidence.jpg',auth.uid()::text,'{"mimetype":"image/jpeg","size":4096}');
select public.attach_trace_media(current_setting('test.trace_id')::uuid,auth.uid()::text||'/'||current_setting('test.trace_id')||'/evidence.jpg');
select tidetrace_test.assert_ok((select count(*)=1 from storage.objects where bucket_id='trace-media'),'Owner can read attached evidence');
select public.submit_trace(current_setting('test.trace_id')::uuid,2);
select tidetrace_test.reject($q$select public.moderate_trace(current_setting('test.trace_id')::uuid,3,'approved',null)$q$,'42501');
select tidetrace_test.reject($q$select public.save_trace_draft(current_setting('test.trace_id')::uuid,3,'Changed','Changed',current_setting('test.category_id')::uuid,'Elsewhere',null,null)$q$,'42501');
select tidetrace_test.reject($q$insert into storage.objects(bucket_id,name,owner_id,metadata) values('trace-media',auth.uid()::text||'/'||current_setting('test.trace_id')||'/late.jpg',auth.uid()::text,'{}')$q$,'42501');

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
select tidetrace_test.assert_ok((select count(*)=0 from public.traces where id=current_setting('test.trace_id')::uuid),'Other member cannot see pending Trace');
select tidetrace_test.assert_ok((select count(*)=0 from storage.objects where bucket_id='trace-media'),'Other member cannot read pending evidence');
select tidetrace_test.reject($q$select public.submit_trace(current_setting('test.trace_id')::uuid,3)$q$,'42501');
select tidetrace_test.reject($q$insert into public.comments(trace_id,body) values(current_setting('test.trace_id')::uuid,'Private target')$q$,'42501');
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select tidetrace_test.assert_ok((select count(*)=0 from public.traces where id=current_setting('test.trace_id')::uuid),'Visitor cannot read pending Trace');
select tidetrace_test.reject($q$select public.get_my_profile()$q$,'42501');

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
select tidetrace_test.reject($q$select public.moderate_trace(current_setting('test.trace_id')::uuid,3,'revision_requested','')$q$);
select public.moderate_trace(current_setting('test.trace_id')::uuid,3,'revision_requested','Please clarify the location.');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select public.save_trace_draft(current_setting('test.trace_id')::uuid,4,'Coastal debris','Plastic along the coast',current_setting('test.category_id')::uuid,'Northern Brgy. Lawis',null,null);
select public.submit_trace(current_setting('test.trace_id')::uuid,5);
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
select tidetrace_test.reject($q$select public.moderate_trace(current_setting('test.trace_id')::uuid,3,'approved',null)$q$,'40001');
select public.moderate_trace(current_setting('test.trace_id')::uuid,6,'approved','Verified');
select tidetrace_test.reject($q$select public.moderate_trace(current_setting('test.trace_id')::uuid,7,'approved',null)$q$);
select tidetrace_test.assert_ok((select count(*)=2 from public.moderation_actions where trace_id=current_setting('test.trace_id')::uuid),'Two reviews have two audit records');
select tidetrace_test.reject($q$delete from public.moderation_actions$q$,'42501');

set local role anon;
select set_config('request.jwt.claim.sub','',true);
select tidetrace_test.assert_ok((select count(*)=1 from public.traces where id=current_setting('test.trace_id')::uuid),'Approved Trace is public');
select tidetrace_test.assert_ok((select count(*)=1 from storage.objects where bucket_id='trace-media'),'Approved evidence is public through private-bucket policy');
select tidetrace_test.assert_ok((select display_name='Updated Member' from public.profiles where id='10000000-0000-0000-0000-000000000002'),'Public author name is readable');

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select tidetrace_test.assert_ok((select count(*)=2 from public.notifications),'Owner receives review notifications');
select public.mark_notifications_read(null);
select tidetrace_test.assert_ok((select count(*)=0 from public.notifications where read_at is null),'Notification reads persist');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
select tidetrace_test.assert_ok((select count(*)=0 from public.notifications),'Other member cannot read owner notifications');
insert into public.comments(trace_id,body) values(current_setting('test.trace_id')::uuid,'Community observation');
insert into public.reports(trace_id,reason) values(current_setting('test.trace_id')::uuid,'Evidence needs review');
select set_config('test.report_id',id::text,true) from public.reports where reporter_id=auth.uid();
select tidetrace_test.reject($q$insert into public.reports(trace_id,reason) values(current_setting('test.trace_id')::uuid,'Duplicate open report')$q$,'23505');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
select public.resolve_report(current_setting('test.report_id')::uuid,true,'Evidence contains identifying information');
select tidetrace_test.assert_ok((select count(*)=0 from public.moderation_actions where num_nonnulls(trace_id,comment_id,report_id)<>1),'Each audit action has exactly one target');
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select tidetrace_test.assert_ok((select count(*)=0 from public.traces where id=current_setting('test.trace_id')::uuid),'Hidden approved Trace is private');
select tidetrace_test.assert_ok((select count(*)=0 from storage.objects where bucket_id='trace-media'),'Hidden evidence is private');
select tidetrace_test.assert_ok((select count(*)=0 from public.comments where trace_id=current_setting('test.trace_id')::uuid),'Hidden Trace comments are private');

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select tidetrace_test.reject($q$select public.admin_set_account(auth.uid(),'user','active','Last admin')$q$);
select tidetrace_test.reject($q$select public.admin_set_account(auth.uid(),'admin','suspended','Suspend last admin')$q$);
select public.admin_set_account('10000000-0000-0000-0000-000000000003','moderator','active','Appointed by admin');
select tidetrace_test.assert_ok((select count(*)=1 from public.admin_audit_logs where target_user_id='10000000-0000-0000-0000-000000000003'),'Promotion is audited');
select public.admin_set_account('10000000-0000-0000-0000-000000000003','moderator','suspended','Suspension test');
insert into public.tides(title,slug,body,status) values('Test Tide','tidetrace-access-test','Published article','published');
insert into public.settings(key,value) values('test_setting','true');
select tidetrace_test.assert_ok((select updated_by=auth.uid() from public.settings where key='test_setting'),'Settings actor is recorded');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
select tidetrace_test.assert_ok((select status='suspended' from public.get_my_profile()),'Suspended account can read own status');
select tidetrace_test.assert_ok(not private.is_staff(),'Suspension immediately removes staff access');
select tidetrace_test.reject($q$select public.save_trace_draft(null,null,'Blocked','Blocked',current_setting('test.category_id')::uuid,'Coast',null,null)$q$,'42501');
select tidetrace_test.reject($q$select public.resolve_report(current_setting('test.report_id')::uuid,false,'Unauthorized')$q$,'42501');
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select tidetrace_test.assert_ok((select status='published' and published_at is not null from public.tides where slug='tidetrace-access-test'),'Reading Tide does not alter publishing status');
reset role;
select tidetrace_test.reject($q$insert into public.moderation_actions(actor_id,trace_id,report_id,action) values('10000000-0000-0000-0000-000000000004',current_setting('test.trace_id')::uuid,current_setting('test.report_id')::uuid,'invalid')$q$,'23514');
select tidetrace_test.reject($q$insert into public.moderation_actions(actor_id,action) values('10000000-0000-0000-0000-000000000004','invalid')$q$,'23514');
select tidetrace_test.reject($q$insert into public.reports(reporter_id,reason) values('10000000-0000-0000-0000-000000000002','Missing target')$q$,'23514');
select tidetrace_test.assert_ok((select bool_and(relrowsecurity) from pg_class where oid in (
 'public.profiles'::regclass,'public.categories'::regclass,'public.traces'::regclass,'public.trace_media'::regclass,
 'public.tides'::regclass,'public.comments'::regclass,'public.reports'::regclass,'public.moderation_actions'::regclass,
 'public.notifications'::regclass,'public.settings'::regclass,'public.admin_audit_logs'::regclass)), 'All application tables have RLS');
rollback;
