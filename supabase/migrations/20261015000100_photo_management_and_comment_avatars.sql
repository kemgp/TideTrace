-- Safe to rerun. Storage bytes are deleted only through the Storage API.
begin;
create table if not exists private.retired_profile_photos (
 object_path text primary key,
 owner_id uuid not null,
 retired_at timestamptz not null default now()
);
revoke all on private.retired_profile_photos from public,anon,authenticated;

create or replace function private.profile_photo_retired(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.retired_profile_photos where object_path=p_path)
$$;
create or replace function private.can_delete_profile_photo(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select private.current_role() is not null and exists(
  select 1 from private.retired_profile_photos where object_path=p_path and owner_id=auth.uid()
 ) and not exists(select 1 from public.profiles where avatar_path=p_path)
$$;
revoke all on function private.profile_photo_retired(text),private.can_delete_profile_photo(text) from public,anon,authenticated;
grant execute on function private.profile_photo_retired(text),private.can_delete_profile_photo(text) to authenticated;

drop policy if exists tidetrace_avatar_upload on storage.objects;
create policy tidetrace_avatar_upload on storage.objects for insert to authenticated with check(
 bucket_id='profile-photos' and private.current_role() is not null and
 owner_id=auth.uid()::text and (storage.foldername(name))[1]=auth.uid()::text
 and not private.profile_photo_retired(name)
);
drop policy if exists tidetrace_avatar_cleanup on storage.objects;
create policy tidetrace_avatar_cleanup on storage.objects for delete to authenticated using(
 bucket_id='profile-photos' and owner_id=auth.uid()::text and private.can_delete_profile_photo(name)
);

create or replace function public.set_profile_photo(p_object_path text) returns public.profiles
language plpgsql security definer set search_path='' as $$
declare saved public.profiles;
begin
 -- Serialize attachment, removal and retirement for the same account.
 select * into saved from public.profiles where id=auth.uid() for update;
 if saved.id is null or saved.status<>'active' then raise exception 'Active account required' using errcode='42501'; end if;
 if p_object_path is null or split_part(p_object_path,'/',1)<>auth.uid()::text or
 private.profile_photo_retired(p_object_path) or
 not exists(select 1 from storage.objects where bucket_id='profile-photos' and name=p_object_path
  and owner_id=auth.uid()::text and metadata->>'mimetype' in ('image/jpeg','image/png','image/webp')
  and (metadata->>'size')::bigint between 1 and 5242880)
 then raise exception 'Upload a new profile photo to your own account first' using errcode='42501'; end if;
 update public.profiles set avatar_path=p_object_path where id=auth.uid() returning * into saved;
 return saved;
end $$;
create or replace function public.remove_profile_photo() returns public.profiles
language plpgsql security definer set search_path='' as $$
declare saved public.profiles;
begin
 select * into saved from public.profiles where id=auth.uid() for update;
 if saved.id is null or saved.status<>'active' then raise exception 'Active account required' using errcode='42501'; end if;
 update public.profiles set avatar_path=null where id=auth.uid() returning * into saved;
 return saved;
end $$;

create or replace function public.claim_profile_photo_cleanup() returns table(object_path text)
language plpgsql security definer set search_path='' as $$
declare saved public.profiles;
begin
 select * into saved from public.profiles where id=auth.uid() for update;
 if saved.id is null or saved.status<>'active' then raise exception 'Active account required' using errcode='42501'; end if;
 -- Age protects recent uploads not yet attached. Tombstones prevent a delayed
 -- attachment from reviving an object after cleanup selected it for deletion.
 insert into private.retired_profile_photos(object_path,owner_id)
 select o.name,auth.uid() from storage.objects o
 where o.bucket_id='profile-photos' and o.owner_id=auth.uid()::text
  and split_part(o.name,'/',1)=auth.uid()::text
  and o.created_at < now()-interval '24 hours'
  and not exists(select 1 from public.profiles p where p.avatar_path=o.name)
 order by o.created_at,o.name limit 100
 on conflict do nothing;
 return query select o.name from storage.objects o
 join private.retired_profile_photos r on r.object_path=o.name and r.owner_id=auth.uid()
 where o.bucket_id='profile-photos' and o.owner_id=auth.uid()::text
  and not exists(select 1 from public.profiles p where p.avatar_path=o.name)
 order by o.name limit 100;
end $$;
revoke all on function public.set_profile_photo(text),public.remove_profile_photo(),public.claim_profile_photo_cleanup() from public,anon,authenticated;
grant execute on function public.set_profile_photo(text),public.remove_profile_photo(),public.claim_profile_photo_cleanup() to authenticated;

-- Visible commenters use the same current-avatar visibility as Trace authors.
create or replace function private.published_author_photo(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.avatar_path=p_path and (
  exists(select 1 from public.traces t where t.author_id=p.id and t.status='approved' and not t.is_hidden and t.deleted_at is null)
  or exists(select 1 from public.comments c join public.traces t on t.id=c.trace_id
   where c.author_id=p.id and c.status='visible' and t.status='approved' and not t.is_hidden and t.deleted_at is null)
 ))
$$;
revoke all on function private.published_author_photo(text) from public,anon,authenticated;
grant execute on function private.published_author_photo(text) to anon,authenticated;
commit;
