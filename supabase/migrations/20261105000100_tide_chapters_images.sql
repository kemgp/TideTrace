-- Chapters (a per-lesson "show in chapters" switch) and images placed inside lesson text.
-- Safe to rerun. Image files live in the private `tide-assets` bucket and are read through signed URLs.
begin;

alter table public.tides add column if not exists paged boolean not null default false;
grant insert(paged),update(paged) on public.tides to authenticated;

create table if not exists public.tide_images (
 id uuid primary key default gen_random_uuid(),
 tide_id uuid not null references public.tides(id) on delete cascade,
 object_path text not null unique,
 alt text not null check (length(btrim(alt)) between 1 and 200),
 created_at timestamptz not null default now()
);
create index if not exists tide_images_tide on public.tide_images(tide_id,created_at);
alter table public.tide_images enable row level security;
revoke all on public.tide_images from public,anon,authenticated;
grant select on public.tide_images to anon,authenticated;

-- Anyone can see the images of a published lesson; admins can see all (drafts too). Writes go through the functions below.
drop policy if exists tidetrace_tide_images_read on public.tide_images;
create policy tidetrace_tide_images_read on public.tide_images for select to anon,authenticated using(
 private.is_admin() or exists(select 1 from public.tides t where t.id=tide_id and t.status='published')
);

-- Storage: readable when the file is a published lesson's cover, slides or inline image (or the caller is an admin).
drop policy if exists tidetrace_tide_asset_read on storage.objects;
create policy tidetrace_tide_asset_read on storage.objects for select to anon,authenticated using(
 bucket_id='tide-assets' and (private.is_admin()
  or exists(select 1 from public.tides t where t.status='published' and name in (t.cover_path,t.slides_path))
  or exists(select 1 from public.tide_images i join public.tides t on t.id=i.tide_id where t.status='published' and i.object_path=name))
);

create or replace function public.add_tide_image(p_tide_id uuid,p_object_path text,p_alt text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare saved public.tide_images;
begin
 if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_alt is null or length(btrim(p_alt)) not between 1 and 200 then raise exception 'Describe the image in 1 to 200 characters' using errcode='P0001'; end if;
 if p_object_path is null or p_object_path !~ ('^'||p_tide_id::text||'/image-[0-9a-f-]{36}\.(jpg|png|webp)$') then
  raise exception 'Use an upload path returned for this lesson' using errcode='P0001';
 end if;
 if not exists(select 1 from storage.objects where bucket_id='tide-assets' and name=p_object_path and metadata->>'mimetype' in ('image/jpeg','image/png','image/webp')) then
  raise exception 'The uploaded file was not found' using errcode='P0001';
 end if;
 perform 1 from public.tides where id=p_tide_id for update;
 if not found then raise exception 'Record not found.' using errcode='PT404'; end if;
 if (select count(*) from public.tide_images where tide_id=p_tide_id)>=40 then raise exception 'A lesson can have up to 40 images' using errcode='P0001'; end if;
 insert into public.tide_images(tide_id,object_path,alt) values(p_tide_id,p_object_path,btrim(p_alt)) returning * into saved;
 return to_jsonb(saved);
end $$;

create or replace function public.remove_tide_image(p_image_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare removed public.tide_images;
begin
 if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 delete from public.tide_images where id=p_image_id returning * into removed;
 if not found then raise exception 'Record not found.' using errcode='PT404'; end if;
 return to_jsonb(removed);
end $$;

revoke all on function public.add_tide_image(uuid,text,text),public.remove_tide_image(uuid) from public,anon;
grant execute on function public.add_tide_image(uuid,text,text),public.remove_tide_image(uuid) to authenticated;

commit;
