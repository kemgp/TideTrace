-- Phase A, step 1: Tide Energy, Tide quizzes, moderator flags and admin investigations (database only).
-- Plan: docs/plans/phase-a-plan.md, sections 6.1 to 6.5.
--
-- Additive and inert until an admin activates energy: no award is issued while the "energy" setting is
-- missing or its activated_at is null. moderate_trace and get_dashboard_summary keep their signatures and
-- behave exactly as before while energy is inactive. Safe to run before the API and client that use it.
-- Awards are written only by security definer functions, in the same transaction as the event they reward.
-- The direct insert grant on tide_completions stays until the API uses complete_tide (plan step 7).
begin;

do $$ begin
 create type public.energy_award_type as enum ('trace_approval','tide_completion','quiz_pass','reversal');
exception when duplicate_object then null; end $$;
do $$ begin
 create type public.quiz_status as enum ('draft','published');
exception when duplicate_object then null; end $$;
do $$ begin
 create type public.energy_flag_status as enum ('open','dismissed','upheld');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------------------------------------
-- Ledger: append-only, one award per owner, type and source, even after a reversal.
-- source_id is the Trace id (trace_approval), the Tide id (tide_completion, quiz_pass) or, for a reversal,
-- the reversed entry's id. No foreign key on source_id on purpose: deleting content never revokes energy.
create table if not exists public.energy_ledger (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete restrict,
 award_type public.energy_award_type not null,
 source_id uuid not null,
 amount integer not null,
 reverses_id uuid references public.energy_ledger(id),
 reason text,
 created_by uuid references public.profiles(id),
 created_at timestamptz not null default now(),
 constraint energy_ledger_one_award unique (owner_id, award_type, source_id),
 constraint energy_ledger_reversal_link check ((award_type = 'reversal') = (reverses_id is not null)),
 constraint energy_ledger_reversal_reason check (award_type <> 'reversal' or length(btrim(coalesce(reason,''))) between 1 and 2000),
 constraint energy_ledger_amount check (case award_type
  when 'trace_approval' then amount = 20
  when 'tide_completion' then amount = 5
  when 'quiz_pass' then amount = 15
  else amount < 0 end)
);
create unique index if not exists energy_ledger_one_reversal on public.energy_ledger(reverses_id) where reverses_id is not null;
create index if not exists energy_ledger_owner on public.energy_ledger(owner_id, created_at desc);
create index if not exists energy_ledger_recent on public.energy_ledger(created_at desc);

create or replace function private.energy_ledger_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
 raise exception 'Energy ledger entries cannot be changed or removed' using errcode = '42501';
end $$;
drop trigger if exists energy_ledger_append_only on public.energy_ledger;
create trigger energy_ledger_append_only before update or delete on public.energy_ledger
for each row execute function private.energy_ledger_append_only();
drop trigger if exists energy_ledger_no_truncate on public.energy_ledger;
create trigger energy_ledger_no_truncate before truncate on public.energy_ledger
for each statement execute function private.energy_ledger_append_only();

-- ---------------------------------------------------------------------------------------------------------
-- Quizzes. Questions and options are readable only through get_tide_quiz; the key and explanations live in
-- the private schema and reach members only after a pass.
create table if not exists public.tide_quizzes (
 tide_id uuid primary key references public.tides(id) on delete cascade,
 status public.quiz_status not null default 'draft',
 version integer not null default 1 check (version > 0),
 published_at timestamptz,
 updated_at timestamptz not null default now(),
 updated_by uuid references public.profiles(id)
);
create table if not exists public.tide_quiz_questions (
 id uuid primary key default gen_random_uuid(),
 tide_id uuid not null references public.tide_quizzes(tide_id) on delete cascade,
 position smallint not null check (position between 1 and 5),
 prompt text not null default '' check (length(prompt) <= 500),
 options text[] not null check (cardinality(options) = 4),
 unique (tide_id, position)
);
create table if not exists private.tide_quiz_keys (
 question_id uuid primary key references public.tide_quiz_questions(id) on delete cascade,
 correct_index smallint check (correct_index between 0 and 3),
 explanation text not null default '' check (length(explanation) <= 1000)
);
create table if not exists private.tide_quiz_attempts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id),
 tide_id uuid not null references public.tides(id) on delete cascade,
 version integer not null,
 passed boolean not null,
 attempted_at timestamptz not null default now()
);
create index if not exists tide_quiz_attempts_recent on private.tide_quiz_attempts(user_id, tide_id, attempted_at desc);
create table if not exists public.tide_quiz_passes (
 user_id uuid not null references public.profiles(id),
 tide_id uuid not null references public.tides(id) on delete cascade,
 version integer not null,
 first_passed_at timestamptz not null default now(),
 primary key (user_id, tide_id)
);

-- ---------------------------------------------------------------------------------------------------------
-- Moderator flags on issued Trace awards. One open flag per award.
create table if not exists public.energy_flags (
 id uuid primary key default gen_random_uuid(),
 ledger_id uuid not null references public.energy_ledger(id),
 flagged_by uuid not null references public.profiles(id),
 reason text not null check (length(btrim(reason)) between 1 and 2000),
 status public.energy_flag_status not null default 'open',
 resolved_by uuid references public.profiles(id),
 resolved_at timestamptz,
 resolution_reason text,
 created_at timestamptz not null default now(),
 check ((status = 'open') = (resolved_at is null))
);
create unique index if not exists energy_flags_one_open on public.energy_flags(ledger_id) where status = 'open';
create index if not exists energy_flags_by on public.energy_flags(flagged_by, created_at desc);

-- ---------------------------------------------------------------------------------------------------------
-- Access: no direct writes for anyone. Owners read their own ledger and passes; staff read their own flags;
-- admins read all of it. Everything else goes through the functions below.
do $$ declare t text; begin
 foreach t in array array['energy_ledger','tide_quizzes','tide_quiz_questions','tide_quiz_passes','energy_flags'] loop
  execute format('alter table public.%I enable row level security', t);
  execute format('revoke all on public.%I from public, anon, authenticated', t);
 end loop;
end $$;
revoke all on private.tide_quiz_keys, private.tide_quiz_attempts from public, anon, authenticated;
grant select on public.energy_ledger, public.tide_quiz_passes, public.energy_flags to authenticated;
drop policy if exists energy_ledger_read on public.energy_ledger;
create policy energy_ledger_read on public.energy_ledger for select to authenticated
 using ((owner_id = auth.uid() and private.current_role() is not null) or private.is_admin());
drop policy if exists quiz_passes_read on public.tide_quiz_passes;
create policy quiz_passes_read on public.tide_quiz_passes for select to authenticated
 using ((user_id = auth.uid() and private.current_role() is not null) or private.is_admin());
drop policy if exists energy_flags_read on public.energy_flags;
create policy energy_flags_read on public.energy_flags for select to authenticated
 using ((flagged_by = auth.uid() and private.is_staff()) or private.is_admin());

-- ---------------------------------------------------------------------------------------------------------
-- Activation. settings key "energy" = {"activated_at": "<timestamptz>" | null}. Null or missing = off.
create or replace function private.validate_energy_settings() returns trigger
language plpgsql security definer set search_path = '' as $$
declare stamp timestamptz;
begin
 if new.key <> 'energy' then return new; end if;
 if jsonb_typeof(new.value) <> 'object' or (new.value - 'activated_at') <> '{}'::jsonb or not (new.value ? 'activated_at')
  or jsonb_typeof(new.value->'activated_at') not in ('null','string') then
  raise exception 'Invalid energy settings' using errcode = '22023';
 end if;
 if jsonb_typeof(new.value->'activated_at') = 'string' then
  begin stamp := (new.value->>'activated_at')::timestamptz;
  exception when others then raise exception 'Invalid energy settings' using errcode = '22023'; end;
  -- Activation is "from now": no back-dating (it would not backfill anyway) and no scheduling ahead.
  if (tg_op = 'INSERT' or old.value->>'activated_at' is distinct from new.value->>'activated_at')
   and abs(extract(epoch from stamp - now())) > 60 then
   raise exception 'Energy can only be activated from the current time' using errcode = '22023';
  end if;
 end if;
 insert into public.admin_audit_logs(actor_id, target_user_id, action, old_values, new_values, reason)
 values (auth.uid(), auth.uid(), 'update_energy_settings',
  case when tg_op = 'INSERT' then '{}'::jsonb else old.value end, new.value,
  case when new.value->>'activated_at' is null then 'Tide Energy paused' else 'Tide Energy activated' end);
 return new;
end $$;
drop trigger if exists validate_energy_settings on public.settings;
create trigger validate_energy_settings before insert or update on public.settings
for each row execute function private.validate_energy_settings();

create or replace function private.energy_active() returns boolean
language sql stable security definer set search_path = '' as $$
 select coalesce((select (value->>'activated_at')::timestamptz <= now() from public.settings where key = 'energy'), false)
$$;

-- The only writer of award rows. Returns the new row, or null when nothing was issued (inactive, inactive
-- owner, or already awarded: retries and races end here without an error).
create or replace function private.issue_award(p_owner uuid, p_type public.energy_award_type, p_source uuid)
returns public.energy_ledger language plpgsql security definer set search_path = '' as $$
declare entry public.energy_ledger;
begin
 if p_type = 'reversal' then raise exception 'Reversals are not awards' using errcode = '22023'; end if;
 if not private.energy_active() then return null; end if;
 if not exists (select 1 from public.profiles where id = p_owner and status = 'active') then return null; end if;
 insert into public.energy_ledger(owner_id, award_type, source_id, amount)
 values (p_owner, p_type, p_source, case p_type when 'trace_approval' then 20 when 'tide_completion' then 5 else 15 end)
 on conflict (owner_id, award_type, source_id) do nothing
 returning * into entry;
 return entry;
end $$;

-- A short label for an entry's source, for notifications and history.
create or replace function private.energy_source_title(p_type public.energy_award_type, p_source uuid)
returns text language sql stable security definer set search_path = '' as $$
 select case p_type
  when 'trace_approval' then (select nullif(btrim(title), '') from public.traces where id = p_source)
  else (select title from public.tides where id = p_source) end
$$;

create or replace function private.energy_entry_json(e public.energy_ledger) returns jsonb
language sql stable security definer set search_path = '' as $$
 select jsonb_build_object(
  'id', e.id, 'owner_id', e.owner_id, 'award_type', e.award_type, 'source_id', e.source_id, 'amount', e.amount,
  'reverses_id', e.reverses_id, 'reason', e.reason, 'created_at', e.created_at,
  'source_type', coalesce(o.award_type, e.award_type),
  'title', coalesce(private.energy_source_title(coalesce(o.award_type, e.award_type), coalesce(o.source_id, e.source_id)), 'Untitled'),
  'source_deleted', case when coalesce(o.award_type, e.award_type) = 'trace_approval'
    then exists (select 1 from public.traces t where t.id = coalesce(o.source_id, e.source_id) and t.deleted_at is not null) else false end,
  'reversed', exists (select 1 from public.energy_ledger r where r.reverses_id = e.id))
 from (select 1) one left join public.energy_ledger o on o.id = e.reverses_id
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Trace approval: unchanged checks and order (20261107000100), plus the award in the same transaction.
create or replace function public.moderate_trace(p_id uuid,p_version integer,p_decision public.trace_state,p_reason text default null)
returns public.traces language plpgsql security definer set search_path = '' as $$
declare t public.traces; action_uuid uuid; award public.energy_ledger; earned text := '';
begin
 if not private.is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 if p_decision is null or p_decision not in ('approved','rejected','revision_requested') then raise exception 'Invalid decision'; end if;
 if p_decision<>'approved' and coalesce(length(btrim(p_reason)),0)=0 then raise exception 'Feedback required'; end if;
 select * into t from public.traces where id=p_id for update;
 if not found or t.status<>'pending' or t.is_hidden or t.deleted_at is not null then raise exception 'Trace is not pending'; end if;
 if t.author_id=auth.uid() then raise exception 'Cannot review your own submission' using errcode='42501'; end if;
 if exists(select 1 from public.trace_holds where trace_id=p_id) and not private.is_admin() then raise exception 'Trace is on hold for an admin' using errcode='42501'; end if;
 if p_version is distinct from t.version then raise exception 'Stale submission version' using errcode='40001'; end if;
 insert into public.moderation_actions(actor_id,trace_id,action,reason,from_state,to_state)
 values(auth.uid(),p_id,'review_trace',coalesce(p_reason,''),t.status::text,p_decision::text) returning id into action_uuid;
 if p_decision='approved' then
  award := private.issue_award(t.author_id,'trace_approval',p_id);
  if award.id is not null then earned := format(' You earned %s Tide Energy.', award.amount); end if;
 end if;
 insert into public.notifications(recipient_id,action_id,type,message)
 values(t.author_id,action_uuid,'trace_review',format('Your Trace "%s": %s.%s%s',t.title,replace(p_decision::text,'_',' '),earned,coalesce(' '||p_reason,'')));
 delete from public.trace_holds where trace_id=p_id;
 update public.traces set status=p_decision,published_at=case when p_decision='approved' then now() else null end,
 version=version+1 where id=p_id returning * into t;
 return t;
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- Tide completion through one function: records it and, for a new completion, issues the award.
create or replace function public.complete_tide(p_tide_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); done timestamptz; award public.energy_ledger;
begin
 if actor is null or private.current_role() is null then raise exception 'Active account required' using errcode='42501'; end if;
 if not exists (select 1 from public.tides where id = p_tide_id and status = 'published') then
  raise exception 'Lesson is not available' using errcode='P0002';
 end if;
 insert into public.tide_completions(user_id, tide_id) values (actor, p_tide_id)
 on conflict (user_id, tide_id) do nothing returning completed_at into done;
 if done is not null then
  award := private.issue_award(actor, 'tide_completion', p_tide_id);
 else
  select completed_at into done from public.tide_completions where user_id = actor and tide_id = p_tide_id;
 end if;
 return jsonb_build_object('user_id', actor, 'tide_id', p_tide_id, 'completed_at', done,
  'awarded', award.id is not null, 'amount', coalesce(award.amount, 0));
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- Member quiz.
create or replace function private.quiz_retry_after(p_user uuid, p_tide uuid) returns integer
language sql stable security definer set search_path = '' as $$
 select coalesce(greatest(0, ceil(30 - extract(epoch from now() - max(attempted_at))))::integer, 0)
 from private.tide_quiz_attempts where user_id = p_user and tide_id = p_tide
$$;

create or replace function public.get_tide_quiz(p_tide_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid(); quiz public.tide_quizzes; has_passed boolean;
begin
 if actor is null or private.current_role() is null then raise exception 'Active account required' using errcode='42501'; end if;
 select q.* into quiz from public.tide_quizzes q join public.tides t on t.id = q.tide_id
 where q.tide_id = p_tide_id and q.status = 'published' and t.status = 'published';
 if not found then raise exception 'Quiz is not available' using errcode='P0002'; end if;
 if not exists (select 1 from public.tide_completions where user_id = actor and tide_id = p_tide_id) then
  raise exception 'Complete the lesson before the quiz' using errcode='42501';
 end if;
 has_passed := exists (select 1 from public.tide_quiz_passes where user_id = actor and tide_id = p_tide_id);
 return jsonb_build_object(
  'tide_id', p_tide_id, 'version', quiz.version, 'passed', has_passed,
  'retry_after', private.quiz_retry_after(actor, p_tide_id),
  'questions', (select coalesce(jsonb_agg(jsonb_build_object(
     'id', qq.id, 'position', qq.position, 'prompt', qq.prompt, 'options', to_jsonb(qq.options))
     || case when has_passed then jsonb_build_object('correct_index', k.correct_index, 'explanation', k.explanation) else '{}'::jsonb end
     order by qq.position), '[]'::jsonb)
   from public.tide_quiz_questions qq left join private.tide_quiz_keys k on k.question_id = qq.id
   where qq.tide_id = p_tide_id));
end $$;

-- Graded on the server. Returns only whether the attempt passed; never a score or which answers were wrong.
create or replace function public.submit_tide_quiz(p_tide_id uuid, p_version integer, p_answers smallint[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); quiz public.tide_quizzes; wait integer; right_answers integer; ok boolean;
 first_pass boolean := false; award public.energy_ledger;
begin
 if actor is null or private.current_role() is null then raise exception 'Active account required' using errcode='42501'; end if;
 -- One submission at a time per member and Tide, so parallel submits cannot race the cooldown or the first pass.
 perform pg_advisory_xact_lock(hashtextextended(actor::text || ':' || p_tide_id::text, 7319));
 select q.* into quiz from public.tide_quizzes q join public.tides t on t.id = q.tide_id
 where q.tide_id = p_tide_id and q.status = 'published' and t.status = 'published';
 if not found then raise exception 'Quiz is not available' using errcode='P0002'; end if;
 if not exists (select 1 from public.tide_completions where user_id = actor and tide_id = p_tide_id) then
  raise exception 'Complete the lesson before the quiz' using errcode='42501';
 end if;
 if p_version is distinct from quiz.version then raise exception 'Quiz changed. Reload it before answering.' using errcode='40001'; end if;
 if p_answers is null or cardinality(p_answers) <> 5 or array_position(p_answers, null) is not null
  or exists (select 1 from unnest(p_answers) a where a not between 0 and 3) then
  raise exception 'Answer all five questions' using errcode='22023';
 end if;
 wait := private.quiz_retry_after(actor, p_tide_id);
 if wait > 0 then raise exception 'Try again in % seconds', wait using errcode='TT429', detail = wait::text; end if;
 select count(*) into right_answers from public.tide_quiz_questions qq join private.tide_quiz_keys k on k.question_id = qq.id
 where qq.tide_id = p_tide_id and k.correct_index = p_answers[qq.position];
 ok := right_answers >= 4;
 insert into private.tide_quiz_attempts(user_id, tide_id, version, passed) values (actor, p_tide_id, quiz.version, ok);
 if ok then
  insert into public.tide_quiz_passes(user_id, tide_id, version) values (actor, p_tide_id, quiz.version)
  on conflict (user_id, tide_id) do nothing returning true into first_pass;
  if first_pass then award := private.issue_award(actor, 'quiz_pass', p_tide_id); end if;
 end if;
 return jsonb_build_object('passed', ok, 'first_pass', coalesce(first_pass, false),
  'awarded', award.id is not null, 'amount', coalesce(award.amount, 0), 'retry_after', case when ok then 0 else 30 end);
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- Admin quiz authoring. p_questions: [{"prompt": "...", "options": ["","","",""], "correct": 0..3|null, "explanation": "..."}].
create or replace function public.admin_get_tide_quiz(p_tide_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare quiz public.tide_quizzes;
begin
 if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if not exists (select 1 from public.tides where id = p_tide_id) then raise exception 'Lesson not found' using errcode='P0002'; end if;
 select * into quiz from public.tide_quizzes where tide_id = p_tide_id;
 if not found then return jsonb_build_object('tide_id', p_tide_id, 'exists', false, 'status', null, 'version', null, 'questions', '[]'::jsonb); end if;
 return jsonb_build_object('tide_id', p_tide_id, 'exists', true, 'status', quiz.status, 'version', quiz.version,
  'published_at', quiz.published_at, 'updated_at', quiz.updated_at,
  'passes', (select count(*) from public.tide_quiz_passes where tide_id = p_tide_id),
  'questions', (select coalesce(jsonb_agg(jsonb_build_object('id', qq.id, 'position', qq.position, 'prompt', qq.prompt,
     'options', to_jsonb(qq.options), 'correct', k.correct_index, 'explanation', coalesce(k.explanation, '')) order by qq.position), '[]'::jsonb)
   from public.tide_quiz_questions qq left join private.tide_quiz_keys k on k.question_id = qq.id where qq.tide_id = p_tide_id));
end $$;

create or replace function public.admin_save_tide_quiz(p_tide_id uuid, p_expected_version integer, p_questions jsonb, p_publish boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare quiz public.tide_quizzes; item jsonb; n integer; pos integer := 0; opts text[]; question_uuid uuid; correct smallint;
 complete boolean := true;
begin
 if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_publish is null then raise exception 'Choose draft or published' using errcode='22023'; end if;
 perform 1 from public.tides where id = p_tide_id for update;
 if not found then raise exception 'Lesson not found' using errcode='P0002'; end if;
 select * into quiz from public.tide_quizzes where tide_id = p_tide_id for update;
 if found and p_expected_version is distinct from quiz.version then
  raise exception 'This quiz changed. Reload it before saving.' using errcode='40001';
 end if;
 if not found and p_expected_version is not null then
  raise exception 'This quiz changed. Reload it before saving.' using errcode='40001';
 end if;
 if p_questions is null or jsonb_typeof(p_questions) <> 'array' then raise exception 'Invalid quiz' using errcode='22023'; end if;
 n := jsonb_array_length(p_questions);
 if n > 5 then raise exception 'A quiz has at most five questions' using errcode='22023'; end if;
 for item in select value from jsonb_array_elements(p_questions) loop
  if jsonb_typeof(item) <> 'object' or jsonb_typeof(item->'options') <> 'array' or jsonb_array_length(item->'options') <> 4
   or exists (select 1 from jsonb_array_elements(item->'options') o where jsonb_typeof(o) <> 'string')
   or coalesce(jsonb_typeof(item->'prompt'), 'null') not in ('string')
   or coalesce(jsonb_typeof(item->'explanation'), 'string') <> 'string'
   or coalesce(jsonb_typeof(item->'correct'), 'null') not in ('number', 'null') then
   raise exception 'Invalid quiz question' using errcode='22023';
  end if;
  if item->'correct' is not null and jsonb_typeof(item->'correct') = 'number'
   and ((item->>'correct')::numeric not in (0,1,2,3)) then raise exception 'Invalid correct answer' using errcode='22023'; end if;
  if length(btrim(item->>'prompt')) = 0 or length(btrim(coalesce(item->>'explanation', ''))) = 0
   or jsonb_typeof(item->'correct') is distinct from 'number'
   or exists (select 1 from jsonb_array_elements_text(item->'options') o where length(btrim(o)) = 0) then
   complete := false;
  end if;
 end loop;
 if p_publish and (n <> 5 or not complete) then
  raise exception 'A published quiz needs five questions, four options each, one correct answer and an explanation' using errcode='22023';
 end if;
 if quiz.tide_id is null then
  insert into public.tide_quizzes(tide_id, status, version, published_at, updated_by)
  values (p_tide_id, case when p_publish then 'published'::public.quiz_status else 'draft'::public.quiz_status end, 1,
   case when p_publish then now() end, auth.uid()) returning * into quiz;
 else
  -- Any save after the first bumps the version, so members holding an older copy are asked to reload.
  update public.tide_quizzes set status = case when p_publish then 'published'::public.quiz_status else 'draft'::public.quiz_status end,
   version = version + 1, published_at = case when p_publish then coalesce(published_at, now()) end,
   updated_at = now(), updated_by = auth.uid()
  where tide_id = p_tide_id returning * into quiz;
 end if;
 delete from public.tide_quiz_questions where tide_id = p_tide_id;
 for item in select value from jsonb_array_elements(p_questions) loop
  pos := pos + 1;
  select array_agg(btrim(o) order by ord) into opts from jsonb_array_elements_text(item->'options') with ordinality as x(o, ord);
  insert into public.tide_quiz_questions(tide_id, position, prompt, options)
  values (p_tide_id, pos, btrim(item->>'prompt'), opts) returning id into question_uuid;
  correct := case when jsonb_typeof(item->'correct') = 'number' then (item->>'correct')::smallint end;
  insert into private.tide_quiz_keys(question_id, correct_index, explanation)
  values (question_uuid, correct, btrim(coalesce(item->>'explanation', '')));
 end loop;
 return public.admin_get_tide_quiz(p_tide_id);
end $$;

create or replace function public.admin_unpublish_tide_quiz(p_tide_id uuid, p_expected_version integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare quiz public.tide_quizzes;
begin
 if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 select * into quiz from public.tide_quizzes where tide_id = p_tide_id for update;
 if not found then raise exception 'Quiz not found' using errcode='P0002'; end if;
 if p_expected_version is distinct from quiz.version then raise exception 'This quiz changed. Reload it before saving.' using errcode='40001'; end if;
 update public.tide_quizzes set status = 'draft', version = version + 1, published_at = null, updated_at = now(), updated_by = auth.uid()
 where tide_id = p_tide_id;
 return public.admin_get_tide_quiz(p_tide_id);
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- Member energy.
create or replace function public.get_energy_status() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
 if private.current_role() is null then raise exception 'Active account required' using errcode='42501'; end if;
 return jsonb_build_object('active', private.energy_active());
end $$;

-- p_kind: null (all), 'trace', 'tide' or 'quiz'. A reversal belongs to the kind of the award it reverses.
create or replace function public.get_my_energy(p_limit integer default 20, p_offset integer default 0, p_kind text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid(); wanted public.energy_award_type;
begin
 if actor is null or private.current_role() is null then raise exception 'Active account required' using errcode='42501'; end if;
 if p_limit is null or p_limit not between 1 and 50 or p_offset is null or p_offset < 0 then raise exception 'Invalid page' using errcode='22023'; end if;
 if p_kind is not null and p_kind not in ('trace','tide','quiz') then raise exception 'Invalid filter' using errcode='22023'; end if;
 wanted := case p_kind when 'trace' then 'trace_approval' when 'tide' then 'tide_completion' when 'quiz' then 'quiz_pass' end;
 return jsonb_build_object(
  'balance', (select coalesce(sum(amount), 0) from public.energy_ledger where owner_id = actor),
  'active', private.energy_active(),
  'items', (select coalesce(jsonb_agg(private.energy_entry_json(e) order by e.created_at desc, e.id), '[]'::jsonb) from (
    select e.* from public.energy_ledger e left join public.energy_ledger o on o.id = e.reverses_id
    where e.owner_id = actor and (wanted is null or coalesce(o.award_type, e.award_type) = wanted)
    order by e.created_at desc, e.id limit p_limit offset p_offset) e));
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- Staff: award status of reviewed Traces, flagging, own flags.
create or replace function public.staff_energy_awards(p_trace_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
 if not private.is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 if p_trace_ids is null or cardinality(p_trace_ids) > 100 then raise exception 'Between 0 and 100 Traces' using errcode='22023'; end if;
 return jsonb_build_object('active', private.energy_active(),
  'awards', (select coalesce(jsonb_agg(jsonb_build_object(
    'trace_id', e.source_id, 'ledger_id', e.id, 'amount', e.amount, 'created_at', e.created_at,
    'owner_name', p.display_name,
    'reversed', exists (select 1 from public.energy_ledger r where r.reverses_id = e.id),
    'open_flag', exists (select 1 from public.energy_flags f where f.ledger_id = e.id and f.status = 'open'),
    'my_flags', (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'status', f.status, 'reason', f.reason,
       'resolution_reason', f.resolution_reason, 'resolved_at', f.resolved_at, 'created_at', f.created_at) order by f.created_at desc), '[]'::jsonb)
       from public.energy_flags f where f.ledger_id = e.id and f.flagged_by = auth.uid()))), '[]'::jsonb)
   from public.energy_ledger e join public.profiles p on p.id = e.owner_id
   where e.award_type = 'trace_approval' and e.source_id = any(p_trace_ids)));
end $$;

create or replace function public.flag_energy_award(p_ledger_id uuid, p_reason text) returns public.energy_flags
language plpgsql security definer set search_path = '' as $$
declare e public.energy_ledger; flag public.energy_flags; label text;
begin
 if not private.is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 if coalesce(length(btrim(p_reason)), 0) not between 1 and 2000 then raise exception 'Reason required' using errcode='22023'; end if;
 select * into e from public.energy_ledger where id = p_ledger_id for update;
 if not found then raise exception 'Award not found' using errcode='P0002'; end if;
 if e.award_type <> 'trace_approval' then raise exception 'Only Trace awards can be flagged' using errcode='22023'; end if;
 if e.owner_id = auth.uid() then raise exception 'Cannot flag your own award' using errcode='42501'; end if;
 if exists (select 1 from public.energy_ledger where reverses_id = e.id) then raise exception 'This award was already reversed' using errcode='22023'; end if;
 if exists (select 1 from public.energy_flags where ledger_id = e.id and status = 'open') then
  raise exception 'This award already has an open flag' using errcode='23505';
 end if;
 insert into public.energy_flags(ledger_id, flagged_by, reason) values (e.id, auth.uid(), btrim(p_reason)) returning * into flag;
 label := coalesce(private.energy_source_title(e.award_type, e.source_id), 'a Trace');
 insert into public.notifications(recipient_id, type, message)
 select p.id, 'energy_flag', format('New energy flag to review: "%s".', label)
 from public.profiles p where p.role = 'admin' and p.status = 'active' and p.id <> auth.uid();
 return flag;
end $$;

create or replace function public.staff_my_energy_flags(p_limit integer default 20, p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
 if not private.is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 if p_limit is null or p_limit not between 1 and 50 or p_offset is null or p_offset < 0 then raise exception 'Invalid page' using errcode='22023'; end if;
 return (select coalesce(jsonb_agg(row order by created_at desc, id), '[]'::jsonb) from (
  select f.id, f.created_at, jsonb_build_object('id', f.id, 'ledger_id', f.ledger_id, 'status', f.status, 'reason', f.reason,
   'resolution_reason', f.resolution_reason, 'resolved_at', f.resolved_at, 'created_at', f.created_at,
   'trace_id', e.source_id, 'title', coalesce(private.energy_source_title(e.award_type, e.source_id), 'Untitled'),
   'owner_name', p.display_name, 'amount', e.amount) as row
  from public.energy_flags f join public.energy_ledger e on e.id = f.ledger_id join public.profiles p on p.id = e.owner_id
  where f.flagged_by = auth.uid()
  order by f.created_at desc, f.id limit p_limit offset p_offset) s);
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- Admin investigations.
create or replace function public.dismiss_energy_flag(p_flag_id uuid, p_reason text) returns public.energy_flags
language plpgsql security definer set search_path = '' as $$
declare flag public.energy_flags; e public.energy_ledger;
begin
 if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if coalesce(length(btrim(p_reason)), 0) not between 1 and 2000 then raise exception 'Reason required' using errcode='22023'; end if;
 select * into flag from public.energy_flags where id = p_flag_id for update;
 if not found then raise exception 'Flag not found' using errcode='P0002'; end if;
 if flag.status <> 'open' then raise exception 'Flag is not open' using errcode='22023'; end if;
 select * into e from public.energy_ledger where id = flag.ledger_id;
 update public.energy_flags set status = 'dismissed', resolved_by = auth.uid(), resolved_at = now(), resolution_reason = btrim(p_reason)
 where id = flag.id returning * into flag;
 insert into public.admin_audit_logs(actor_id, target_user_id, action, old_values, new_values, reason)
 values (auth.uid(), e.owner_id, 'dismiss_energy_flag', jsonb_build_object('flag_id', flag.id, 'ledger_id', e.id, 'status', 'open'),
  jsonb_build_object('flag_id', flag.id, 'ledger_id', e.id, 'status', 'dismissed'), btrim(p_reason));
 -- The member is never told about a dismissed flag; only the moderator who raised it.
 insert into public.notifications(recipient_id, type, message)
 select flag.flagged_by, 'energy_flag_outcome', format('Your flag on "%s" was reviewed: dismissed. Reason: %s',
  coalesce(private.energy_source_title(e.award_type, e.source_id), 'a Trace'), btrim(p_reason))
 where flag.flagged_by <> auth.uid() and exists (select 1 from public.profiles where id = flag.flagged_by and status = 'active');
 return flag;
end $$;

-- Reverse any award once. The original stays; a compensating entry is added. Final: there is no undo.
create or replace function public.reverse_energy_award(p_ledger_id uuid, p_reason text) returns public.energy_ledger
language plpgsql security definer set search_path = '' as $$
declare e public.energy_ledger; reversal public.energy_ledger; label text; what text; flag public.energy_flags;
begin
 if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if coalesce(length(btrim(p_reason)), 0) not between 1 and 2000 then raise exception 'Reason required' using errcode='22023'; end if;
 select * into e from public.energy_ledger where id = p_ledger_id for update;
 if not found then raise exception 'Award not found' using errcode='P0002'; end if;
 if e.award_type = 'reversal' then raise exception 'A reversal cannot be reversed' using errcode='22023'; end if;
 if e.owner_id = auth.uid() then raise exception 'Cannot reverse your own award' using errcode='42501'; end if;
 if exists (select 1 from public.energy_ledger where reverses_id = e.id) then raise exception 'This award was already reversed' using errcode='22023'; end if;
 insert into public.energy_ledger(owner_id, award_type, source_id, amount, reverses_id, reason, created_by)
 values (e.owner_id, 'reversal', e.id, -e.amount, e.id, btrim(p_reason), auth.uid()) returning * into reversal;
 label := coalesce(private.energy_source_title(e.award_type, e.source_id), 'Untitled');
 what := case e.award_type when 'trace_approval' then format('your Trace "%s"', label)
  when 'tide_completion' then format('completing "%s"', label) else format('passing the quiz on "%s"', label) end;
 insert into public.admin_audit_logs(actor_id, target_user_id, action, old_values, new_values, reason)
 values (auth.uid(), e.owner_id, 'reverse_energy_award', jsonb_build_object('ledger_id', e.id, 'amount', e.amount),
  jsonb_build_object('ledger_id', e.id, 'reversal_id', reversal.id, 'amount', reversal.amount), btrim(p_reason));
 insert into public.notifications(recipient_id, type, message)
 select e.owner_id, 'energy_reversal', format('An admin reversed %s Tide Energy for %s. Reason: %s', e.amount, what, btrim(p_reason))
 where exists (select 1 from public.profiles where id = e.owner_id and status = 'active');
 for flag in update public.energy_flags set status = 'upheld', resolved_by = auth.uid(), resolved_at = now(), resolution_reason = btrim(p_reason)
  where ledger_id = e.id and status = 'open' returning * loop
  insert into public.notifications(recipient_id, type, message)
  select flag.flagged_by, 'energy_flag_outcome', format('Your flag on "%s" was reviewed: award reversed. Reason: %s', label, btrim(p_reason))
  where flag.flagged_by <> auth.uid() and exists (select 1 from public.profiles where id = flag.flagged_by and status = 'active');
 end loop;
 return reversal;
end $$;

-- p_kind: null, 'trace', 'tide' or 'quiz'. Totals cover everything; the list is paged, newest first.
create or replace function public.admin_energy_activity(p_limit integer default 20, p_offset integer default 0, p_kind text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare wanted public.energy_award_type;
begin
 if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_limit is null or p_limit not between 1 and 50 or p_offset is null or p_offset < 0 then raise exception 'Invalid page' using errcode='22023'; end if;
 if p_kind is not null and p_kind not in ('trace','tide','quiz') then raise exception 'Invalid filter' using errcode='22023'; end if;
 wanted := case p_kind when 'trace' then 'trace_approval' when 'tide' then 'tide_completion' when 'quiz' then 'quiz_pass' end;
 return jsonb_build_object(
  'active', private.energy_active(),
  'totals', jsonb_build_object(
   'open_flags', (select count(*) from public.energy_flags where status = 'open'),
   'awards', (select count(*) from public.energy_ledger where award_type <> 'reversal'),
   'energy_issued', (select coalesce(sum(amount), 0) from public.energy_ledger where award_type <> 'reversal'),
   'reversals', (select count(*) from public.energy_ledger where award_type = 'reversal')),
  'open_flags', (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'ledger_id', f.ledger_id, 'reason', f.reason, 'created_at', f.created_at,
     'title', coalesce(private.energy_source_title(e.award_type, e.source_id), 'Untitled'), 'owner_name', o.display_name,
     'flagged_by_name', s.display_name, 'amount', e.amount) order by f.created_at), '[]'::jsonb)
   from public.energy_flags f join public.energy_ledger e on e.id = f.ledger_id
   join public.profiles o on o.id = e.owner_id join public.profiles s on s.id = f.flagged_by where f.status = 'open'),
  'awards', (select coalesce(jsonb_agg(private.energy_entry_json(e) || jsonb_build_object('owner_name', p.display_name,
     'open_flag', exists (select 1 from public.energy_flags f where f.ledger_id = e.id and f.status = 'open')) order by e.created_at desc, e.id), '[]'::jsonb)
   from (select * from public.energy_ledger where award_type <> 'reversal' and (wanted is null or award_type = wanted)
         order by created_at desc, id limit p_limit offset p_offset) e join public.profiles p on p.id = e.owner_id));
end $$;

create or replace function public.admin_energy_award(p_ledger_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.energy_ledger;
begin
 if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 select * into e from public.energy_ledger where id = p_ledger_id;
 if not found then raise exception 'Award not found' using errcode='P0002'; end if;
 return private.energy_entry_json(e) || jsonb_build_object(
  'owner_name', (select display_name from public.profiles where id = e.owner_id),
  'reversal', (select private.energy_entry_json(r) || jsonb_build_object('created_by_name', p.display_name)
   from public.energy_ledger r left join public.profiles p on p.id = r.created_by where r.reverses_id = e.id),
  'flags', (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'status', f.status, 'reason', f.reason, 'created_at', f.created_at,
     'flagged_by_name', s.display_name, 'resolution_reason', f.resolution_reason, 'resolved_at', f.resolved_at,
     'resolved_by_name', r.display_name) order by f.created_at), '[]'::jsonb)
   from public.energy_flags f join public.profiles s on s.id = f.flagged_by left join public.profiles r on r.id = f.resolved_by
   where f.ledger_id = e.id),
  'audit', (select coalesce(jsonb_agg(jsonb_build_object('action', a.action, 'reason', a.reason, 'created_at', a.created_at,
     'actor_name', p.display_name) order by a.created_at), '[]'::jsonb)
   from public.admin_audit_logs a left join public.profiles p on p.id = a.actor_id
   where a.action in ('dismiss_energy_flag', 'reverse_energy_award') and a.new_values->>'ledger_id' = e.id::text));
end $$;

-- Activation from Settings. Pausing sets null; activating again starts a new boundary (no backfill).
create or replace function public.get_energy_settings() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare saved public.settings;
begin
 if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 select * into saved from public.settings where key = 'energy';
 return jsonb_build_object('active', private.energy_active(), 'activated_at', saved.value->'activated_at',
  'updated_at', saved.updated_at, 'updated_by_name', (select display_name from public.profiles where id = saved.updated_by));
end $$;

create or replace function public.set_energy_active(p_active boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
 if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_active is null then raise exception 'Choose on or off' using errcode='22023'; end if;
 if p_active and private.energy_active() then return public.get_energy_settings(); end if;
 insert into public.settings(key, value) values ('energy', jsonb_build_object('activated_at', case when p_active then to_jsonb(now()) else 'null'::jsonb end))
 on conflict (key) do update set value = excluded.value;
 return public.get_energy_settings();
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- Admin "Needs you": open energy flags (20261109000100 plus one field; member and moderator results unchanged).
create or replace function public.get_dashboard_summary() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid(); actor_role public.app_role := private.current_role(); summary jsonb;
begin
 if actor is null or actor_role is null then raise exception 'Active account required' using errcode='42501'; end if;
 if actor_role = 'user' then
  select jsonb_build_object(
   'traces',count(*) filter(where not is_hidden),
   'removed',count(*) filter(where is_hidden),
   'active_traces',count(*) filter(where status<>'rejected' and not is_hidden),
   'drafts',count(*) filter(where status='draft' and not is_hidden),
   'pending',count(*) filter(where status='pending' and not is_hidden),
   'approved',count(*) filter(where status='approved' and not is_hidden),
   'needs_revision',count(*) filter(where status='revision_requested' and not is_hidden),
   'comments_posted',(select count(*) from public.comments where author_id=actor),
   'tides_finished',(select count(*) from public.tide_completions where user_id=actor),
   'member_since',(select created_at from public.profiles where id=actor)
  ) into summary from public.traces where author_id=actor and deleted_at is null;
 elsif actor_role = 'moderator' then
  select jsonb_build_object(
   'pending',(select count(*) from public.traces where status='pending' and not is_hidden and deleted_at is null),
   'flagged_comments',(select count(distinct comment_id) from public.reports where status='open'),
   'open_reports',(select count(*) from public.reports where status='open'),
   'reviewed_today',(select count(*) from public.moderation_actions where actor_id=actor and action in ('review_trace','review_report') and created_at >= (date_trunc('day',now() at time zone 'Asia/Manila') at time zone 'Asia/Manila'))
  ) into summary;
 else
  select jsonb_build_object(
   'users',(select count(*) from public.profiles),
   'active_users',(select count(*) from public.profiles where status='active'),
   'moderators',(select count(*) from public.profiles where role='moderator' and status='active'),
   'published_traces',(select count(*) from public.traces where status='approved' and not is_hidden and deleted_at is null),
   'published_tides',(select count(*) from public.tides where status='published'),
   'pending',(select count(*) from public.traces where status='pending' and not is_hidden and deleted_at is null),
   'open_reports',(select count(*) from public.reports where status='open'),
   'held_traces',(select count(*) from public.trace_holds h join public.traces t on t.id=h.trace_id where t.status='pending' and not t.is_hidden and t.deleted_at is null),
   'oldest_pending_at',(select min(submitted_at) from public.traces where status='pending' and not is_hidden and deleted_at is null),
   'open_energy_flags',(select count(*) from public.energy_flags where status='open')
  ) into summary;
 end if;
 return summary || jsonb_build_object('id',actor,'role',actor_role,'as_of',now());
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- Function privileges: Supabase grants EXECUTE on new public functions by default, so revoke, then grant
-- only the intended calls. Private helpers are callable only from the definer functions above.
revoke all on function private.energy_ledger_append_only(), private.validate_energy_settings(), private.energy_active(),
 private.issue_award(uuid, public.energy_award_type, uuid), private.energy_source_title(public.energy_award_type, uuid),
 private.energy_entry_json(public.energy_ledger), private.quiz_retry_after(uuid, uuid) from public, anon, authenticated;
revoke all on function public.moderate_trace(uuid, integer, public.trace_state, text), public.complete_tide(uuid),
 public.get_tide_quiz(uuid), public.submit_tide_quiz(uuid, integer, smallint[]),
 public.admin_get_tide_quiz(uuid), public.admin_save_tide_quiz(uuid, integer, jsonb, boolean), public.admin_unpublish_tide_quiz(uuid, integer),
 public.get_energy_status(), public.get_my_energy(integer, integer, text),
 public.staff_energy_awards(uuid[]), public.flag_energy_award(uuid, text), public.staff_my_energy_flags(integer, integer),
 public.dismiss_energy_flag(uuid, text), public.reverse_energy_award(uuid, text),
 public.admin_energy_activity(integer, integer, text), public.admin_energy_award(uuid),
 public.get_energy_settings(), public.set_energy_active(boolean), public.get_dashboard_summary() from public, anon, authenticated;
grant execute on function public.moderate_trace(uuid, integer, public.trace_state, text), public.complete_tide(uuid),
 public.get_tide_quiz(uuid), public.submit_tide_quiz(uuid, integer, smallint[]),
 public.admin_get_tide_quiz(uuid), public.admin_save_tide_quiz(uuid, integer, jsonb, boolean), public.admin_unpublish_tide_quiz(uuid, integer),
 public.get_energy_status(), public.get_my_energy(integer, integer, text),
 public.staff_energy_awards(uuid[]), public.flag_energy_award(uuid, text), public.staff_my_energy_flags(integer, integer),
 public.dismiss_energy_flag(uuid, text), public.reverse_energy_award(uuid, text),
 public.admin_energy_activity(integer, integer, text), public.admin_energy_award(uuid),
 public.get_energy_settings(), public.set_energy_active(boolean), public.get_dashboard_summary() to authenticated;
commit;
