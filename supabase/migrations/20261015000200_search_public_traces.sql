begin;
-- Invoker permissions preserve RLS; explicit visibility also restricts staff searches.
create or replace function public.search_public_traces(p_query text)
returns setof public.traces
language sql stable security invoker set search_path='' as $$
 select t.* from public.traces t
 where t.status='approved' and not t.is_hidden and t.deleted_at is null
 and length(btrim(p_query)) between 1 and 200
 and (
  strpos(lower(t.title),lower(btrim(p_query)))>0
  or strpos(lower(t.description),lower(btrim(p_query)))>0
  or strpos(lower(t.location_name),lower(btrim(p_query)))>0
  or exists(select 1 from public.profiles p where p.id=t.author_id
    and strpos(lower(p.display_name),lower(btrim(p_query)))>0)
 )
$$;
revoke all on function public.search_public_traces(text) from public;
grant execute on function public.search_public_traces(text) to anon,authenticated;
commit;
