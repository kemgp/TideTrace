-- Energy flags and reversals: who can flag, one open flag per award, admin dismiss and reverse,
-- who is told what, audit rows, and the admin views. Run after all migrations. Fixtures are rolled back.
begin;
create schema flag_test;
grant usage on schema flag_test to anon,authenticated;
create function flag_test.check(ok boolean,label text default 'assertion') returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Energy flag check failed: %',label; end if; end $$;
create function flag_test.denied(statement text,code text default '42501') returns void language plpgsql as $$
begin
 begin execute statement;
 exception when others then
  if sqlstate=code then return; end if;
  raise;
 end;
 raise exception 'Unexpectedly allowed: %',statement;
end $$;
-- Ledger id of the award for a source, read past RLS.
create function flag_test.award(source uuid) returns uuid language sql security definer as $$
 select id from public.energy_ledger where source_id=source and award_type<>'reversal'
$$;
grant execute on all functions in schema flag_test to anon,authenticated;

insert into auth.users(id,email,raw_user_meta_data) values
 ('f6000000-0000-4000-8000-000000000001','flag-a@example.invalid','{"display_name":"Ana"}'),
 ('f6000000-0000-4000-8000-000000000002','flag-b@example.invalid','{}'),
 ('f6000000-0000-4000-8000-000000000003','flag-mod-one@example.invalid','{}'),
 ('f6000000-0000-4000-8000-000000000004','flag-mod-two@example.invalid','{}'),
 ('f6000000-0000-4000-8000-000000000005','flag-admin@example.invalid','{}'),
 ('f6000000-0000-4000-8000-000000000006','flag-admin-two@example.invalid','{}');
update public.profiles set role='moderator' where id in ('f6000000-0000-4000-8000-000000000003','f6000000-0000-4000-8000-000000000004');
update public.profiles set role='admin' where id in ('f6000000-0000-4000-8000-000000000005','f6000000-0000-4000-8000-000000000006');
update public.profiles set display_name='Ana' where id='f6000000-0000-4000-8000-000000000001';
insert into public.traces(id,author_id,category_id,title,description,location_name,status,submitted_at)
 select ('f7000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,author::uuid,
 (select id from public.categories where name='Pollution'),'Flag fixture '||n,'Observation','Coast','pending',now()
 from (values (1,'f6000000-0000-4000-8000-000000000001'),(2,'f6000000-0000-4000-8000-000000000001'),
  (3,'f6000000-0000-4000-8000-000000000003'),(4,'f6000000-0000-4000-8000-000000000005')) as t(n,author);
insert into public.tides(id,author_id,title,slug,body,status) values
 ('f8000000-0000-4000-8000-000000000001','f6000000-0000-4000-8000-000000000005','Estuaries','flag-estuaries','Text','published');

set local role authenticated;
select set_config('request.jwt.claim.sub','f6000000-0000-4000-8000-000000000005',true);
select public.set_energy_active(true);
select public.moderate_trace('f7000000-0000-4000-8000-000000000003',1,'approved');
select set_config('request.jwt.claim.sub','f6000000-0000-4000-8000-000000000003',true);
select public.moderate_trace('f7000000-0000-4000-8000-000000000001',1,'approved');
select public.moderate_trace('f7000000-0000-4000-8000-000000000002',1,'approved');
select public.moderate_trace('f7000000-0000-4000-8000-000000000004',1,'approved');
select set_config('request.jwt.claim.sub','f6000000-0000-4000-8000-000000000001',true);
select public.complete_tide('f8000000-0000-4000-8000-000000000001');

-- 1. Staff see award status for the Traces they are looking at, with the member's name.
select flag_test.denied($$select public.staff_energy_awards(array['f7000000-0000-4000-8000-000000000001'::uuid])$$);
select set_config('request.jwt.claim.sub','f6000000-0000-4000-8000-000000000004',true);
select flag_test.check((select jsonb_array_length(r->'awards')=3 and (r->>'active')::boolean
 and exists (select 1 from jsonb_array_elements(r->'awards') a where a->>'owner_name'='Ana' and (a->>'amount')::int=20 and a->>'open_flag'='false')
 from (select public.staff_energy_awards(array['f7000000-0000-4000-8000-000000000001','f7000000-0000-4000-8000-000000000002','f7000000-0000-4000-8000-000000000003']::uuid[]) r) s),'Award status for staff');
select flag_test.check((select jsonb_array_length(r->'awards')=0 from (select public.staff_energy_awards('{}'::uuid[]) r) s),'Empty list');
select flag_test.denied($$select public.staff_energy_awards((select array_agg(gen_random_uuid()) from generate_series(1,101)))$$,'22023');

-- 2. Flag rules.
select set_config('request.jwt.claim.sub','f6000000-0000-4000-8000-000000000001',true);
select flag_test.denied($$select public.flag_energy_award(flag_test.award('f7000000-0000-4000-8000-000000000001'),'Looks copied')$$);
select set_config('request.jwt.claim.sub','f6000000-0000-4000-8000-000000000003',true);
select flag_test.denied($$select public.flag_energy_award(flag_test.award('f7000000-0000-4000-8000-000000000003'),'Mine')$$);
select flag_test.denied($$select public.flag_energy_award(flag_test.award('f7000000-0000-4000-8000-000000000001'),'  ')$$,'22023');
select flag_test.denied($$select public.flag_energy_award(flag_test.award('f8000000-0000-4000-8000-000000000001'),'Lesson')$$,'22023');
select flag_test.denied($$select public.flag_energy_award(gen_random_uuid(),'Missing')$$,'P0002');
select set_config('request.jwt.claim.sub','f6000000-0000-4000-8000-000000000004',true);
select flag_test.check((public.flag_energy_award(flag_test.award('f7000000-0000-4000-8000-000000000001'),' Same photo as an older Trace ')).reason='Same photo as an older Trace','Flag raised');
select set_config('request.jwt.claim.sub','f6000000-0000-4000-8000-000000000003',true);
select flag_test.denied($$select public.flag_energy_award(flag_test.award('f7000000-0000-4000-8000-000000000001'),'Again')$$,'23505');
select flag_test.denied($$insert into public.energy_flags(ledger_id,flagged_by,reason) values(flag_test.award('f7000000-0000-4000-8000-000000000002'),auth.uid(),'Direct')$$);
reset role;
select flag_test.check((select count(*)=2 from public.notifications where type='energy_flag' and message='New energy flag to review: "Flag fixture 1".'
 and recipient_id in ('f6000000-0000-4000-8000-000000000005','f6000000-0000-4000-8000-000000000006')),'Both admins told');
select flag_test.check((select count(*)=0 from public.notifications where type like 'energy%' and recipient_id='f6000000-0000-4000-8000-000000000001'),'Member not told about a flag');
set local role authenticated;

-- 3. Who reads flags.
select flag_test.check((select count(*)=0 from public.energy_flags),'Other moderator sees no flags');
select set_config('request.jwt.claim.sub','f6000000-0000-4000-8000-000000000004',true);
select flag_test.check((select count(*)=1 from public.energy_flags),'Flagger sees own flag');
select flag_test.check((select jsonb_array_length(r)=1 and r->0->>'status'='open' and r->0->>'owner_name'='Ana' and r->0->>'title'='Flag fixture 1'
 from (select public.staff_my_energy_flags() r) s),'My flags');
select flag_test.check((select (a->>'open_flag')::boolean and jsonb_array_length(a->'my_flags')=1
 from (select public.staff_energy_awards(array['f7000000-0000-4000-8000-000000000001'::uuid])->'awards'->0 a) s),'Award shows open flag');
select set_config('request.jwt.claim.sub','f6000000-0000-4000-8000-000000000001',true);
select flag_test.check((select count(*)=0 from public.energy_flags),'Member sees no flags');
select flag_test.denied($$select public.staff_my_energy_flags()$$);
select set_config('request.jwt.claim.sub','f6000000-0000-4000-8000-000000000005',true);
select flag_test.check((select count(*)=1 from public.energy_flags),'Admin sees all flags');
select flag_test.check((public.get_dashboard_summary()->>'open_energy_flags')::int=1,'Dashboard counts the open flag');

-- 4. Dismiss: admin only, reason required, only the flagger is told, audited.
select set_config('request.jwt.claim.sub','f6000000-0000-4000-8000-000000000004',true);
select flag_test.denied($$select public.dismiss_energy_flag((select id from public.energy_flags limit 1),'No')$$);
select set_config('request.jwt.claim.sub','f6000000-0000-4000-8000-000000000005',true);
select flag_test.denied($$select public.dismiss_energy_flag((select id from public.energy_flags limit 1),'')$$,'22023');
select flag_test.denied($$select public.dismiss_energy_flag(gen_random_uuid(),'Missing')$$,'P0002');
select flag_test.check((public.dismiss_energy_flag((select id from public.energy_flags limit 1),'Different angle, same spot')).status='dismissed','Dismissed');
select flag_test.denied($$select public.dismiss_energy_flag((select id from public.energy_flags limit 1),'Again')$$,'22023');
reset role;
select flag_test.check((select count(*)=1 from public.notifications where type='energy_flag_outcome' and recipient_id='f6000000-0000-4000-8000-000000000004'
 and message='Your flag on "Flag fixture 1" was reviewed: dismissed. Reason: Different angle, same spot'),'Flagger told');
select flag_test.check((select count(*)=0 from public.notifications where type like 'energy%' and recipient_id='f6000000-0000-4000-8000-000000000001'),'Member not told about a dismissal');
select flag_test.check((select count(*)=1 from public.admin_audit_logs where action='dismiss_energy_flag' and target_user_id='f6000000-0000-4000-8000-000000000001'),'Dismissal audited');
set local role authenticated;

-- 5. After a dismissal the award can be flagged again.
select set_config('request.jwt.claim.sub','f6000000-0000-4000-8000-000000000004',true);
select public.flag_energy_award(flag_test.award('f7000000-0000-4000-8000-000000000001'),'New evidence');
select set_config('request.jwt.claim.sub','f6000000-0000-4000-8000-000000000003',true);
select public.flag_energy_award(flag_test.award('f7000000-0000-4000-8000-000000000002'),'Second look');

-- 6. Reverse: admin only, not your own, once, final. Open flags are upheld.
select flag_test.denied($$select public.reverse_energy_award(flag_test.award('f7000000-0000-4000-8000-000000000001'),'No')$$);
select set_config('request.jwt.claim.sub','f6000000-0000-4000-8000-000000000005',true);
select flag_test.denied($$select public.reverse_energy_award(flag_test.award('f7000000-0000-4000-8000-000000000004'),'Mine')$$);
select flag_test.denied($$select public.reverse_energy_award(flag_test.award('f7000000-0000-4000-8000-000000000001'),' ')$$,'22023');
select flag_test.denied($$select public.reverse_energy_award(gen_random_uuid(),'Missing')$$,'P0002');
select flag_test.check((select r.amount=-20 and r.award_type='reversal' and r.reason='Duplicate photo' and r.created_by='f6000000-0000-4000-8000-000000000005'
 from public.reverse_energy_award(flag_test.award('f7000000-0000-4000-8000-000000000001'),'Duplicate photo') r),'Reversed');
select flag_test.denied($$select public.reverse_energy_award(flag_test.award('f7000000-0000-4000-8000-000000000001'),'Twice')$$,'22023');
select flag_test.denied($$select public.reverse_energy_award((select id from public.energy_ledger where award_type='reversal'),'Undo')$$,'22023');
select set_config('request.jwt.claim.sub','f6000000-0000-4000-8000-000000000004',true);
select flag_test.denied($$select public.flag_energy_award(flag_test.award('f7000000-0000-4000-8000-000000000001'),'Late')$$,'22023');
select flag_test.check((select jsonb_array_length(r)=2 and r @> '[{"status":"upheld","resolution_reason":"Duplicate photo"}]' and r @> '[{"status":"dismissed"}]'
 from (select public.staff_my_energy_flags() r) s),'Flag upheld');
-- Lesson and quiz awards can be reversed too.
select set_config('request.jwt.claim.sub','f6000000-0000-4000-8000-000000000006',true);
select public.reverse_energy_award(flag_test.award('f8000000-0000-4000-8000-000000000001'),'Opened and closed in two seconds');
reset role;
select flag_test.check((select count(*)=1 from public.notifications where type='energy_reversal' and recipient_id='f6000000-0000-4000-8000-000000000001'
 and message='An admin reversed 20 Tide Energy for your Trace "Flag fixture 1". Reason: Duplicate photo'),'Member told about the Trace reversal');
select flag_test.check((select count(*)=1 from public.notifications where type='energy_reversal'
 and message='An admin reversed 5 Tide Energy for completing "Estuaries". Reason: Opened and closed in two seconds'),'Member told about the lesson reversal');
select flag_test.check((select count(*)=1 from public.notifications where type='energy_flag_outcome' and recipient_id='f6000000-0000-4000-8000-000000000004'
 and message='Your flag on "Flag fixture 1" was reviewed: award reversed. Reason: Duplicate photo'),'Flagger told about the reversal');
select flag_test.check((select count(*)=0 from public.notifications where type='energy_flag_outcome' and recipient_id='f6000000-0000-4000-8000-000000000003'),'Unrelated flagger not told');
select flag_test.check((select count(*)=2 from public.admin_audit_logs where action='reverse_energy_award'),'Reversals audited');
-- One reversal per entry, enforced by the table as well.
select flag_test.denied($$insert into public.energy_ledger(owner_id,award_type,source_id,amount,reverses_id,reason)
 values('f6000000-0000-4000-8000-000000000001','reversal',gen_random_uuid(),-20,flag_test.award('f7000000-0000-4000-8000-000000000001'),'Twice')$$,'23505');
set local role authenticated;

-- 7. The member's history: the original stays and is marked, the reversal is listed under the same kind.
select set_config('request.jwt.claim.sub','f6000000-0000-4000-8000-000000000001',true);
select flag_test.check((select (r->>'balance')::int=20 and jsonb_array_length(r->'items')=5 from (select public.get_my_energy() r) s),'Balance after reversals');
select flag_test.check((select jsonb_array_length(r->'items')=3
 and exists (select 1 from jsonb_array_elements(r->'items') i where i->>'award_type'='reversal' and i->>'title'='Flag fixture 1' and i->>'reason'='Duplicate photo')
 and exists (select 1 from jsonb_array_elements(r->'items') i where i->>'award_type'='trace_approval' and (i->>'reversed')::boolean)
 from (select public.get_my_energy(20,0,'trace') r) s),'Trace history with reversal');

-- 8. Admin views.
select flag_test.denied($$select public.admin_energy_activity()$$);
select flag_test.denied($$select public.admin_energy_award(flag_test.award('f7000000-0000-4000-8000-000000000001'))$$);
select set_config('request.jwt.claim.sub','f6000000-0000-4000-8000-000000000003',true);
select flag_test.denied($$select public.admin_energy_activity()$$);
select set_config('request.jwt.claim.sub','f6000000-0000-4000-8000-000000000005',true);
select flag_test.check((select (r->'totals'->>'open_flags')::int=1 and (r->'totals'->>'reversals')::int=2 and (r->'totals'->>'awards')::int=5
 and (r->'totals'->>'energy_issued')::int=85 and jsonb_array_length(r->'open_flags')=1 and r->'open_flags'->0->>'title'='Flag fixture 2'
 and jsonb_array_length(r->'awards')=5
 from (select public.admin_energy_activity() r) s),'Activity totals');
select flag_test.check((select jsonb_array_length(r->'awards')=1 from (select public.admin_energy_activity(20,0,'tide') r) s),'Activity filter');
select flag_test.denied($$select public.admin_energy_activity(20,0,'nope')$$,'22023');
select flag_test.check((select (r->>'reversed')::boolean and r->'reversal'->>'reason'='Duplicate photo' and jsonb_array_length(r->'flags')=2
 and jsonb_array_length(r->'audit')=2 and r->>'owner_name'='Ana'
 from (select public.admin_energy_award(flag_test.award('f7000000-0000-4000-8000-000000000001')) r) s),'Award detail');
select flag_test.denied($$select public.admin_energy_award(gen_random_uuid())$$,'P0002');

-- 9. Signed out.
reset role;
set local role anon;
select flag_test.denied($$select public.flag_energy_award(gen_random_uuid(),'x')$$);
select flag_test.denied($$select * from public.energy_flags$$);
rollback;
