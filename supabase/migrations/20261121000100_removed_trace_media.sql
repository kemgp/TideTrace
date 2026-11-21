-- Removed Trace photos (egress plan Phase 2). Removing a photo from a Trace used to delete only its row,
-- leaving the file and its copies in Storage. Now each removed file is recorded with the time it may be
-- deleted ("delete_after"):
--   * removed from a draft that was never submitted: now (nobody else has seen it);
--   * removed while revising a submitted Trace: kept for staff (they reviewed it) until the Trace gets its
--     final decision, then for private.removed_photo_keep() (30 days) after that decision.
-- Files that are due are deleted through the Storage API with the author's own token: right after the
-- removal, and again whenever the author opens My Contributions. No service key or scheduled job is used.
-- A removed path can never be attached again. Deleting the whole Trace still removes its folder as before.
begin;

create table if not exists private.retired_trace_media (
 object_path text primary key,
 owner_id uuid not null references public.profiles(id),
 trace_id uuid not null,
 media_id uuid not null,
 kind text not null check (kind in ('original', 'thumb', 'display')),
 mime_type text not null,
 retired_at timestamptz not null default now(),
 delete_after timestamptz
);
create index if not exists retired_trace_media_owner_due on private.retired_trace_media(owner_id, delete_after);
create index if not exists retired_trace_media_trace on private.retired_trace_media(trace_id);
revoke all on private.retired_trace_media from public, anon, authenticated;

-- How long a photo removed during a revision stays visible to staff after the Trace's final decision.
create or replace function private.removed_photo_keep() returns interval
language sql immutable set search_path = '' as $$ select interval '30 days' $$;

create or replace function public.detach_trace_media(p_media_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare t public.traces; m public.trace_media;
begin
 select * into m from public.trace_media where id = p_media_id;
 select * into t from public.traces where id = m.trace_id for update;
 if not found or private.current_role() is null or t.author_id <> auth.uid() or t.status not in ('draft', 'revision_requested') or t.is_hidden or t.deleted_at is not null then
  raise exception 'Submission is not editable' using errcode = '42501';
 end if;
 insert into private.retired_trace_media(object_path, owner_id, trace_id, media_id, kind, mime_type, delete_after)
 select p.path, t.author_id, t.id, m.id, p.kind, case when p.kind = 'original' then m.mime_type else 'image/webp' end,
        case when t.submitted_at is null then now() else null end
 from (values (m.object_path, 'original'), (m.thumb_path, 'thumb'), (m.display_path, 'display')) as p(path, kind)
 where p.path is not null
 on conflict (object_path) do nothing;
 delete from public.trace_media where id = p_media_id;
 update public.traces set version = version + 1 where id = t.id;
end $$;

-- A removed path cannot come back: re-attaching it could leave a file that is also due for deletion.
create or replace function public.attach_trace_media(p_trace_id uuid, p_object_path text, p_sort_order integer default 0)
returns public.trace_media language plpgsql security definer set search_path = '' as $$
declare t public.traces; m public.trace_media; object_metadata jsonb;
begin
 select * into t from public.traces where id = p_trace_id for update;
 if not found or private.current_role() is null or t.author_id <> auth.uid() or
  t.status not in ('draft', 'revision_requested') or t.is_hidden or t.deleted_at is not null then
  raise exception 'Submission is not editable' using errcode = '42501';
 end if;
 if split_part(p_object_path, '/', 1) <> auth.uid()::text or split_part(p_object_path, '/', 2) <> p_trace_id::text then
  raise exception 'Invalid media path';
 end if;
 if exists (select 1 from private.retired_trace_media where object_path = p_object_path) then
  raise exception 'This photo was removed. Upload it again.' using errcode = '22023';
 end if;
 select metadata into object_metadata from storage.objects where bucket_id = 'trace-media' and name = p_object_path and owner_id = auth.uid()::text;
 if not found then raise exception 'Upload the file before attaching it'; end if;
 insert into public.trace_media(trace_id, object_path, mime_type, size_bytes, sort_order)
 values (p_trace_id, p_object_path, object_metadata->>'mimetype', (object_metadata->>'size')::bigint, p_sort_order)
 returning * into m;
 update public.traces set version = version + 1 where id = p_trace_id;
 return m;
end $$;

-- The final decision starts the clock for photos kept during a revision.
create or replace function private.schedule_removed_photos() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 update private.retired_trace_media set delete_after = now() + private.removed_photo_keep()
 where trace_id = new.id and delete_after is null;
 return null;
end $$;
drop trigger if exists schedule_removed_photos on public.traces;
create trigger schedule_removed_photos after update of status on public.traces
 for each row when (new.status in ('approved', 'rejected') and old.status is distinct from new.status)
 execute function private.schedule_removed_photos();

-- The caller's removed files that are due and still stored (at most 100 per call).
create or replace function public.removed_trace_media_due() returns table(object_path text)
language plpgsql stable security definer set search_path = '' as $$
begin
 if private.current_role() is null then raise exception 'Active account required' using errcode = '42501'; end if;
 return query select r.object_path from private.retired_trace_media r
  where r.owner_id = auth.uid() and r.delete_after <= now()
   and exists (select 1 from storage.objects o where o.bucket_id = 'trace-media' and o.name = r.object_path)
  order by r.retired_at, r.object_path limit 100;
end $$;

-- Staff: photos removed from this Trace during a revision that are still kept.
create or replace function public.staff_removed_trace_media(p_trace_id uuid)
returns table(media_id uuid, object_path text, thumb_path text, mime_type text, retired_at timestamptz, delete_after timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
 if not private.is_staff() then raise exception 'Staff access required' using errcode = '42501'; end if;
 return query select o.media_id, o.object_path, th.object_path, o.mime_type, o.retired_at, o.delete_after
  from private.retired_trace_media o
  left join private.retired_trace_media th on th.media_id = o.media_id and th.kind = 'thumb'
  where o.trace_id = p_trace_id and o.kind = 'original' and (o.delete_after is null or o.delete_after > now())
   and exists (select 1 from storage.objects s where s.bucket_id = 'trace-media' and s.name = o.object_path)
  order by o.retired_at, o.object_path;
end $$;

create or replace function private.can_delete_removed_media(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
 select private.current_role() is not null and exists (
  select 1 from private.retired_trace_media r where r.object_path = p_path and r.owner_id = auth.uid() and r.delete_after <= now())
$$;
create or replace function private.can_staff_read_kept_media(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
 select private.is_staff() and exists (
  select 1 from private.retired_trace_media r where r.object_path = p_path and (r.delete_after is null or r.delete_after > now()))
$$;
revoke all on function private.can_delete_removed_media(text), private.can_staff_read_kept_media(text), private.removed_photo_keep() from public, anon, authenticated;
grant execute on function private.can_delete_removed_media(text), private.can_staff_read_kept_media(text), private.removed_photo_keep() to authenticated;
revoke all on function public.removed_trace_media_due(), public.staff_removed_trace_media(uuid), private.schedule_removed_photos() from public, anon, authenticated;
grant execute on function public.removed_trace_media_due(), public.staff_removed_trace_media(uuid) to authenticated;

-- Storage removal needs SELECT as well as DELETE: the author for due files, staff to view kept ones.
drop policy if exists tidetrace_removed_media_read on storage.objects;
create policy tidetrace_removed_media_read on storage.objects for select to authenticated using (
 bucket_id = 'trace-media' and (private.can_delete_removed_media(name) or private.can_staff_read_kept_media(name))
);
drop policy if exists tidetrace_removed_media_cleanup on storage.objects;
create policy tidetrace_removed_media_cleanup on storage.objects for delete to authenticated using (
 bucket_id = 'trace-media' and private.can_delete_removed_media(name)
);

commit;
