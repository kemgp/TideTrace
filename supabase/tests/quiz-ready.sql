-- Dashboard "Quiz ready" card: ready and done states, the three day window, reversals, privacy and sign-in.
-- Run on a local/test database after all migrations. Fixtures are rolled back.
begin;
create schema ready_test;
grant usage on schema ready_test to anon,authenticated;
create function ready_test.check(ok boolean,label text default 'assertion') returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Quiz ready check failed: %',label; end if; end $$;
create function ready_test.denied(statement text,code text default '42501') returns void language plpgsql as $$
begin
 begin execute statement;
 exception when others then
  if sqlstate=code then return; end if;
  raise;
 end;
 raise exception 'Unexpectedly allowed: %',statement;
end $$;
create function ready_test.questions() returns jsonb language sql as $$
 select jsonb_agg(jsonb_build_object('prompt','Question '||p,'options',jsonb_build_array('A'||p,'B'||p,'C'||p,'D'||p),
  'correct',p%4,'explanation','Because '||p) order by p) from generate_series(1,5) p
$$;
create function ready_test.pass(tide uuid) returns jsonb language sql as $$
 select public.submit_tide_quiz(tide,(public.get_tide_quiz(tide)->>'version')::integer,'{1,2,3,0,1}')
$$;
create function ready_test.rewind() returns void language sql security definer as $$
 update private.tide_quiz_attempts set attempted_at=attempted_at-interval '31 seconds'
$$;
create function ready_test.completed_hours_ago(tide uuid,hours integer) returns void language sql security definer as $$
 update public.tide_completions set completed_at=now()-make_interval(hours=>hours) where tide_id=tide
$$;
create function ready_test.passed_days_ago(tide uuid,days integer) returns void language sql security definer as $$
 update public.tide_quiz_passes set first_passed_at=now()-make_interval(days=>days) where tide_id=tide
$$;
create function ready_test.award(tide uuid,kind text) returns uuid language sql security definer as $$
 select id from public.energy_ledger where source_id=tide and award_type=kind::public.energy_award_type
$$;
grant execute on all functions in schema ready_test to anon,authenticated;

insert into auth.users(id,email,raw_user_meta_data) values
 ('f8000000-0000-4000-8000-000000000001','ready-a@example.invalid','{}'),
 ('f8000000-0000-4000-8000-000000000002','ready-b@example.invalid','{}'),
 ('f8000000-0000-4000-8000-000000000003','ready-admin@example.invalid','{}');
update public.profiles set role='admin' where id='f8000000-0000-4000-8000-000000000003';
insert into public.tides(id,author_id,title,slug,body,status) values
 ('f9000000-0000-4000-8000-000000000001','f8000000-0000-4000-8000-000000000003','Coral','ready-coral','Text','published'),
 ('f9000000-0000-4000-8000-000000000002','f8000000-0000-4000-8000-000000000003','Reef','ready-reef','Text','published'),
 ('f9000000-0000-4000-8000-000000000003','f8000000-0000-4000-8000-000000000003','No quiz','ready-none','Text','published');

set local role authenticated;
select set_config('request.jwt.claim.sub','f8000000-0000-4000-8000-000000000003',true);
select public.admin_save_tide_quiz('f9000000-0000-4000-8000-000000000001',null,ready_test.questions(),true);
select public.admin_save_tide_quiz('f9000000-0000-4000-8000-000000000002',null,ready_test.questions(),true);
select public.set_energy_active(true);

-- 1. Nothing finished yet, and a lesson without a quiz never shows.
select set_config('request.jwt.claim.sub','f8000000-0000-4000-8000-000000000001',true);
select ready_test.check(public.get_quiz_ready()->>'state'='none','Nothing finished');
select public.complete_tide('f9000000-0000-4000-8000-000000000003');
select ready_test.check(public.get_quiz_ready()->>'state'='none','Lesson without a quiz');

-- 2. A finished lesson with a published quiz is ready; the newest finished lesson wins.
select public.complete_tide('f9000000-0000-4000-8000-000000000001');
select ready_test.completed_hours_ago('f9000000-0000-4000-8000-000000000001',2);
select ready_test.check((select r->>'state'='ready' and r->>'tide_id'='f9000000-0000-4000-8000-000000000001' and r->>'title'='Coral'
 and (r->>'active')::boolean and (r->>'earned')::int=5 from (select public.get_quiz_ready() r) s),'Coral ready, completion earned counted');
select public.complete_tide('f9000000-0000-4000-8000-000000000002');
select ready_test.check(public.get_quiz_ready()->>'title'='Reef','Newest finished lesson first');

-- 3. A passed quiz drops out of "ready"; the other lesson that still has one waiting is shown.
select ready_test.pass('f9000000-0000-4000-8000-000000000002');
select ready_test.check((select r->>'state'='ready' and r->>'title'='Coral' from (select public.get_quiz_ready() r) s),'Ready beats done');

-- 4. When every quiz is passed, the most recent pass shows as done with what the lesson earned.
select ready_test.rewind();
select ready_test.pass('f9000000-0000-4000-8000-000000000001');
select ready_test.passed_days_ago('f9000000-0000-4000-8000-000000000002',1);
select ready_test.check((select r->>'state'='done' and r->>'title'='Coral' and (r->>'earned')::int=20
 from (select public.get_quiz_ready() r) s),'Done shows lesson plus quiz energy');

-- 5. A reversed award is not counted.
select set_config('request.jwt.claim.sub','f8000000-0000-4000-8000-000000000003',true);
select public.reverse_energy_award(ready_test.award('f9000000-0000-4000-8000-000000000001','quiz_pass'),'Test reason');
select set_config('request.jwt.claim.sub','f8000000-0000-4000-8000-000000000001',true);
select ready_test.check((public.get_quiz_ready()->>'earned')::int=5,'Reversed quiz award not counted');

-- 6. A pass older than three days no longer shows.
select ready_test.passed_days_ago('f9000000-0000-4000-8000-000000000001',4);
select ready_test.passed_days_ago('f9000000-0000-4000-8000-000000000002',4);
select ready_test.check(public.get_quiz_ready()->>'state'='none','Old passes hidden');

-- 7. An unpublished quiz or lesson never shows; others see nothing of this member.
select set_config('request.jwt.claim.sub','f8000000-0000-4000-8000-000000000003',true);
select public.admin_unpublish_tide_quiz('f9000000-0000-4000-8000-000000000001',(public.admin_get_tide_quiz('f9000000-0000-4000-8000-000000000001')->>'version')::int);
select set_config('request.jwt.claim.sub','f8000000-0000-4000-8000-000000000001',true);
select ready_test.passed_days_ago('f9000000-0000-4000-8000-000000000001',0);
select ready_test.check(public.get_quiz_ready()->>'state'='none','Unpublished quiz hidden');
select set_config('request.jwt.claim.sub','f8000000-0000-4000-8000-000000000002',true);
select ready_test.check(public.get_quiz_ready()->>'state'='none','Another member sees nothing');

-- 8. Signed out.
select set_config('request.jwt.claim.sub','',true);
select ready_test.denied($$select public.get_quiz_ready()$$);
reset role;
set local role anon;
select ready_test.denied($$select public.get_quiz_ready()$$);
rollback;
