begin;

create or replace function private.can_read_trace(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.traces where id=p_id and (
  private.is_staff() or (deleted_at is null and (
   (status='approved' and not is_hidden) or
   (author_id=auth.uid() and private.current_role() is not null)))))
$$;

create or replace function public.get_trace_private_location(p_id uuid)
returns table(latitude numeric,longitude numeric) language plpgsql stable security definer set search_path='' as $$
begin
 if private.current_role() is null or not exists (
  select 1 from public.traces t where t.id=p_id and
   (private.is_staff() or (t.author_id=auth.uid() and t.deleted_at is null))
 ) then raise exception 'Location access denied' using errcode='42501'; end if;
 return query select l.latitude,l.longitude from private.trace_locations l where l.trace_id=p_id;
end $$;

-- Also includes detached uploads: deleting a Trace must remove all its photos.
create or replace function public.deleted_trace_media(p_trace_id uuid) returns table(object_path text)
language plpgsql stable security definer set search_path='' as $$
begin
 if private.current_role() is null then raise exception 'Active account required' using errcode='42501'; end if;
 if not exists(select 1 from public.traces where id=p_trace_id and author_id=auth.uid() and deleted_at is not null) then
  raise exception 'Record not found.' using errcode='PT404';
 end if;
 return query select o.name from storage.objects o where o.bucket_id='trace-media'
  and split_part(o.name,'/',1)=auth.uid()::text and split_part(o.name,'/',2)=p_trace_id::text;
end $$;

-- Photos still in storage for any of the caller's deleted Traces (used to finish an interrupted cleanup).
create or replace function public.deleted_trace_media_pending() returns table(object_path text)
language plpgsql stable security definer set search_path='' as $$
begin
 if private.current_role() is null then raise exception 'Active account required' using errcode='42501'; end if;
 return query select o.name from storage.objects o where o.bucket_id='trace-media'
  and split_part(o.name,'/',1)=auth.uid()::text
  and exists(select 1 from public.traces t where t.id::text=split_part(o.name,'/',2) and t.author_id=auth.uid() and t.deleted_at is not null);
end $$;

create or replace function public.delete_own_trace(p_trace_id uuid) returns table(object_path text)
language plpgsql security definer set search_path='' as $$
begin
 if private.current_role() is null then raise exception 'Active account required' using errcode='42501'; end if;
 perform 1 from public.traces where id=p_trace_id and author_id=auth.uid() and deleted_at is null for update;
 if not found then raise exception 'Record not found.' using errcode='PT404'; end if;
 update public.traces set deleted_at=now(),version=version+1 where id=p_trace_id;
 update public.comments set status='hidden' where trace_id=p_trace_id and status='visible';
 update public.reports set status='resolved',resolution_reason='trace deleted',resolved_at=now(),resolved_by=null
 where status='open' and (trace_id=p_trace_id or comment_id in (select id from public.comments where trace_id=p_trace_id));
 return query select * from public.deleted_trace_media(p_trace_id);
end $$;

-- Storage API removal needs SELECT as well as DELETE. Limit cleanup to the
-- active author of a deleted Trace; no service-role key or direct object SQL deletion.
create or replace function private.can_delete_trace_media(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select private.current_role() is not null and split_part(p_path,'/',1)=auth.uid()::text
  and exists(select 1 from public.traces where id::text=split_part(p_path,'/',2)
   and author_id=auth.uid() and deleted_at is not null)
$$;
revoke all on function private.can_delete_trace_media(text) from public,anon,authenticated;
grant execute on function private.can_delete_trace_media(text) to authenticated;
drop policy if exists tidetrace_deleted_media_read on storage.objects;
create policy tidetrace_deleted_media_read on storage.objects for select to authenticated using(
 bucket_id='trace-media' and private.can_delete_trace_media(name)
);
drop policy if exists tidetrace_deleted_media_cleanup on storage.objects;
create policy tidetrace_deleted_media_cleanup on storage.objects for delete to authenticated using(
 bucket_id='trace-media' and private.can_delete_trace_media(name)
);

revoke all on function public.delete_own_trace(uuid),public.deleted_trace_media(uuid),public.deleted_trace_media_pending() from public,anon,authenticated;
grant execute on function public.delete_own_trace(uuid),public.deleted_trace_media(uuid),public.deleted_trace_media_pending() to authenticated;
commit;
