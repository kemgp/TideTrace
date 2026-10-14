begin;

-- Existing profile RLS still decides whose public projection is readable.
grant select(avatar_path) on public.profiles to anon,authenticated;

create function private.published_author_photo(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(
  select 1 from public.profiles p where p.avatar_path=p_path and exists(
   select 1 from public.traces t where t.author_id=p.id and
    t.status='approved' and not t.is_hidden and t.deleted_at is null
  )
 )
$$;
revoke all on function private.published_author_photo(text) from public,anon,authenticated;
grant execute on function private.published_author_photo(text) to anon,authenticated;

-- Keep the bucket private. Only the current photo of a published author is
-- readable by other viewers; old and unattached uploads remain owner-only.
create policy tidetrace_published_author_photo_read on storage.objects
for select to anon,authenticated using(
 bucket_id='profile-photos' and private.published_author_photo(name)
);

commit;
