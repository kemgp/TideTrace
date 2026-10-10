-- Public aggregate counts only; no member identities or private records returned.
begin;
create or replace function public.get_community_summary() returns jsonb
language sql stable security definer set search_path='' as $$
 with published as (
  select author_id from public.traces where status='approved' and not is_hidden and deleted_at is null
 )
 select jsonb_build_object(
  'id','community',
  'published_traces',(select count(*) from published),
  'contributors',(select count(distinct author_id) from published),
  'published_tides',(select count(*) from public.tides where status='published'),
  'tides_completed',(select count(*) from public.tide_completions),
  'as_of',now()
 )
$$;
revoke all on function public.get_community_summary() from public,anon,authenticated;
grant execute on function public.get_community_summary() to anon,authenticated;
commit;
