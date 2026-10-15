begin;
create table if not exists private.notification_preferences (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 submission_updates boolean not null default true,
 trace_comments boolean not null default true,
 new_tides boolean not null default true
);
revoke all on private.notification_preferences from public,anon,authenticated;

create or replace function public.get_notification_preferences() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if private.current_role() is null then raise exception 'Active account required' using errcode='42501'; end if;
 return coalesce((select to_jsonb(p)-'user_id' from private.notification_preferences p where user_id=auth.uid()),
  '{"submission_updates":true,"trace_comments":true,"new_tides":true}'::jsonb);
end $$;
create or replace function public.set_notification_preference(p_key text,p_enabled boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if private.current_role() is null then raise exception 'Active account required' using errcode='42501'; end if;
 if p_key is null or p_key not in ('submission_updates','trace_comments','new_tides') or p_enabled is null then
  raise exception 'Invalid notification preference' using errcode='22023'; end if;
 insert into private.notification_preferences(user_id) values(auth.uid()) on conflict do nothing;
 -- Update only the requested field so separate device changes do not overwrite each other.
 execute format('update private.notification_preferences set %I=$1 where user_id=$2',p_key) using p_enabled,auth.uid();
 return public.get_notification_preferences();
end $$;
revoke all on function public.get_notification_preferences(),public.set_notification_preference(text,boolean) from public,anon;
grant execute on function public.get_notification_preferences(),public.set_notification_preference(text,boolean) to authenticated;

create or replace function private.filter_optional_notification() returns trigger
language plpgsql security definer set search_path='' as $$
declare enabled boolean;
begin
 if new.type not in ('trace_review','trace_comment','new_tide') then return new; end if;
 if not exists(select 1 from public.profiles where id=new.recipient_id and status='active') then return null; end if;
 select case new.type when 'trace_review' then submission_updates when 'trace_comment' then trace_comments else new_tides end
 into enabled from private.notification_preferences where user_id=new.recipient_id;
 if enabled is false then return null; end if;
 return new;
end $$;
drop trigger if exists filter_optional_notification on public.notifications;
create trigger filter_optional_notification before insert on public.notifications
for each row execute function private.filter_optional_notification();

create or replace function private.notify_trace_comment() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status='visible' then
  insert into public.notifications(recipient_id,type,message)
  select author_id,'trace_comment',format('Someone commented on your Trace "%s".',title)
  from public.traces where id=new.trace_id and author_id<>new.author_id
   and status='approved' and not is_hidden and deleted_at is null;
 end if;
 return new;
end $$;
drop trigger if exists notify_trace_comment on public.comments;
create trigger notify_trace_comment after insert on public.comments
for each row execute function private.notify_trace_comment();

create table if not exists private.announced_tides (
 tide_id uuid primary key references public.tides(id) on delete cascade
);
revoke all on private.announced_tides from public,anon,authenticated;
-- Existing publications are not new announcements. Also makes migration retries safe.
insert into private.announced_tides select id from public.tides where status='published' on conflict do nothing;
create or replace function private.notify_new_tide() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status='published' then
  insert into private.announced_tides values(new.id) on conflict do nothing;
  if found then
   insert into public.notifications(recipient_id,type,message)
   select p.id,'new_tide',format('New Tide: "%s".',new.title)
   from public.profiles p left join private.notification_preferences prefs on prefs.user_id=p.id
   where p.status='active' and p.id<>new.author_id and coalesce(prefs.new_tides,true);
  end if;
 end if;
 return new;
end $$;
drop trigger if exists notify_new_tide on public.tides;
create trigger notify_new_tide after insert or update of status on public.tides
for each row execute function private.notify_new_tide();
revoke all on function private.filter_optional_notification(),private.notify_trace_comment(),private.notify_new_tide() from public,anon,authenticated;
commit;
