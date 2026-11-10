-- Tide Energy: activation, awards on approval and completion, the activation boundary, and access.
-- Run on a local/test database after all migrations. Fixtures are rolled back.
begin;
create schema energy_test;
grant usage on schema energy_test to anon,authenticated;
create function energy_test.check(ok boolean,label text default 'assertion') returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Tide Energy check failed: %',label; end if; end $$;
create function energy_test.denied(statement text,code text default '42501') returns void language plpgsql as $$
begin
 begin execute statement;
 exception when others then
  if sqlstate=code then return; end if;
  raise;
 end;
 raise exception 'Unexpectedly allowed: %',statement;
end $$;
grant execute on all functions in schema energy_test to anon,authenticated;

insert into auth.users(id,email,raw_user_meta_data) values
 ('f1000000-0000-4000-8000-000000000001','energy-a@example.invalid','{}'),
 ('f1000000-0000-4000-8000-000000000002','energy-b@example.invalid','{}'),
 ('f1000000-0000-4000-8000-000000000003','energy-mod@example.invalid','{}'),
 ('f1000000-0000-4000-8000-000000000004','energy-admin@example.invalid','{}'),
 ('f1000000-0000-4000-8000-000000000005','energy-c@example.invalid','{}');
update public.profiles set role='moderator' where id='f1000000-0000-4000-8000-000000000003';
update public.profiles set role='admin' where id='f1000000-0000-4000-8000-000000000004';
insert into public.traces(id,author_id,category_id,title,description,location_name,status,submitted_at)
 select ('f2000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,author::uuid,
 (select id from public.categories where name='Pollution'),'Energy fixture '||n,'Observation','Coast','pending',now()
 from (values (1,'f1000000-0000-4000-8000-000000000001'),(2,'f1000000-0000-4000-8000-000000000001'),
  (3,'f1000000-0000-4000-8000-000000000001'),(4,'f1000000-0000-4000-8000-000000000005'),
  (5,'f1000000-0000-4000-8000-000000000001')) as t(n,author);
insert into public.tides(id,author_id,title,slug,body,status) values
 ('f3000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000004','Mangroves','energy-mangroves','Text','published'),
 ('f3000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000004','Seagrass','energy-seagrass','Text','published'),
 ('f3000000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000004','Draft lesson','energy-draft','Text','draft');

set local role authenticated;

-- 1. Off by default: nothing is awarded and the approval message is unchanged.
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000001',true);
select energy_test.check((public.get_energy_status()->>'active')::boolean=false,'Energy starts inactive');
select energy_test.check((public.complete_tide('f3000000-0000-4000-8000-000000000001')->>'awarded')::boolean=false,'No award while inactive');
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000003',true);
select public.moderate_trace('f2000000-0000-4000-8000-000000000001',1,'approved');
reset role;
select energy_test.check((select message='Your Trace "Energy fixture 1": approved.' from public.notifications
 where recipient_id='f1000000-0000-4000-8000-000000000001' and type='trace_review'),'Approval message unchanged while inactive');
select energy_test.check((select count(*)=0 from public.energy_ledger),'Ledger empty while inactive');
set local role authenticated;

-- 2. Only admins activate, and only from the current time.
select energy_test.denied($$select public.set_energy_active(true)$$);
select energy_test.denied($$select public.get_energy_settings()$$);
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000001',true);
select energy_test.denied($$select public.set_energy_active(true)$$);
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000004',true);
select energy_test.denied($$insert into public.settings(key,value) values('energy',jsonb_build_object('activated_at',now()-interval '1 day'))$$,'22023');
select energy_test.denied($$insert into public.settings(key,value) values('energy',jsonb_build_object('activated_at',now()+interval '1 day'))$$,'22023');
select energy_test.denied($$insert into public.settings(key,value) values('energy','{"activated_at":"soon"}')$$,'22023');
select energy_test.denied($$insert into public.settings(key,value) values('energy','{"activated_at":null,"extra":1}')$$,'22023');
select energy_test.denied($$insert into public.settings(key,value) values('energy','true')$$,'22023');
select energy_test.denied($$select public.set_energy_active(null)$$,'22023');
select energy_test.check((public.set_energy_active(true)->>'active')::boolean,'Admin activates');
select energy_test.check((public.set_energy_active(true)->>'active')::boolean,'Activating again is a no-op');
select energy_test.check((select count(*)=1 from public.admin_audit_logs where action='update_energy_settings'),'Activation is audited once');

-- 3. Approval awards 20 in the same transaction and says so in the existing notification.
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000003',true);
select public.moderate_trace('f2000000-0000-4000-8000-000000000002',1,'approved','Clear photo');
select public.moderate_trace('f2000000-0000-4000-8000-000000000003',1,'rejected','Blurry');
reset role;
select energy_test.check((select message='Your Trace "Energy fixture 2": approved. You earned 20 Tide Energy. Clear photo' from public.notifications
 where recipient_id='f1000000-0000-4000-8000-000000000001' and type='trace_review' and message like '%fixture 2%'),'Approval message includes the award and the feedback');
select energy_test.check((select message='Your Trace "Energy fixture 3": rejected. Blurry' from public.notifications
 where type='trace_review' and message like '%fixture 3%'),'Rejection message unchanged');
-- A suspended author gets the decision but no award.
update public.profiles set status='suspended' where id='f1000000-0000-4000-8000-000000000005';
set local role authenticated;
select public.moderate_trace('f2000000-0000-4000-8000-000000000004',1,'approved');
reset role;
select energy_test.check((select count(*)=1 and min(amount)=20 and min(source_id::text)='f2000000-0000-4000-8000-000000000002'
 from public.energy_ledger where award_type='trace_approval'),'One Trace award, for the Trace approved after activation');
-- The unique key makes a second award for the same source a no-op.
select energy_test.check((private.issue_award('f1000000-0000-4000-8000-000000000001','trace_approval','f2000000-0000-4000-8000-000000000002')).id is null,'Second award for the same Trace is ignored');
select energy_test.denied($$select private.issue_award('f1000000-0000-4000-8000-000000000001','reversal','f2000000-0000-4000-8000-000000000002')$$,'22023');
set local role authenticated;

-- 4. Completion goes through complete_tide. Completions from before activation are not backfilled.
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000001',true);
select energy_test.check((public.complete_tide('f3000000-0000-4000-8000-000000000001')->>'awarded')::boolean=false,'Earlier completion is not backfilled');
select energy_test.check((select (r->>'awarded')::boolean and (r->>'amount')::int=5 from (select public.complete_tide('f3000000-0000-4000-8000-000000000002') r) s),'New completion awards 5');
select energy_test.check((select (r->>'awarded')::boolean=false and (r->>'amount')::int=0 and r->>'completed_at' is not null
 from (select public.complete_tide('f3000000-0000-4000-8000-000000000002') r) s),'Completing again awards nothing');
select energy_test.denied($$select public.complete_tide('f3000000-0000-4000-8000-000000000003')$$,'P0002');
select energy_test.denied($$select public.complete_tide(gen_random_uuid())$$,'P0002');
select energy_test.denied($$select private.issue_award(auth.uid(),'quiz_pass',gen_random_uuid())$$);

-- 5. Members read only their own energy.
select energy_test.check((select (r->>'balance')::int=25 and jsonb_array_length(r->'items')=2 and (r->>'active')::boolean
 from (select public.get_my_energy() r) s),'Balance and history');
select energy_test.check((select jsonb_array_length(r->'items')=1 and r->'items'->0->>'title'='Energy fixture 2' and r->'items'->0->>'reversed'='false'
 from (select public.get_my_energy(20,0,'trace') r) s),'Trace filter with title');
select energy_test.check((select r->'items'->0->>'title'='Seagrass' from (select public.get_my_energy(20,0,'tide') r) s),'Tide filter with title');
select energy_test.check((select jsonb_array_length(r->'items')=1 from (select public.get_my_energy(1,0) r) s),'Paged');
select energy_test.denied($$select public.get_my_energy(20,0,'everything')$$,'22023');
select energy_test.denied($$select public.get_my_energy(0,0)$$,'22023');
select energy_test.denied($$select public.get_my_energy(20,-1)$$,'22023');
select energy_test.check((select count(*)=2 from public.energy_ledger),'Owner reads own ledger rows');
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000002',true);
select energy_test.check((select count(*)=0 from public.energy_ledger),'Others cannot read the ledger');
select energy_test.check((select (r->>'balance')::int=0 and jsonb_array_length(r->'items')=0 from (select public.get_my_energy() r) s),'Empty history');
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000003',true);
select energy_test.check((select count(*)=0 from public.energy_ledger),'Moderators cannot read the ledger directly');
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000004',true);
select energy_test.check((select count(*)=2 from public.energy_ledger),'Admins read all ledger rows');

-- 6. No direct writes, and the ledger is append-only even for the table owner.
select energy_test.denied($$insert into public.energy_ledger(owner_id,award_type,source_id,amount) values(auth.uid(),'quiz_pass',gen_random_uuid(),15)$$);
select energy_test.denied($$update public.energy_ledger set amount=amount$$);
select energy_test.denied($$delete from public.energy_ledger$$);
select energy_test.denied($$select * from private.tide_quiz_attempts$$);
reset role;
select energy_test.denied($$update public.energy_ledger set reason='edited'$$);
select energy_test.denied($$delete from public.energy_ledger$$);
select energy_test.denied($$truncate public.energy_ledger cascade$$);
select energy_test.denied($$insert into public.energy_ledger(owner_id,award_type,source_id,amount) values('f1000000-0000-4000-8000-000000000001','trace_approval',gen_random_uuid(),25)$$,'23514');
select energy_test.denied($$insert into public.energy_ledger(owner_id,award_type,source_id,amount) values('f1000000-0000-4000-8000-000000000001','reversal',gen_random_uuid(),-5)$$,'23514');
set local role authenticated;

-- 7. Pausing stops awards; existing energy stays.
select energy_test.check((public.set_energy_active(false)->>'active')::boolean=false,'Admin pauses');
select energy_test.check((public.get_energy_settings()->'activated_at')='null'::jsonb,'Paused setting is null');
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000003',true);
select public.moderate_trace('f2000000-0000-4000-8000-000000000005',1,'approved');
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000001',true);
select energy_test.check((select (r->>'balance')::int=25 and (r->>'active')::boolean=false from (select public.get_my_energy() r) s),'Paused: balance kept, no new award');
reset role;
select energy_test.check((select message='Your Trace "Energy fixture 5": approved.' from public.notifications where message like '%fixture 5%'),'Paused approval message unchanged');
set local role authenticated;
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000001',true);

-- 8. Dashboard: admins get open_energy_flags; members and moderators keep their shape.
select energy_test.check(not (public.get_dashboard_summary() ? 'open_energy_flags'),'Member summary unchanged');
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000003',true);
select energy_test.check(not (public.get_dashboard_summary() ? 'open_energy_flags'),'Moderator summary unchanged');
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000004',true);
select energy_test.check((public.get_dashboard_summary()->>'open_energy_flags')::int=0,'Admin summary has open energy flags');

-- 9. Signed-out and suspended callers get nothing.
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000005',true);
select energy_test.denied($$select public.get_energy_status()$$);
select energy_test.denied($$select public.get_my_energy()$$);
select energy_test.denied($$select public.complete_tide('f3000000-0000-4000-8000-000000000001')$$);
reset role;
set local role anon;
select energy_test.denied($$select public.get_energy_status()$$);
select energy_test.denied($$select public.complete_tide('f3000000-0000-4000-8000-000000000001')$$);
select energy_test.denied($$select * from public.energy_ledger$$);
rollback;
