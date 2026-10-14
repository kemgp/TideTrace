begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-photos','profile-photos',false,5242880,array['image/jpeg','image/png','image/webp']);

create policy tidetrace_avatar_upload on storage.objects for insert to authenticated with check(
 bucket_id='profile-photos' and private.current_role() is not null and
 owner_id=auth.uid()::text and (storage.foldername(name))[1]=auth.uid()::text
);
create policy tidetrace_avatar_read on storage.objects for select to authenticated using(
 bucket_id='profile-photos' and owner_id=auth.uid()::text and
 (storage.foldername(name))[1]=auth.uid()::text
);

-- Only attach an existing image owned by the caller. No direct avatar_path grant.
create function public.set_profile_photo(p_object_path text) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare saved public.profiles;
begin
 if private.current_role() is null then raise exception 'Active account required' using errcode='42501'; end if;
 if p_object_path is null or split_part(p_object_path,'/',1)<>auth.uid()::text or
 not exists(select 1 from storage.objects where bucket_id='profile-photos' and name=p_object_path
  and owner_id=auth.uid()::text and metadata->>'mimetype' in ('image/jpeg','image/png','image/webp')
  and (metadata->>'size')::bigint between 1 and 5242880)
 then raise exception 'Upload a profile photo to your own account first' using errcode='42501'; end if;
 update public.profiles set avatar_path=p_object_path where id=auth.uid() returning * into saved;
 return saved;
end $$;
revoke all on function public.set_profile_photo(text) from public,anon,authenticated;
grant execute on function public.set_profile_photo(text) to authenticated;

commit;
