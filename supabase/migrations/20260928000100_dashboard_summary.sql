-- Aggregate all rows, independent of API pagination. No existing data is changed.
begin;
create or replace function public.get_dashboard_summary() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid(); actor_role public.app_role := private.current_role(); summary jsonb;
begin
 if actor is null or actor_role is null then raise exception 'Active account required' using errcode='42501'; end if;
 if actor_role = 'user' then
  select jsonb_build_object(
   'traces',count(*),
   'drafts',count(*) filter(where status='draft'),
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
   'open_reports',(select count(*) from public.reports where status='open')
  ) into summary;
 end if;
 return summary || jsonb_build_object('id',actor,'role',actor_role,'as_of',now());
end $$;
revoke all on function public.get_dashboard_summary() from public,anon,authenticated;
grant execute on function public.get_dashboard_summary() to authenticated;
commit;
