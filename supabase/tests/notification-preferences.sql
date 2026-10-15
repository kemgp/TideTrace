begin;
create schema preference_test;
grant usage on schema preference_test to anon,authenticated;
create function preference_test.check(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; end $$;
create function preference_test.reject(statement text) returns void language plpgsql as $$
begin
 begin execute statement; exception when others then return; end;
 raise exception 'Unexpected success: %',statement;
end $$;
insert into auth.users(id,email,raw_user_meta_data) values
 ('74000000-0000-0000-0000-000000000001','prefs-owner@example.invalid','{}'),
 ('74000000-0000-0000-0000-000000000002','prefs-other@example.invalid','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','74000000-0000-0000-0000-000000000001',true);
select preference_test.check(public.get_notification_preferences()='{"submission_updates":true,"trace_comments":true,"new_tides":true}'::jsonb,'Default on');
select public.set_notification_preference('submission_updates',false);
select public.set_notification_preference('trace_comments',false);
select public.set_notification_preference('new_tides',false);
select preference_test.check(public.get_notification_preferences()='{"submission_updates":false,"trace_comments":false,"new_tides":false}'::jsonb,'Independent saves persist');
select preference_test.reject($q$select public.set_notification_preference('role',false)$q$);
select preference_test.reject($q$select public.set_notification_preference('new_tides',null)$q$);
select preference_test.reject($q$select * from private.notification_preferences$q$);
select set_config('request.jwt.claim.sub','74000000-0000-0000-0000-000000000002',true);
select preference_test.check((public.get_notification_preferences()->>'submission_updates')::boolean,'Other account unchanged');
reset role;
insert into public.notifications(recipient_id,type,message) values
 ('74000000-0000-0000-0000-000000000001','trace_review','Muted'),
 ('74000000-0000-0000-0000-000000000001','report_review','Required');
select preference_test.check((select count(*)=1 from public.notifications),'Optional muted, report notice retained');
insert into public.traces(id,author_id,category_id,title,description,location_name,status)
values('75000000-0000-0000-0000-000000000001','74000000-0000-0000-0000-000000000001',(select id from public.categories limit 1),'Comment target','Observation','Coast','approved');
insert into public.comments(trace_id,author_id,body) values
 ('75000000-0000-0000-0000-000000000001','74000000-0000-0000-0000-000000000002','Muted comment');
select preference_test.check((select count(*)=0 from public.notifications where type='trace_comment'),'Comments obey preference');
set local role authenticated;
select set_config('request.jwt.claim.sub','74000000-0000-0000-0000-000000000001',true);
select public.set_notification_preference('trace_comments',true);
select public.set_notification_preference('submission_updates',true);
reset role;
insert into public.comments(trace_id,author_id,body) values
 ('75000000-0000-0000-0000-000000000001','74000000-0000-0000-0000-000000000002','Notify comment'),
 ('75000000-0000-0000-0000-000000000001','74000000-0000-0000-0000-000000000001','Own comment');
select preference_test.check((select count(*)=1 from public.notifications where type='trace_comment'),'One alert, no self alert');
insert into public.notifications(recipient_id,type,message) values
 ('74000000-0000-0000-0000-000000000001','trace_review','Enabled');
select preference_test.check((select count(*)=1 from public.notifications where type='trace_review'),'Future reviews enabled');
insert into public.tides(id,author_id,title,slug,body,status) values
 ('76000000-0000-0000-0000-000000000001','74000000-0000-0000-0000-000000000002','First Tide','prefs-first','Learning','draft');
update public.tides set status='published' where id='76000000-0000-0000-0000-000000000001';
select preference_test.check((select count(*)=0 from public.notifications where type='new_tide'),'Muted Tide and no self announcement');
set local role authenticated;
select public.set_notification_preference('new_tides',true);
reset role;
update public.tides set status='draft' where id='76000000-0000-0000-0000-000000000001';
update public.tides set status='published' where id='76000000-0000-0000-0000-000000000001';
select preference_test.check((select count(*)=0 from public.notifications where type='new_tide'),'Republish does not duplicate or backfill');
insert into public.tides(author_id,title,slug,body,status) values
 ('74000000-0000-0000-0000-000000000002','Second Tide','prefs-second','Learning','published');
select preference_test.check((select count(*)=1 from public.notifications where type='new_tide'),'New publication announces');
set local role authenticated;
select public.set_notification_preference('trace_comments',false);
select preference_test.check((select count(*)=1 from public.notifications where type='trace_comment'),'Existing notifications remain');
reset role;
update public.profiles set status='suspended' where id='74000000-0000-0000-0000-000000000001';
set local role authenticated;
select preference_test.reject($q$select public.set_notification_preference('new_tides',false)$q$);
set local role anon;
select preference_test.reject('select public.get_notification_preferences()');
select preference_test.reject($q$select public.set_notification_preference('new_tides',false)$q$);
rollback;
