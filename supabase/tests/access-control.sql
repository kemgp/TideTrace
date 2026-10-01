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
-- Report a visible comment, verify ownership, dismiss, then report/remove it.
select set_config('test.comment_id',(select id::text from public.comments where trace_id=current_setting('test.trace_id')::uuid limit 1),true);
insert into public.reports(comment_id,reason) values(current_setting('test.comment_id')::uuid,'Comment needs review');
select set_config('test.comment_report_id',(select id::text from public.reports where comment_id=current_setting('test.comment_id')::uuid and status='open'),true);
select tidetrace_test.reject($q$insert into public.reports(comment_id,reason) values(current_setting('test.comment_id')::uuid,'Duplicate comment report')$q$,'23505');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select tidetrace_test.assert_ok((select count(*)=0 from public.reports),'Another member cannot see private reports');
select tidetrace_test.reject($q$select public.resolve_report(current_setting('test.comment_report_id')::uuid,true,'Unauthorized')$q$,'42501');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
select public.resolve_report(current_setting('test.comment_report_id')::uuid,false,'Comment is acceptable');
select tidetrace_test.assert_ok((select status='visible' from public.comments where id=current_setting('test.comment_id')::uuid),'Dismissal preserves visible comment');
select tidetrace_test.assert_ok((select status='dismissed' and resolution_reason='Comment is acceptable' and resolved_by=auth.uid() and resolved_at is not null from public.reports where id=current_setting('test.comment_report_id')::uuid),'Dismissal persists decision and actor');
select tidetrace_test.reject($q$select public.resolve_report(current_setting('test.comment_report_id')::uuid,true,'Stale second review')$q$);
select tidetrace_test.assert_ok((select count(*)=1 from public.moderation_actions where report_id=current_setting('test.comment_report_id')::uuid),'Closed report is not audited twice');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
insert into public.reports(comment_id,reason) values(current_setting('test.comment_id')::uuid,'New evidence');
select set_config('test.comment_report_id',(select id::text from public.reports where comment_id=current_setting('test.comment_id')::uuid and status='open'),true);
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
select public.resolve_report(current_setting('test.comment_report_id')::uuid,true,'Comment violates guidelines');
select tidetrace_test.assert_ok((select status='hidden' from public.comments where id=current_setting('test.comment_id')::uuid),'Removal hides reported comment');
select tidetrace_test.assert_ok((select status='resolved' from public.reports where id=current_setting('test.comment_report_id')::uuid),'Removal resolves report');
select tidetrace_test.assert_ok((select count(*)=1 from public.moderation_actions where comment_id=current_setting('test.comment_id')::uuid and action='hide_content'),'Comment removal is audited');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
select tidetrace_test.assert_ok((select count(*)=2 from public.notifications where type='report_review'),'Reporter receives report decision notifications');
select tidetrace_test.assert_ok((select count(*)=1 from public.notifications where type='content_hidden'),'Comment owner receives removal notification');
select tidetrace_test.reject($q$insert into public.reports(comment_id,reason) values(current_setting('test.comment_id')::uuid,'Hidden comment')$q$,'42501');
set local role anon;
select tidetrace_test.assert_ok((select count(*)=0 from public.comments where id=current_setting('test.comment_id')::uuid),'Removed comment is hidden from public reads');
set local role authenticated;
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

-- Completion isolation, immutable timestamps, publication eligibility and persistence.
reset role;
select set_config('test.tide_id',(select id::text from public.tides where slug='tidetrace-access-test'),true);
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
insert into public.tide_completions(user_id,tide_id) values(auth.uid(),current_setting('test.tide_id')::uuid);
select tidetrace_test.assert_ok((select count(*)=1 from public.tide_completions),'Member reads own completion');
select tidetrace_test.reject($q$insert into public.tide_completions(user_id,tide_id) values(auth.uid(),current_setting('test.tide_id')::uuid)$q$,'23505');
select tidetrace_test.reject($q$insert into public.tide_completions(user_id,tide_id) values('10000000-0000-0000-0000-000000000003',current_setting('test.tide_id')::uuid)$q$,'42501');
select tidetrace_test.reject($q$update public.tide_completions set completed_at=now()$q$,'42501');
select tidetrace_test.reject($q$delete from public.tide_completions$q$,'42501');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
select tidetrace_test.assert_ok((select count(*)=0 from public.tide_completions),'Another member cannot read completion');
select tidetrace_test.reject($q$insert into public.tide_completions(user_id,tide_id,completed_at) values(auth.uid(),current_setting('test.tide_id')::uuid,now())$q$,'42501');
reset role;
select set_config('test.completed_at',(select completed_at::text from public.tide_completions limit 1),true);
update public.tides set body='Updated lesson content' where id=current_setting('test.tide_id')::uuid;
select tidetrace_test.assert_ok((select completed_at::text=current_setting('test.completed_at') from public.tide_completions limit 1),'Text edits preserve completion timestamp');
update public.tides set status='archived' where id=current_setting('test.tide_id')::uuid;
set local role authenticated;
select tidetrace_test.reject($q$insert into public.tide_completions(user_id,tide_id) values(auth.uid(),current_setting('test.tide_id')::uuid)$q$,'42501');
reset role;
update public.tides set status='draft' where id=current_setting('test.tide_id')::uuid;
set local role authenticated;
select tidetrace_test.reject($q$insert into public.tide_completions(user_id,tide_id) values(auth.uid(),current_setting('test.tide_id')::uuid)$q$,'42501');
reset role;
update public.tides set status='published' where id=current_setting('test.tide_id')::uuid;
update public.profiles set status='suspended' where id='10000000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select tidetrace_test.assert_ok((select count(*)=0 from public.tide_completions),'Suspended member cannot read completion');
select tidetrace_test.reject($q$insert into public.tide_completions(user_id,tide_id) values(auth.uid(),current_setting('test.tide_id')::uuid)$q$,'42501');
set local role anon;
select tidetrace_test.reject($q$select * from public.tide_completions$q$,'42501');
select tidetrace_test.reject($q$insert into public.tide_completions(user_id,tide_id) values('10000000-0000-0000-0000-000000000003',current_setting('test.tide_id')::uuid)$q$,'42501');
reset role;

-- Aggregate permissions and counts beyond one API page.
reset role;
update public.profiles set status='active' where id='10000000-0000-0000-0000-000000000002';
insert into public.traces(author_id,category_id,title)
 select '10000000-0000-0000-0000-000000000002',current_setting('test.category_id')::uuid,'Draft '||n from generate_series(1,31) n;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select tidetrace_test.assert_ok((public.get_dashboard_summary()->>'drafts')::int=32,'Counts include more than one API page');
select tidetrace_test.assert_ok((public.get_dashboard_summary()->>'traces')::int=33,'Member totals include own nondeleted drafts and hidden Trace');
select tidetrace_test.assert_ok((public.get_dashboard_summary()->>'approved')::int=0,'Hidden approved Trace is not a published total');
select tidetrace_test.assert_ok((public.get_dashboard_summary()->>'tides_finished')::int=1,'Completed lessons count saved records');
select tidetrace_test.assert_ok((public.get_dashboard_summary()->>'comments_posted')::int=0,'Another author comments are excluded');
select tidetrace_test.assert_ok(not (public.get_dashboard_summary() ? 'users'),'Member cannot read global account totals');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
select tidetrace_test.assert_ok((public.get_dashboard_summary()->>'open_reports')::int=0,'Resolved and dismissed reports leave the open queue count');
select tidetrace_test.assert_ok((public.get_dashboard_summary()->>'reviewed_today')::int >= 3,'Staff reviews count report decisions');
select tidetrace_test.assert_ok(not (public.get_dashboard_summary() ? 'users'),'Moderator cannot read global account totals');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select tidetrace_test.assert_ok((public.get_dashboard_summary()->>'users')::int=4,'Admin counts every account');
select tidetrace_test.assert_ok((public.get_dashboard_summary()->>'published_traces')::int=0,'Admin published count excludes hidden content');
reset role;
update public.profiles set status='suspended' where id='10000000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select tidetrace_test.reject($q$select public.get_dashboard_summary()$q$,'42501');
set local role anon;
select tidetrace_test.reject($q$select public.get_dashboard_summary()$q$,'42501');
reset role;

-- Guarded account edits preserve audit history and last-admin protection.
reset role;
select set_config('test.account_stamp',(select updated_at::text from public.profiles where id='10000000-0000-0000-0000-000000000002'),true);
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select tidetrace_test.reject($q$select public.admin_update_account('10000000-0000-0000-0000-000000000002','moderator','active','Stale edit','2000-01-01'::timestamptz)$q$,'40001');
select public.admin_update_account('10000000-0000-0000-0000-000000000002','moderator','active','Assign reviewer',current_setting('test.account_stamp')::timestamptz);
select tidetrace_test.reject($q$select public.admin_set_account('10000000-0000-0000-0000-000000000002','admin','active','Forbidden promotion')$q$,'42501');
select tidetrace_test.reject($q$select public.admin_update_account('10000000-0000-0000-0000-000000000002','admin','active','Forbidden promotion',(select updated_at from public.admin_list_profiles() where id='10000000-0000-0000-0000-000000000002'))$q$,'42501');
select tidetrace_test.assert_ok((select role='moderator' and status='active' from public.admin_list_profiles() where id='10000000-0000-0000-0000-000000000002'),'Account promotion persists');
select tidetrace_test.assert_ok((select count(*)=1 from public.admin_audit_logs where target_user_id='10000000-0000-0000-0000-000000000002' and reason='Assign reviewer' and new_values->>'role'='moderator'),'Guarded promotion is audited');
select public.admin_update_account('10000000-0000-0000-0000-000000000002','user','suspended','Remove access',(select updated_at from public.admin_list_profiles() where id='10000000-0000-0000-0000-000000000002'));
select public.admin_update_account('10000000-0000-0000-0000-000000000002','user','active','Reactivate member',(select updated_at from public.admin_list_profiles() where id='10000000-0000-0000-0000-000000000002'));
select tidetrace_test.assert_ok((select role='user' and status='active' from public.admin_list_profiles() where id='10000000-0000-0000-0000-000000000002'),'Demotion, suspension and reactivation persist');
select tidetrace_test.reject($q$select public.admin_update_account(auth.uid(),'user','active','Remove last admin',(select updated_at from public.get_my_profile()))$q$);
select tidetrace_test.reject($q$select public.admin_update_account(auth.uid(),'admin','suspended','Suspend last admin',(select updated_at from public.get_my_profile()))$q$);
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select tidetrace_test.reject($q$select public.admin_update_account(auth.uid(),'admin','active','Escalate',(select updated_at from public.get_my_profile()))$q$,'42501');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
select tidetrace_test.reject($q$select public.admin_update_account(auth.uid(),'admin','active','Escalate',(select updated_at from public.get_my_profile()))$q$,'42501');
set local role anon;
select tidetrace_test.reject($q$select public.admin_update_account(null,'admin','active','Escalate',now())$q$,'42501');
reset role;
-- Inactive category labels remain visible only through readable Traces.
reset role;
insert into public.categories(id,name,is_active) values
 ('90000000-0000-0000-0000-000000000001','Historic label',false),
 ('90000000-0000-0000-0000-000000000002','Unused inactive label',false);
insert into public.traces(author_id,category_id,title,description,location_name,status)
 values('10000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000001','Historic trace','Observation','Coast','approved');
select set_config('request.jwt.claim.sub','',true);
set local role anon;
select tidetrace_test.assert_ok((select count(*)=1 from public.categories where id='90000000-0000-0000-0000-000000000001'),'Public trace retains inactive category label');
select tidetrace_test.assert_ok((select count(*)=0 from public.categories where id='90000000-0000-0000-0000-000000000002'),'Unused inactive category remains private');
reset role;
rollback;
