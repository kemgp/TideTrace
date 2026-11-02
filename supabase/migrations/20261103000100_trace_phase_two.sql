begin;

-- Active authenticated members may delete their own visible comments.
create or replace function public.delete_own_comment(p_comment_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if private.current_role() is null then raise exception 'Active account required' using errcode='42501'; end if;
 perform 1 from public.comments c where c.id=p_comment_id and c.author_id=auth.uid() and c.status='visible'
  and exists(select 1 from public.traces t where t.id=c.trace_id and t.deleted_at is null) for update;
 if not found then raise exception 'Record not found.' using errcode='PT404'; end if;
 update public.comments set status='deleted',updated_at=now() where id=p_comment_id;
 update public.reports set status='resolved',resolution_reason='comment deleted',resolved_at=now(),resolved_by=null
  where comment_id=p_comment_id and status='open';
end $$;
revoke all on function public.delete_own_comment(uuid) from public,anon;
grant execute on function public.delete_own_comment(uuid) to authenticated;

-- Anonymous visitors and authenticated members may read public feed neighbors.
create or replace function public.trace_neighbors(p_trace_id uuid)
returns table(direction text,id uuid,title text)
language sql stable security definer set search_path='' as $$
 with current_trace as (
  select t.id,t.published_at from public.traces t where t.id=p_trace_id
   and t.status='approved' and not t.is_hidden and t.deleted_at is null and t.published_at is not null
 ), feed as (
  select t.id,t.title,t.published_at from public.traces t
   where t.status='approved' and not t.is_hidden and t.deleted_at is null and t.published_at is not null
 )
 (select 'newer'::text,t.id,t.title from feed t cross join current_trace c
  where t.published_at>c.published_at or (t.published_at=c.published_at and t.id<c.id)
  order by t.published_at asc,t.id desc limit 1)
 union all
 (select 'older'::text,t.id,t.title from feed t cross join current_trace c
  where t.published_at<c.published_at or (t.published_at=c.published_at and t.id>c.id)
  order by t.published_at desc,t.id asc limit 1)
$$;
revoke all on function public.trace_neighbors(uuid) from public;
grant execute on function public.trace_neighbors(uuid) to anon,authenticated;
commit;
