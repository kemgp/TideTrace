-- Run on a local/test database after all migrations. Fixtures are rolled back.
begin;
create schema mod_test;
grant usage on schema mod_test to anon,authenticated;
create function mod_test.check(ok boolean,label text default 'assertion') returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Moderator workflow check failed: %',label; end if; end $$;
create function mod_test.denied(statement text,code text default '42501') returns void language plpgsql as $$
begin
 begin execute statement;
 exception when others then
  if sqlstate=code then return; end if;
  raise;
 end;
 raise exception 'Unexpectedly allowed: %',statement;
end $$;

insert into auth.users(id,email,raw_user_meta_data) values
 ('e1000000-0000-4000-8000-000000000001','mw-author@example.invalid','{}'),
 ('e1000000-0000-4000-8000-000000000002','mw-reporter-a@example.invalid','{}'),
 ('e1000000-0000-4000-8000-000000000003','mw-reporter-b@example.invalid','{}'),
 ('e1000000-0000-4000-8000-000000000004','mw-moderator@example.invalid','{}'),
 ('e1000000-0000-4000-8000-000000000005','mw-moderator-two@example.invalid','{}'),
 ('e1000000-0000-4000-8000-000000000006','mw-admin@example.invalid','{}');
update public.profiles set role='moderator' where id in ('e1000000-0000-4000-8000-000000000004','e1000000-0000-4000-8000-000000000005');
update public.profiles set role='admin' where id='e1000000-0000-4000-8000-000000000006';
insert into public.traces(id,author_id,category_id,title,description,location_name,status,submitted_at)
 select ('e2000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'e1000000-0000-4000-8000-000000000001',
 (select id from public.categories where name='Pollution'),'Workflow fixture '||n,'Observation','Coast',status::public.trace_state,now()
 from (values (1,'pending'),(2,'pending'),(3,'approved'),(4,'pending')) as t(n,status);
insert into public.comments(id,trace_id,author_id,body) values
 ('e3000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000003','e1000000-0000-4000-8000-000000000002','Flagged comment');

-- A new report tells active staff (not the reporter).
select set_config('mw.staff_before',(select count(*)::text from public.notifications where type='staff_report'),true);
insert into public.reports(id,reporter_id,trace_id,reason) values
 ('e4000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000002','e2000000-0000-4000-8000-000000000003','Report one'),
 ('e4000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000003','e2000000-0000-4000-8000-000000000003','Report two');
insert into public.reports(id,reporter_id,comment_id,reason) values
 ('e4000000-0000-4000-8000-000000000003','e1000000-0000-4000-8000-000000000003','e3000000-0000-4000-8000-000000000001','Comment report');
select mod_test.check((select count(*) from public.notifications where type='staff_report')-current_setting('mw.staff_before')::int=9,'Three reports notify three staff members each');
select mod_test.check((select count(*)=0 from public.notifications where type='staff_report' and recipient_id in ('e1000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000003')),'Reporters are not notified as staff');

set local role authenticated;
-- Hold for an admin.
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000002',true);
select mod_test.denied($$select public.hold_trace('e2000000-0000-4000-8000-000000000001',1,'Not sure')$$);
select mod_test.check((select count(*)=0 from public.trace_holds),'Members cannot read holds');
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000004',true);
select mod_test.denied($$select public.hold_trace('e2000000-0000-4000-8000-000000000001',1,'   ')$$,'P0001');
select mod_test.denied($$select public.hold_trace('e2000000-0000-4000-8000-000000000001',9,'Not sure')$$,'40001');
select public.hold_trace('e2000000-0000-4000-8000-000000000001',1,'Not sure about the location');
select mod_test.check((select count(*)=1 from public.trace_holds where trace_id='e2000000-0000-4000-8000-000000000001'),'Staff can read the hold');
select mod_test.check((select version=2 and status='pending' from public.traces where id='e2000000-0000-4000-8000-000000000001'),'Hold keeps the trace pending and bumps its version');
select mod_test.denied($$select public.hold_trace('e2000000-0000-4000-8000-000000000001',2,'Again')$$,'P0001');
select mod_test.denied($$select public.moderate_trace('e2000000-0000-4000-8000-000000000001',2,'approved')$$);
select mod_test.denied($$select public.release_trace_hold('e2000000-0000-4000-8000-000000000001')$$);
select mod_test.check((select count(*)=1 from public.moderation_actions where trace_id='e2000000-0000-4000-8000-000000000001' and action='hold_trace' and to_state='on_hold'),'Hold is recorded in history');
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000006',true);
select public.moderate_trace('e2000000-0000-4000-8000-000000000001',2,'approved');
select mod_test.check((select count(*)=0 from public.trace_holds where trace_id='e2000000-0000-4000-8000-000000000001'),'An admin decision clears the hold');
select public.moderate_trace('e2000000-0000-4000-8000-000000000004',1,'approved');
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000004',true);
select public.hold_trace('e2000000-0000-4000-8000-000000000002',1,'Second hold');
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000006',true);
select public.release_trace_hold('e2000000-0000-4000-8000-000000000002');
select mod_test.check((select count(*)=0 from public.trace_holds),'Admin can release a hold');
select mod_test.denied($$select public.release_trace_hold('e2000000-0000-4000-8000-000000000002')$$,'P0001');
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000004',true);
select public.moderate_trace('e2000000-0000-4000-8000-000000000002',3,'approved');

-- Grouped report decisions.
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000002',true);
select mod_test.denied($$select public.resolve_reports(array['e4000000-0000-4000-8000-000000000001']::uuid[],false,'No')$$);
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000004',true);
select mod_test.denied($$select public.resolve_reports(array['e4000000-0000-4000-8000-000000000001']::uuid[],true,'  ')$$,'P0001');
select mod_test.denied($$select public.resolve_reports(array[]::uuid[],true,'Reason')$$,'P0001');
select mod_test.denied($$select public.resolve_reports(array['e4000000-0000-4000-8000-000000000001','e4000000-0000-4000-8000-0000000000ff']::uuid[],true,'Reason')$$,'P0001');
select mod_test.check((select status='open' from public.reports where id='e4000000-0000-4000-8000-000000000001'),'A failed group changes nothing');
select mod_test.check(public.resolve_reports(array['e4000000-0000-4000-8000-000000000001','e4000000-0000-4000-8000-000000000002']::uuid[],true,'Violates the guidelines')=2,'Two reports resolved');
select mod_test.check((select count(*)=2 from public.reports where trace_id='e2000000-0000-4000-8000-000000000003' and status='resolved' and resolved_by=auth.uid()),'Both reports are resolved');
select mod_test.check((select is_hidden from public.traces where id='e2000000-0000-4000-8000-000000000003'),'Content is hidden');
select mod_test.denied($$select public.resolve_reports(array['e4000000-0000-4000-8000-000000000001']::uuid[],false,'Again')$$,'P0001');
select mod_test.check(public.resolve_reports(array['e4000000-0000-4000-8000-000000000003']::uuid[],false,'Comment is fine')=1,'Dismissal works');
select mod_test.check((select status='visible' from public.comments where id='e3000000-0000-4000-8000-000000000001'),'Dismissal keeps the comment');
reset role;
select mod_test.check((select count(*)=1 from public.notifications where type='content_hidden' and recipient_id='e1000000-0000-4000-8000-000000000001'),'The author is told once');
select mod_test.check((select count(*)=2 from public.notifications where type='report_review' and recipient_id='e1000000-0000-4000-8000-000000000003'),'Each reporter is told');
set local role authenticated;

-- Author summary.
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000004',true);
select mod_test.check((public.staff_author_summary('e1000000-0000-4000-8000-000000000001')->>'reports_against')::int=2,'Reports against the author');
select mod_test.check((public.staff_author_summary('e1000000-0000-4000-8000-000000000001')->>'approved')::int>=2,'Approved traces counted');
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000002',true);
select mod_test.denied($$select public.staff_author_summary('e1000000-0000-4000-8000-000000000001')$$);

-- Saved reasons are private to their owner.
select mod_test.denied($$insert into public.moderator_reason_templates(kind,body) values('review','Nope')$$);
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000004',true);
insert into public.moderator_reason_templates(kind,body) values('review','Please blur the pin.');
select mod_test.denied($$insert into public.moderator_reason_templates(kind,body) values('other','Bad kind')$$,'23514');
select mod_test.check((select count(*)=1 from public.moderator_reason_templates),'Owner sees their reason');
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000005',true);
select mod_test.check((select count(*)=0 from public.moderator_reason_templates),'Another moderator cannot see it');
delete from public.moderator_reason_templates;
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000004',true);
select mod_test.check((select count(*)=1 from public.moderator_reason_templates),'Another moderator cannot delete it');
delete from public.moderator_reason_templates;
select mod_test.check((select count(*)=0 from public.moderator_reason_templates),'Owner can delete it');
rollback;
