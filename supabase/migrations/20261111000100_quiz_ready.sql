-- Member dashboard card: the finished lesson whose quiz is waiting, or one passed in the last three days.
-- Reads only the caller's own completions, passes and ledger rows. Changes no data. Safe to reapply.
-- state: 'ready' (finished, quiz published, not passed), 'done' (passed in the last 3 days) or 'none'.
begin;

create or replace function public.get_quiz_ready() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid(); pick record;
begin
 if actor is null or private.current_role() is null then raise exception 'Active account required' using errcode='42501'; end if;
 select t.id, t.title, (p.user_id is not null) as passed into pick
 from public.tide_completions c
 join public.tides t on t.id = c.tide_id and t.status = 'published'
 join public.tide_quizzes q on q.tide_id = t.id and q.status = 'published'
 left join public.tide_quiz_passes p on p.user_id = c.user_id and p.tide_id = t.id
 where c.user_id = actor and (p.user_id is null or p.first_passed_at > now() - interval '3 days')
 order by (p.user_id is null) desc, coalesce(p.first_passed_at, c.completed_at) desc
 limit 1;
 if not found then return jsonb_build_object('state', 'none'); end if;
 return jsonb_build_object('state', case when pick.passed then 'done' else 'ready' end,
  'tide_id', pick.id, 'title', pick.title, 'active', private.energy_active(),
  'earned', (select coalesce(sum(l.amount), 0)::integer from public.energy_ledger l
    where l.owner_id = actor and l.source_id = pick.id and l.award_type in ('tide_completion', 'quiz_pass')
    and not exists (select 1 from public.energy_ledger r where r.reverses_id = l.id)));
end $$;

revoke all on function public.get_quiz_ready() from public, anon, authenticated;
grant execute on function public.get_quiz_ready() to authenticated;
commit;
