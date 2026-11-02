-- Lesson summary, topic, cover image and PDF slides for Tides.
-- Safe to rerun. Files live in the private `tide-assets` bucket and are read through signed URLs.
begin;

alter table public.tides
 add column if not exists summary text not null default '' check (length(summary) <= 300),
 add column if not exists category_id uuid references public.categories(id),
 add column if not exists cover_path text,
 add column if not exists slides_path text,
 add column if not exists slides_pages integer check (slides_pages between 1 and 500);
create index if not exists tides_published_category on public.tides(category_id) where status='published';

-- Admins edit the summary and topic like the other lesson fields. File paths are set only by the functions below.
grant insert(summary,category_id),update(summary,category_id) on public.tides to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('tide-assets','tide-assets',false,26214400,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set
 public=excluded.public,
 file_size_limit=excluded.file_size_limit,
 allowed_mime_types=excluded.allowed_mime_types;

-- Anyone can read the files of a published lesson; admins can read everything (for previews of drafts).
drop policy if exists tidetrace_tide_asset_read on storage.objects;
create policy tidetrace_tide_asset_read on storage.objects for select to anon,authenticated using(
 bucket_id='tide-assets' and (private.is_admin() or exists(
  select 1 from public.tides t where t.status='published' and name in (t.cover_path,t.slides_path)))
);
-- Only admins upload, and only into the folder of an existing lesson.
drop policy if exists tidetrace_tide_asset_upload on storage.objects;
create policy tidetrace_tide_asset_upload on storage.objects for insert to authenticated with check(
 bucket_id='tide-assets' and private.is_admin() and owner_id=auth.uid()::text and
 exists(select 1 from public.tides t where t.id::text=(storage.foldername(name))[1])
);
drop policy if exists tidetrace_tide_asset_delete on storage.objects;
create policy tidetrace_tide_asset_delete on storage.objects for delete to authenticated using(
 bucket_id='tide-assets' and private.is_admin()
);

-- Attach an uploaded file to a lesson. Returns the updated lesson and the file it replaced so the caller can remove it.
create or replace function public.set_tide_asset(p_tide_id uuid,p_kind text,p_object_path text,p_pages integer default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare previous text; saved public.tides; mimes text[];
begin
 if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_kind is null or p_kind not in ('cover','slides') then raise exception 'Choose cover or slides' using errcode='P0001'; end if;
 mimes := case when p_kind='cover' then array['image/jpeg','image/png','image/webp'] else array['application/pdf'] end;
 if p_object_path is null or p_object_path !~ ('^'||p_tide_id::text||'/'||p_kind||'-[0-9a-f-]{36}\.(jpg|png|webp|pdf)$') then
  raise exception 'Use an upload path returned for this lesson' using errcode='P0001';
 end if;
 if not exists(select 1 from storage.objects where bucket_id='tide-assets' and name=p_object_path and metadata->>'mimetype'=any(mimes)) then
  raise exception 'The uploaded file was not found' using errcode='P0001';
 end if;
 if p_kind='slides' and (p_pages is null or p_pages not between 1 and 500) then
  raise exception 'Enter the number of pages (1 to 500)' using errcode='P0001';
 end if;
 select case when p_kind='cover' then cover_path else slides_path end into previous from public.tides where id=p_tide_id for update;
 if not found then raise exception 'Record not found.' using errcode='PT404'; end if;
 if p_kind='cover' then
  update public.tides set cover_path=p_object_path where id=p_tide_id returning * into saved;
 else
  update public.tides set slides_path=p_object_path,slides_pages=p_pages where id=p_tide_id returning * into saved;
 end if;
 return jsonb_build_object('tide',to_jsonb(saved),'previous_path',previous);
end $$;

-- Remove the cover or slides from a lesson. The file itself is removed by the caller.
create or replace function public.clear_tide_asset(p_tide_id uuid,p_kind text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare previous text; saved public.tides;
begin
 if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_kind is null or p_kind not in ('cover','slides') then raise exception 'Choose cover or slides' using errcode='P0001'; end if;
 select case when p_kind='cover' then cover_path else slides_path end into previous from public.tides where id=p_tide_id for update;
 if not found then raise exception 'Record not found.' using errcode='PT404'; end if;
 if p_kind='cover' then
  update public.tides set cover_path=null where id=p_tide_id returning * into saved;
 else
  update public.tides set slides_path=null,slides_pages=null where id=p_tide_id returning * into saved;
 end if;
 return jsonb_build_object('tide',to_jsonb(saved),'previous_path',previous);
end $$;

revoke all on function public.set_tide_asset(uuid,text,text,integer),public.clear_tide_asset(uuid,text) from public,anon;
grant execute on function public.set_tide_asset(uuid,text,text,integer),public.clear_tide_asset(uuid,text) to authenticated;

commit;
