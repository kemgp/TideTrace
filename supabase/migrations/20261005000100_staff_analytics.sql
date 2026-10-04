-- All-time staff analytics, calculated over all saved rows (not paginated lists).
begin;
create or replace function public.get_staff_analytics() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid(); actor_role public.app_role := private.current_role(); payload jsonb;
begin
 if actor is null or actor_role is null or actor_role not in ('admin','moderator') then
  raise exception 'Staff access required' using errcode='42501';
 end if;
 with eligible as (
  select * from public.traces where deleted_at is null and not is_hidden and status<>'draft'
 ), category_counts as (
  select c.id,c.name,count(*) as total from eligible t join public.categories c on c.id=t.category_id group by c.id,c.name
 )
 select jsonb_build_object(
  'id',actor,'role',actor_role,'as_of',now(),
  'traces',(select count(*) from eligible),
  'approved',(select count(*) from eligible where status='approved'),
  'pending',(select count(*) from eligible where status='pending'),
  'rejected',(select count(*) from eligible where status='rejected'),
  'needs_revision',(select count(*) from eligible where status='revision_requested'),
  'categories',coalesce((select jsonb_agg(jsonb_build_object('id',id,'label',name,'value',total) order by total desc,name,id) from category_counts),'[]'::jsonb),
  'comments',(select count(*) from public.comments c join eligible t on t.id=c.trace_id where c.status='visible'),
  'completions',(select count(*) from public.tide_completions),
  'my_reviews',(select count(*) from public.moderation_actions where actor_id=actor and action='review_trace'),
  'my_report_decisions',(select count(*) from public.moderation_actions where actor_id=actor and action='review_report')
 ) into payload;
 if actor_role='admin' then
  payload := payload || jsonb_build_object(
   'users',(select count(*) from public.profiles),
   'active_users',(select count(*) from public.profiles where status='active'),
   'reviewers',coalesce((select jsonb_agg(jsonb_build_object('id',id,'label',display_name,'value',total) order by total desc,id) from (
    select p.id,p.display_name,count(*) as total from public.moderation_actions a join public.profiles p on p.id=a.actor_id
    where a.action='review_trace' group by p.id,p.display_name
   ) reviewers),'[]'::jsonb)
  );
 end if;
 return payload;
end $$;
revoke all on function public.get_staff_analytics() from public,anon,authenticated;
grant execute on function public.get_staff_analytics() to authenticated;
commit;
