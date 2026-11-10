#!/usr/bin/env bash
# Tide Energy under real concurrency: many sessions hit the same award at the same moment and exactly one wins.
#
# Needs a DISPOSABLE Postgres database with every migration applied and Supabase's auth schema and roles,
# for example the local `supabase start` database. The fixtures are committed and cannot be removed (the ledger
# is append-only), so reset the database afterwards (`supabase db reset`). Never point this at staging or production.
#
#   TT_DISPOSABLE_DB=yes DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres supabase/tests/energy-concurrency.sh
#
# Needs psql. PGlite (local-check.mjs) is single-connection, so it cannot run these.
set -euo pipefail

if [ "${TT_DISPOSABLE_DB:-}" != yes ]; then
 echo "Refusing to run: set TT_DISPOSABLE_DB=yes and point DATABASE_URL at a disposable database." >&2
 exit 2
fi
: "${DATABASE_URL:?Set DATABASE_URL to the disposable database}"
N=${N:-8}
GATE=731942
OUT=$(mktemp -d)
trap 'rm -rf "$OUT"' EXIT
FAILED=0

q() { psql "$DATABASE_URL" -X -q -At -v ON_ERROR_STOP=1 "$@"; }
uuid() { q -c "select gen_random_uuid()"; }

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1" >&2; FAILED=1; }
expect() { # expect <label> <actual> <wanted>
 if [ "$2" = "$3" ]; then pass "$1"; else fail "$1 (got $2, wanted $3)"; fi
}

# race <name> <sql> <sub>...: runs one session per sub, all released at the same moment.
race() {
 local name=$1 sql=$2; shift 2
 rm -f "$OUT/$name".*
 psql "$DATABASE_URL" -X -q -At -c "select pg_advisory_lock($GATE)" -c "select pg_sleep(1.5)" >/dev/null &
 local gate=$!
 sleep 0.5
 local i=0 pids=()
 for sub in "$@"; do
  i=$((i+1))
  psql "$DATABASE_URL" -X -q -At -v VERBOSITY=verbose \
   -c "select pg_advisory_lock_shared($GATE)" -c "set role authenticated" \
   -c "select set_config('request.jwt.claim.sub','$sub',false)" -c "$sql" >"$OUT/$name.$i" 2>&1 &
  pids+=($!)
 done
 wait "$gate"
 for p in "${pids[@]}"; do wait "$p" || true; done
}
count() { grep -l -- "$2" "$OUT/$1".* 2>/dev/null | wc -l | tr -d ' '; }

MEMBER=$(uuid); MOD1=$(uuid); MOD2=$(uuid); ADMIN1=$(uuid); ADMIN2=$(uuid)
TRACE=$(uuid); QUIZ_TIDE=$(uuid); LESSON=$(uuid); RUN=${MEMBER:0:8}

q >/dev/null <<SQL
insert into auth.users(id,email,raw_user_meta_data) values
 ('$MEMBER','race-member-$RUN@example.invalid','{}'),('$MOD1','race-mod1-$RUN@example.invalid','{}'),
 ('$MOD2','race-mod2-$RUN@example.invalid','{}'),('$ADMIN1','race-admin1-$RUN@example.invalid','{}'),
 ('$ADMIN2','race-admin2-$RUN@example.invalid','{}');
update public.profiles set role='moderator' where id in ('$MOD1','$MOD2');
update public.profiles set role='admin' where id in ('$ADMIN1','$ADMIN2');
insert into public.traces(id,author_id,category_id,title,description,location_name,status,submitted_at)
 values ('$TRACE','$MEMBER',(select id from public.categories order by name limit 1),'Race fixture','Observation','Coast','pending',now());
insert into public.tides(id,author_id,title,slug,body,status) values
 ('$QUIZ_TIDE','$ADMIN1','Race quiz','race-quiz-$RUN','Text','published'),
 ('$LESSON','$ADMIN1','Race lesson','race-lesson-$RUN','Text','published');
set role authenticated;
select set_config('request.jwt.claim.sub','$ADMIN1',false);
select public.set_energy_active(true);
select public.admin_save_tide_quiz('$QUIZ_TIDE',null,(select jsonb_agg(jsonb_build_object('prompt','Q'||p,
 'options',jsonb_build_array('a','b','c','d'),'correct',0,'explanation','Because')) from generate_series(1,5) p),true);
select set_config('request.jwt.claim.sub','$MEMBER',false);
select public.complete_tide('$QUIZ_TIDE');
SQL

members=(); mods=(); admins=()
for _ in $(seq "$N"); do members+=("$MEMBER"); done
for i in $(seq "$N"); do if [ $((i%2)) = 0 ]; then mods+=("$MOD1"); admins+=("$ADMIN1"); else mods+=("$MOD2"); admins+=("$ADMIN2"); fi; done

# 1. Quiz: parallel correct submissions. One passes and awards; the rest hit the cooldown.
race quiz "select public.submit_tide_quiz('$QUIZ_TIDE',1,'{0,0,0,0,0}')" "${members[@]}"
expect "quiz: one submission passes" "$(count quiz '"passed": true')" 1
expect "quiz: the rest wait for the cooldown" "$(count quiz 'TT429')" $((N-1))
expect "quiz: one award" "$(q -c "select count(*) from public.energy_ledger where owner_id='$MEMBER' and award_type='quiz_pass'")" 1
expect "quiz: one pass row" "$(q -c "select count(*) from public.tide_quiz_passes where user_id='$MEMBER'")" 1
expect "quiz: one attempt recorded" "$(q -c "select count(*) from private.tide_quiz_attempts where user_id='$MEMBER'")" 1

# 2. Lesson completion: parallel completions. One completion row, one award.
race lesson "select public.complete_tide('$LESSON')" "${members[@]}"
expect "lesson: one call awards" "$(count lesson '"awarded": true')" 1
expect "lesson: no errors" "$(count lesson 'ERROR')" 0
expect "lesson: one award" "$(q -c "select count(*) from public.energy_ledger where owner_id='$MEMBER' and award_type='tide_completion' and source_id='$LESSON'")" 1

# 3. Approval: two moderators approve the same Trace at once. One decision, one award, one notification.
race approve "select (public.moderate_trace('$TRACE',1,'approved')).status" "${mods[@]}"
expect "approve: one decision" "$(count approve '^approved$')" 1
expect "approve: one award" "$(q -c "select count(*) from public.energy_ledger where award_type='trace_approval' and source_id='$TRACE'")" 1
expect "approve: one notification" "$(q -c "select count(*) from public.notifications where recipient_id='$MEMBER' and type='trace_review'")" 1
AWARD=$(q -c "select id from public.energy_ledger where award_type='trace_approval' and source_id='$TRACE'")

# 4. Flags: both moderators flag the same award at once. One open flag.
race flag "select (public.flag_energy_award('$AWARD','Race flag')).status" "${mods[@]}"
expect "flag: one flag raised" "$(count flag '^open$')" 1
expect "flag: the rest are told it is already flagged" "$(count flag '23505')" $((N-1))
expect "flag: one open flag" "$(q -c "select count(*) from public.energy_flags where ledger_id='$AWARD' and status='open'")" 1

# 5. Reversal: both admins reverse the same award at once. One reversal; the flag is upheld once.
race reverse "select (public.reverse_energy_award('$AWARD','Race reversal')).amount" "${admins[@]}"
expect "reverse: one reversal" "$(count reverse '^-20$')" 1
expect "reverse: one ledger row" "$(q -c "select count(*) from public.energy_ledger where reverses_id='$AWARD'")" 1
expect "reverse: one member notice" "$(q -c "select count(*) from public.notifications where recipient_id='$MEMBER' and type='energy_reversal'")" 1
expect "reverse: flag upheld" "$(q -c "select string_agg(status::text,',') from public.energy_flags where ledger_id='$AWARD'")" upheld
expect "reverse: balance (5 + 15 + 5 + 20 - 20)" "$(q -c "select sum(amount) from public.energy_ledger where owner_id='$MEMBER'")" 25

if [ "$FAILED" != 0 ]; then
 echo "Session output kept in: $OUT" >&2
 trap - EXIT
 exit 1
fi
echo "Energy concurrency checks passed ($N sessions per race)."
