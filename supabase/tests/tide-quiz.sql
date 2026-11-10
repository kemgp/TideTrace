-- Tide quizzes: admin authoring, member access, grading, cooldown, first-pass award and key reveal.
-- Run on a local/test database after all migrations. Fixtures are rolled back.
begin;
create schema quiz_test;
grant usage on schema quiz_test to anon,authenticated;
create function quiz_test.check(ok boolean,label text default 'assertion') returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Tide quiz check failed: %',label; end if; end $$;
create function quiz_test.denied(statement text,code text default '42501') returns void language plpgsql as $$
begin
 begin execute statement;
 exception when others then
  if sqlstate=code then return; end if;
  raise;
 end;
 raise exception 'Unexpectedly allowed: %',statement;
end $$;
-- n questions; the correct answer for position p is p % 4, so all-correct answers are {1,2,3,0,1}.
create function quiz_test.questions(n integer,complete boolean default true) returns jsonb language sql as $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'prompt','Question '||p,
  'options',jsonb_build_array('A'||p,'B'||p,'C'||p,'D'||p),
  'correct',case when complete or p<n then to_jsonb(p%4) else 'null'::jsonb end,
  'explanation',case when complete or p<n then 'Because '||p else '' end) order by p),'[]'::jsonb)
 from generate_series(1,n) p
$$;
create function quiz_test.rewind() returns void language sql security definer as $$
 update private.tide_quiz_attempts set attempted_at=attempted_at-interval '31 seconds'
$$;
grant execute on all functions in schema quiz_test to anon,authenticated;

insert into auth.users(id,email,raw_user_meta_data) values
 ('f4000000-0000-4000-8000-000000000001','quiz-a@example.invalid','{}'),
 ('f4000000-0000-4000-8000-000000000002','quiz-b@example.invalid','{}'),
 ('f4000000-0000-4000-8000-000000000003','quiz-mod@example.invalid','{}'),
 ('f4000000-0000-4000-8000-000000000004','quiz-admin@example.invalid','{}');
update public.profiles set role='moderator' where id='f4000000-0000-4000-8000-000000000003';
update public.profiles set role='admin' where id='f4000000-0000-4000-8000-000000000004';
insert into public.tides(id,author_id,title,slug,body,status) values
 ('f5000000-0000-4000-8000-000000000001','f4000000-0000-4000-8000-000000000004','Coral','quiz-coral','Text','published'),
 ('f5000000-0000-4000-8000-000000000002','f4000000-0000-4000-8000-000000000004','Draft','quiz-draft','Text','draft');

set local role authenticated;

-- 1. Authoring is admin only.
select set_config('request.jwt.claim.sub','f4000000-0000-4000-8000-000000000003',true);
select quiz_test.denied($$select public.admin_get_tide_quiz('f5000000-0000-4000-8000-000000000001')$$);
select quiz_test.denied($$select public.admin_save_tide_quiz('f5000000-0000-4000-8000-000000000001',null,quiz_test.questions(5),true)$$);
select set_config('request.jwt.claim.sub','f4000000-0000-4000-8000-000000000004',true);
select quiz_test.check((public.admin_get_tide_quiz('f5000000-0000-4000-8000-000000000001')->>'exists')::boolean=false,'No quiz yet');
select quiz_test.denied($$select public.admin_get_tide_quiz(gen_random_uuid())$$,'P0002');

-- 2. Drafts can be partial; publishing needs five complete questions.
select quiz_test.check((select r->>'status'='draft' and (r->>'version')::int=1 and jsonb_array_length(r->'questions')=2
 from (select public.admin_save_tide_quiz('f5000000-0000-4000-8000-000000000001',null,quiz_test.questions(2,false),false) r) s),'Partial draft saved');
select quiz_test.check((select r->'questions'->1->'correct'='null'::jsonb from (select public.admin_get_tide_quiz('f5000000-0000-4000-8000-000000000001') r) s),'Unset answer kept as null');
select quiz_test.denied($$select public.admin_save_tide_quiz('f5000000-0000-4000-8000-000000000001',null,quiz_test.questions(2),false)$$,'40001');
select quiz_test.denied($$select public.admin_save_tide_quiz('f5000000-0000-4000-8000-000000000001',1,quiz_test.questions(4),true)$$,'22023');
select quiz_test.denied($$select public.admin_save_tide_quiz('f5000000-0000-4000-8000-000000000001',1,quiz_test.questions(5,false),true)$$,'22023');
select quiz_test.denied($$select public.admin_save_tide_quiz('f5000000-0000-4000-8000-000000000001',1,quiz_test.questions(6),false)$$,'22023');
select quiz_test.denied($$select public.admin_save_tide_quiz('f5000000-0000-4000-8000-000000000001',1,'[{"prompt":"Q","options":["a","b","c"],"correct":0,"explanation":"x"}]',false)$$,'22023');
select quiz_test.denied($$select public.admin_save_tide_quiz('f5000000-0000-4000-8000-000000000001',1,'[{"prompt":"Q","options":["a","b","c","d"],"correct":4,"explanation":"x"}]',false)$$,'22023');
select quiz_test.denied($$select public.admin_save_tide_quiz('f5000000-0000-4000-8000-000000000001',1,'[{"prompt":"Q","options":["a","b","c","d"],"correct":1.5,"explanation":"x"}]',false)$$,'22023');
select quiz_test.denied($$select public.admin_save_tide_quiz('f5000000-0000-4000-8000-000000000001',1,'[{"prompt":3,"options":["a","b","c","d"],"correct":1,"explanation":"x"}]',false)$$,'22023');
select quiz_test.denied($$select public.admin_save_tide_quiz('f5000000-0000-4000-8000-000000000001',1,'{"not":"an array"}',false)$$,'22023');
select quiz_test.denied($$select public.admin_save_tide_quiz('f5000000-0000-4000-8000-000000000001',1,quiz_test.questions(5),null)$$,'22023');
select quiz_test.check((select r->>'status'='published' and (r->>'version')::int=2 and jsonb_array_length(r->'questions')=5
 from (select public.admin_save_tide_quiz('f5000000-0000-4000-8000-000000000001',1,quiz_test.questions(5),true) r) s),'Published');
-- A quiz on an unpublished lesson can be authored but members cannot reach it.
select public.admin_save_tide_quiz('f5000000-0000-4000-8000-000000000002',null,quiz_test.questions(5),true);

-- 3. Members: lesson first, then questions without the key. No direct table access.
select set_config('request.jwt.claim.sub','f4000000-0000-4000-8000-000000000001',true);
select quiz_test.denied($$select public.get_tide_quiz('f5000000-0000-4000-8000-000000000001')$$);
select quiz_test.denied($$select public.submit_tide_quiz('f5000000-0000-4000-8000-000000000001',2,'{1,2,3,0,1}')$$);
select quiz_test.denied($$select public.get_tide_quiz('f5000000-0000-4000-8000-000000000002')$$,'P0002');
select quiz_test.denied($$select * from public.tide_quiz_questions$$);
select quiz_test.denied($$select * from public.tide_quizzes$$);
select quiz_test.denied($$select * from private.tide_quiz_keys$$);
select quiz_test.denied($$insert into public.tide_quiz_passes(user_id,tide_id,version) values(auth.uid(),'f5000000-0000-4000-8000-000000000001',2)$$);
select public.complete_tide('f5000000-0000-4000-8000-000000000001');
select quiz_test.check((select (r->>'passed')::boolean=false and (r->>'version')::int=2 and (r->>'retry_after')::int=0
 and jsonb_array_length(r->'questions')=5 and r->'questions'->0->>'prompt'='Question 1'
 and jsonb_array_length(r->'questions'->0->'options')=4
 and not (r->'questions'->0 ? 'correct_index') and not (r->'questions'->0 ? 'explanation') and r::text not like '%Because%'
 from (select public.get_tide_quiz('f5000000-0000-4000-8000-000000000001') r) s),'Questions without the key');

-- 4. Input checks run before grading and do not count as attempts.
select quiz_test.denied($$select public.submit_tide_quiz('f5000000-0000-4000-8000-000000000001',1,'{1,2,3,0,1}')$$,'40001');
select quiz_test.denied($$select public.submit_tide_quiz('f5000000-0000-4000-8000-000000000001',2,'{1,2,3,0}')$$,'22023');
select quiz_test.denied($$select public.submit_tide_quiz('f5000000-0000-4000-8000-000000000001',2,'{1,2,3,0,4}')$$,'22023');
select quiz_test.denied($$select public.submit_tide_quiz('f5000000-0000-4000-8000-000000000001',2,'{1,2,3,0,null}')$$,'22023');
select quiz_test.denied($$select public.submit_tide_quiz('f5000000-0000-4000-8000-000000000001',2,null)$$,'22023');

-- 5. Three right fails (no score, no award), then a 30 second cooldown.
select set_config('request.jwt.claim.sub','f4000000-0000-4000-8000-000000000004',true);
select public.set_energy_active(true);
select set_config('request.jwt.claim.sub','f4000000-0000-4000-8000-000000000001',true);
select quiz_test.check((select (r->>'passed')::boolean=false and (r->>'awarded')::boolean=false and (r->>'retry_after')::int=30
 and not (r ? 'score') and not (r ? 'correct')
 from (select public.submit_tide_quiz('f5000000-0000-4000-8000-000000000001',2,'{1,2,3,1,2}') r) s),'Three right fails');
select quiz_test.denied($$select public.submit_tide_quiz('f5000000-0000-4000-8000-000000000001',2,'{1,2,3,0,1}')$$,'TT429');
select quiz_test.check((public.get_tide_quiz('f5000000-0000-4000-8000-000000000001')->>'retry_after')::int=30,'Cooldown reported');

-- 6. Four right passes, awards 15 once, and reveals the key.
select quiz_test.rewind();
select quiz_test.check((select (r->>'passed')::boolean and (r->>'first_pass')::boolean and (r->>'awarded')::boolean and (r->>'amount')::int=15
 from (select public.submit_tide_quiz('f5000000-0000-4000-8000-000000000001',2,'{1,2,3,0,2}') r) s),'Four right passes and awards');
select quiz_test.check((select (r->>'passed')::boolean and (r->'questions'->0->>'correct_index')::int=1 and r->'questions'->0->>'explanation'='Because 1'
 from (select public.get_tide_quiz('f5000000-0000-4000-8000-000000000001') r) s),'Key revealed after a pass');
select quiz_test.rewind();
select quiz_test.check((select (r->>'passed')::boolean and (r->>'first_pass')::boolean=false and (r->>'awarded')::boolean=false
 from (select public.submit_tide_quiz('f5000000-0000-4000-8000-000000000001',2,'{1,2,3,0,1}') r) s),'Passing again awards nothing');
select quiz_test.check((select count(*)=1 from public.tide_quiz_passes),'Own pass is readable');
-- The lesson was completed before activation, so only the quiz pass counts.
select quiz_test.check((select (r->>'balance')::int=15 and jsonb_array_length(r->'items')=1 and r->'items'->0->>'award_type'='quiz_pass'
 and r->'items'->0->>'title'='Coral' from (select public.get_my_energy(20,0,'quiz') r) s),'Quiz award only');
select set_config('request.jwt.claim.sub','f4000000-0000-4000-8000-000000000002',true);
select quiz_test.check((select count(*)=0 from public.tide_quiz_passes),'Others cannot read passes');

-- 7. Editing a published quiz bumps the version; earlier passes stand.
select set_config('request.jwt.claim.sub','f4000000-0000-4000-8000-000000000004',true);
select quiz_test.check((select (r->>'version')::int=3 and (r->>'passes')::int=1
 from (select public.admin_save_tide_quiz('f5000000-0000-4000-8000-000000000001',2,quiz_test.questions(5),true) r) s),'Edit bumps version');
select set_config('request.jwt.claim.sub','f4000000-0000-4000-8000-000000000001',true);
select quiz_test.check((select (r->>'version')::int=3 and (r->>'passed')::boolean from (select public.get_tide_quiz('f5000000-0000-4000-8000-000000000001') r) s),'Pass survives an edit');
select quiz_test.rewind();
select quiz_test.denied($$select public.submit_tide_quiz('f5000000-0000-4000-8000-000000000001',2,'{1,2,3,0,1}')$$,'40001');

-- 8. Unpublishing hides it from members.
select set_config('request.jwt.claim.sub','f4000000-0000-4000-8000-000000000004',true);
select quiz_test.denied($$select public.admin_unpublish_tide_quiz('f5000000-0000-4000-8000-000000000001',2)$$,'40001');
select quiz_test.check((select r->>'status'='draft' and (r->>'version')::int=4
 from (select public.admin_unpublish_tide_quiz('f5000000-0000-4000-8000-000000000001',3) r) s),'Unpublished');
select quiz_test.denied($$select public.admin_unpublish_tide_quiz(gen_random_uuid(),1)$$,'P0002');
select set_config('request.jwt.claim.sub','f4000000-0000-4000-8000-000000000001',true);
select quiz_test.denied($$select public.get_tide_quiz('f5000000-0000-4000-8000-000000000001')$$,'P0002');
select quiz_test.denied($$select public.admin_unpublish_tide_quiz('f5000000-0000-4000-8000-000000000001',4)$$);

-- 9. Signed out.
reset role;
set local role anon;
select quiz_test.denied($$select public.get_tide_quiz('f5000000-0000-4000-8000-000000000001')$$);
select quiz_test.denied($$select public.submit_tide_quiz('f5000000-0000-4000-8000-000000000001',4,'{1,2,3,0,1}')$$);
rollback;
