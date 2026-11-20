-- Smaller copies of Trace photos (egress reduction, PR 1b). See docs/plans/egress-reduction-plan.md (E3).
-- thumb_path:   480 px WebP for cards, the map, the landing strip and list icons.
-- display_path: 1600 px WebP for the Trace page, made only for older photos stored without compression.
-- The original (object_path) is never changed: it stays the evidence as submitted.
-- Copies sit beside the original and share its file name: <name>.thumb.webp and <name>.display.webp.
begin;

alter table public.trace_media add column if not exists thumb_path text;
alter table public.trace_media add column if not exists display_path text;
create unique index if not exists trace_media_thumb_path on public.trace_media(thumb_path) where thumb_path is not null;
create unique index if not exists trace_media_display_path on public.trace_media(display_path) where display_path is not null;
alter table public.trace_media drop constraint if exists trace_media_copy_paths;
alter table public.trace_media add constraint trace_media_copy_paths check (
 (thumb_path is null or thumb_path = regexp_replace(object_path, '\.[a-z0-9]+$', '') || '.thumb.webp') and
 (display_path is null or display_path = regexp_replace(object_path, '\.[a-z0-9]+$', '') || '.display.webp')
);

-- Trace uploads are capped at 8 MB (API and bucket) since photos are compressed in the browser and videos
-- are not. Tighten the table check too, unless an older row is already bigger.
update storage.buckets set file_size_limit = 8388608 where id = 'trace-media';
do $$
begin
 if not exists (select 1 from public.trace_media where size_bytes > 8388608) then
  alter table public.trace_media drop constraint if exists trace_media_size_bytes_check;
  alter table public.trace_media add constraint trace_media_size_bytes_check check (size_bytes between 1 and 8388608);
 end if;
end $$;

-- The author attaches the thumbnail of a photo on their own editable draft. The file must already be
-- uploaded beside the original as a small WebP owned by the caller. The Trace version does not change:
-- a thumbnail changes nothing the author or a reviewer reads, and a bump would stale the open draft form.
create or replace function public.set_trace_media_thumb(p_media_id uuid, p_thumb_path text)
returns public.trace_media language plpgsql security definer set search_path = '' as $$
declare m public.trace_media; t public.traces; object_metadata jsonb;
begin
 select * into m from public.trace_media where id = p_media_id for update;
 if not found then raise exception 'Record not found.' using errcode = 'PT404'; end if;
 select * into t from public.traces where id = m.trace_id;
 if private.current_role() is null or t.author_id <> auth.uid() or t.status not in ('draft', 'revision_requested') or t.is_hidden or t.deleted_at is not null then
  raise exception 'Submission is not editable' using errcode = '42501';
 end if;
 if m.mime_type not like 'image/%' or p_thumb_path is distinct from regexp_replace(m.object_path, '\.[a-z0-9]+$', '') || '.thumb.webp' then
  raise exception 'Invalid thumbnail path' using errcode = '22023';
 end if;
 select metadata into object_metadata from storage.objects
  where bucket_id = 'trace-media' and name = p_thumb_path and owner_id = auth.uid()::text;
 if not found then raise exception 'Upload the thumbnail before attaching it' using errcode = '22023'; end if;
 if object_metadata->>'mimetype' is distinct from 'image/webp' or coalesce((object_metadata->>'size')::bigint, 0) not between 1 and 524288 then
  raise exception 'Thumbnails must be WebP images up to 512 KB' using errcode = '22023';
 end if;
 update public.trace_media set thumb_path = p_thumb_path where id = m.id returning * into m;
 return m;
end $$;
revoke all on function public.set_trace_media_thumb(uuid, text) from public, anon, authenticated;
grant execute on function public.set_trace_media_thumb(uuid, text) to authenticated;

-- Copies are readable by exactly the people who can read the original.
drop policy if exists tidetrace_media_read on storage.objects;
create policy tidetrace_media_read on storage.objects for select to anon, authenticated using (
 bucket_id = 'trace-media' and exists (
  select 1 from public.trace_media m
  where (m.object_path = name or m.thumb_path = name or m.display_path = name) and private.can_read_trace(m.trace_id)
 )
);

commit;
