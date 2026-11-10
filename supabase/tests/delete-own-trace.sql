-- Run on a local/test database after all migrations. Fixtures are rolled back.
begin;
create schema delete_trace_test;
grant usage on schema delete_trace_test to anon,authenticated;
create function delete_trace_test.check(ok boolean) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Trace deletion assertion failed'; end if; end $$;
create function delete_trace_test.denied(statement text,code text default 'PT404') returns void language plpgsql as $$
begin
 begin execute statement;
 exception when others then
  if sqlstate=code then return; end if;
  raise;
 end;
 raise exception 'Unexpectedly allowed: %',statement;
end $$;

insert into auth.users(id,email,raw_user_meta_data) values
 ('d1000000-0000-4000-8000-000000000001','delete-owner@example.invalid','{}'),
 ('d1000000-0000-4000-8000-000000000002','delete-other@example.invalid','{}'),
 ('d1000000-0000-4000-8000-000000000003','delete-staff@example.invalid','{}');
update public.profiles set role='moderator' where id='d1000000-0000-4000-8000-000000000003';
insert into public.traces(id,author_id,category_id,title,description,location_name,status,published_at)
 select ('d2000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'d1000000-0000-4000-8000-000000000001',
 (select id from public.categories limit 1),'Deletion fixture coast','Observation','Coast',status::public.trace_state,now()
 from (values (1,'draft'),(2,'pending'),(3,'revision_requested'),(4,'rejected'),(5,'approved')) as statuses(n,status);
update public.traces set is_hidden=true where id='d2000000-0000-4000-8000-000000000004';
insert into storage.objects(bucket_id,name,owner_id,metadata) values
 ('trace-media','d1000000-0000-4000-8000-000000000001/d2000000-0000-4000-8000-000000000005/attached.jpg','d1000000-0000-4000-8000-000000000001','{"mimetype":"image/jpeg","size":100}'),
 ('trace-media','d1000000-0000-4000-8000-000000000001/d2000000-0000-4000-8000-000000000005/detached.jpg','d1000000-0000-4000-8000-000000000001','{"mimetype":"image/jpeg","size":100}');
insert into public.trace_media(trace_id,object_path,mime_type,size_bytes)
 values('d2000000-0000-4000-8000-000000000005','d1000000-0000-4000-8000-000000000001/d2000000-0000-4000-8000-000000000005/attached.jpg','image/jpeg',100);
insert into public.comments(id,trace_id,author_id,body) values
 ('d3000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000005','d1000000-0000-4000-8000-000000000002','Comment on deleted trace');
insert into public.reports(id,reporter_id,trace_id,comment_id,reason,status,resolution_reason) values
 ('d4000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000005',null,'Trace report','open',null),
 ('d4000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000002',null,'d3000000-0000-4000-8000-000000000001','Comment report','open',null),
 ('d4000000-0000-4000-8000-000000000003','d1000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000005',null,'Old report','dismissed','Already reviewed');
insert into public.moderation_actions(actor_id,trace_id,action,reason,from_state,to_state) values
 ('d1000000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000005','review_trace','','pending','approved');
select set_config('delete_test.notifications',(select count(*)::text from public.notifications),true);

set local role authenticated;
select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000002',true);
select delete_trace_test.denied($$select public.delete_own_trace('d2000000-0000-4000-8000-000000000005')$$);
select delete_trace_test.denied($$select public.delete_own_trace('d2000000-0000-4000-8000-000000000099')$$);
select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000001',true);
select delete_trace_test.check((public.get_dashboard_summary()->>'traces')::int=4);
select delete_trace_test.check((public.get_dashboard_summary()->>'removed')::int=1);
select delete_trace_test.check((public.get_dashboard_summary()->>'active_traces')::int=4);
select delete_trace_test.check((public.get_dashboard_summary()->>'approved')::int=1);
select delete_trace_test.check((select count(*)=1 from public.search_public_traces('Deletion fixture coast')));
select delete_trace_test.check(not private.can_delete_trace_media('d1000000-0000-4000-8000-000000000001/d2000000-0000-4000-8000-000000000005/attached.jpg'));
select delete_trace_test.denied($$select public.deleted_trace_media('d2000000-0000-4000-8000-000000000005')$$);
select public.delete_own_trace('d2000000-0000-4000-8000-000000000001');
select public.delete_own_trace('d2000000-0000-4000-8000-000000000002');
select public.delete_own_trace('d2000000-0000-4000-8000-000000000003');
select public.delete_own_trace('d2000000-0000-4000-8000-000000000004');
select delete_trace_test.check((select count(*)=2 from public.delete_own_trace('d2000000-0000-4000-8000-000000000005')));
select delete_trace_test.denied($$select public.delete_own_trace('d2000000-0000-4000-8000-000000000005')$$);
select delete_trace_test.check((select count(*)=0 from public.traces where author_id=auth.uid()));
select delete_trace_test.check((select count(*)=0 from public.search_public_traces('Deletion fixture coast')));
select delete_trace_test.check((public.get_dashboard_summary()->>'traces')::int=0);
select delete_trace_test.check((public.get_dashboard_summary()->>'approved')::int=0);
select delete_trace_test.check((public.get_dashboard_summary()->>'pending')::int=0);
select delete_trace_test.check((public.get_dashboard_summary()->>'drafts')::int=0);
select delete_trace_test.check((public.get_dashboard_summary()->>'needs_revision')::int=0);
select delete_trace_test.check((select count(*)=0 from public.comments where id='d3000000-0000-4000-8000-000000000001'));
select delete_trace_test.check((select count(*)=0 from public.trace_media where trace_id='d2000000-0000-4000-8000-000000000005'));
select delete_trace_test.denied($$select public.get_trace_private_location('d2000000-0000-4000-8000-000000000005')$$,'42501');
select delete_trace_test.check((select count(*)=2 from public.deleted_trace_media('d2000000-0000-4000-8000-000000000005')));
select delete_trace_test.check(private.can_delete_trace_media('d1000000-0000-4000-8000-000000000001/d2000000-0000-4000-8000-000000000005/attached.jpg'));

select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000002',true);
select delete_trace_test.denied($$select public.deleted_trace_media('d2000000-0000-4000-8000-000000000005')$$);
select delete_trace_test.check(not private.can_delete_trace_media('d1000000-0000-4000-8000-000000000001/d2000000-0000-4000-8000-000000000005/attached.jpg'));
select delete_trace_test.check((select count(*)=0 from public.comments where author_id=auth.uid()));
select delete_trace_test.check((select count(*)=0 from storage.objects where bucket_id='trace-media' and name like 'd1000000-%'));

select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000003',true);
select delete_trace_test.check((select count(*)=5 from public.traces where author_id='d1000000-0000-4000-8000-000000000001' and deleted_at is not null and version=2));
select delete_trace_test.check((select status='hidden' from public.comments where id='d3000000-0000-4000-8000-000000000001'));
select delete_trace_test.check((select count(*)=2 from public.reports where reporter_id='d1000000-0000-4000-8000-000000000002' and status='resolved' and resolution_reason='trace deleted' and resolved_at is not null and resolved_by is null));
select delete_trace_test.check((select status='dismissed' and resolution_reason='Already reviewed' from public.reports where id='d4000000-0000-4000-8000-000000000003'));
select delete_trace_test.check((select count(*)=1 from public.moderation_actions where trace_id='d2000000-0000-4000-8000-000000000005'));
-- Pending is unchanged by soft deletion; the existing decision RPC must still refuse it.
select delete_trace_test.denied($$select public.moderate_trace('d2000000-0000-4000-8000-000000000002',2,'approved')$$,'P0001');

set local role anon;
select set_config('request.jwt.claim.sub','',true);
select delete_trace_test.check((select count(*)=0 from public.traces where title='Deletion fixture coast'));
select delete_trace_test.check((select count(*)=0 from public.search_public_traces('Deletion fixture coast')));
select delete_trace_test.check((select count(*)=0 from public.comments where id='d3000000-0000-4000-8000-000000000001'));
select delete_trace_test.denied($$select public.delete_own_trace('d2000000-0000-4000-8000-000000000005')$$,'42501');
reset role;
select delete_trace_test.check((select count(*) from public.notifications)=current_setting('delete_test.notifications')::int);
select delete_trace_test.check((select count(*)=5 from public.traces where author_id='d1000000-0000-4000-8000-000000000001'));
update public.profiles set status='suspended' where id='d1000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000001',true);
select delete_trace_test.denied($$select public.delete_own_trace('d2000000-0000-4000-8000-000000000005')$$,'42501');
select delete_trace_test.denied($$select public.deleted_trace_media('d2000000-0000-4000-8000-000000000005')$$,'42501');
reset role;
rollback;
