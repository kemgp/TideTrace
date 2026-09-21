-- TideTrace: initial setup for a NEW Supabase project. Run once as postgres.
-- Auth, storage schemas and Supabase roles must already exist.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create type public.app_role as enum ('user', 'moderator', 'admin');
create type public.account_status as enum ('active', 'suspended');
create type public.trace_state as enum ('draft', 'pending', 'revision_requested', 'approved', 'rejected');
create type public.content_status as enum ('visible', 'hidden', 'deleted');
create type public.tide_status as enum ('draft', 'published', 'archived');
create type public.report_status as enum ('open', 'resolved', 'dismissed');

create table public.profiles (
 id uuid primary key references auth.users(id) on delete restrict,
 display_name text not null check (length(btrim(display_name)) between 1 and 100),
 role public.app_role not null default 'user',
 status public.account_status not null default 'active', avatar_path text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.categories (
 id uuid primary key default gen_random_uuid(), name text not null check (length(btrim(name)) between 1 and 100),
 description text, is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index categories_name_unique on public.categories(lower(name));
create table public.traces (
 id uuid primary key default gen_random_uuid(), author_id uuid not null references public.profiles(id),
 category_id uuid not null references public.categories(id), title text not null default '' check(length(title) <= 200),
 description text not null default '' check(length(description) <= 20000),
 location_name text not null default '' check(length(location_name) <= 300),
 latitude numeric check(latitude between -90 and 90), longitude numeric check(longitude between -180 and 180),
 status public.trace_state not null default 'draft', is_hidden boolean not null default false,
 deleted_at timestamptz, submitted_at timestamptz, published_at timestamptz,
 version integer not null default 1 check(version > 0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check ((latitude is null) = (longitude is null)),
 check (status = 'draft' or (length(btrim(title)) > 0 and length(btrim(description)) > 0 and length(btrim(location_name)) > 0 and category_id is not null))
);
create table public.trace_media (
 id uuid primary key default gen_random_uuid(), trace_id uuid not null references public.traces(id),
 object_path text not null unique, mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp','video/mp4')),
 size_bytes bigint not null check(size_bytes between 1 and 20971520), alt_text text not null default '', sort_order integer not null default 0 check(sort_order >= 0),
 created_at timestamptz not null default now()
);
create table public.tides (
 id uuid primary key default gen_random_uuid(), author_id uuid not null default auth.uid() references public.profiles(id),
 title text not null check(length(btrim(title)) between 1 and 200), slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 body text not null default '', status public.tide_status not null default 'draft',
 published_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(status <> 'published' or length(btrim(body)) > 0)
);
create table public.comments (
 id uuid primary key default gen_random_uuid(), trace_id uuid not null references public.traces(id),
 author_id uuid not null default auth.uid() references public.profiles(id), body text not null check(length(btrim(body)) between 1 and 5000),
 status public.content_status not null default 'visible', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.reports (
 id uuid primary key default gen_random_uuid(), reporter_id uuid not null default auth.uid() references public.profiles(id),
 trace_id uuid references public.traces(id), comment_id uuid references public.comments(id),
 reason text not null check(length(btrim(reason)) between 1 and 2000), status public.report_status not null default 'open',
 resolved_by uuid references public.profiles(id), resolved_at timestamptz, resolution_reason text,
 created_at timestamptz not null default now(), check(num_nonnulls(trace_id, comment_id) = 1)
);
create unique index reports_open_trace on public.reports(reporter_id,trace_id) where status = 'open';
create unique index reports_open_comment on public.reports(reporter_id,comment_id) where status = 'open';
create table public.moderation_actions (
 id uuid primary key default gen_random_uuid(), actor_id uuid not null references public.profiles(id),
 trace_id uuid references public.traces(id), comment_id uuid references public.comments(id), report_id uuid references public.reports(id),
 action text not null, reason text not null default '', from_state text, to_state text, created_at timestamptz not null default now(),
 check(num_nonnulls(trace_id,comment_id,report_id) = 1)
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(), recipient_id uuid not null references public.profiles(id),
 action_id uuid references public.moderation_actions(id), type text not null,
 message text not null, read_at timestamptz, created_at timestamptz not null default now()
);
create table public.settings (
 key text primary key check(length(key) between 1 and 100), value jsonb not null,
 updated_by uuid not null default auth.uid() references public.profiles(id),
 updated_at timestamptz not null default now()
);
create table public.admin_audit_logs (
 id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id),
 target_user_id uuid not null references public.profiles(id), action text not null,
 old_values jsonb not null, new_values jsonb not null, reason text not null, created_at timestamptz not null default now()
);
create index traces_feed on public.traces(published_at desc) where status = 'approved' and not is_hidden and deleted_at is null;
create index traces_owner on public.traces(author_id, created_at desc);
create index traces_queue on public.traces(status, submitted_at);
create index traces_category on public.traces(category_id);
create index media_trace on public.trace_media(trace_id,sort_order);
create index comments_trace on public.comments(trace_id,created_at);
create index comments_author on public.comments(author_id);
create index reports_queue on public.reports(status,created_at);
create index reports_trace on public.reports(trace_id);
create index reports_comment on public.reports(comment_id);
create index actions_trace on public.moderation_actions(trace_id,created_at);
create index notifications_recipient on public.notifications(recipient_id,created_at desc);
create index admin_audit_target on public.admin_audit_logs(target_user_id,created_at desc);

-- These helpers intentionally bypass RLS to avoid recursive profile policies.
-- Live database roles/status are checked on every request, not browser metadata.
create function private.current_role() returns public.app_role language sql stable security definer set search_path = '' as $$
 select role from public.profiles where id = auth.uid() and status = 'active'
$$;
create function private.is_staff() returns boolean language sql stable security definer set search_path = '' as $$
 select coalesce(private.current_role() in ('moderator','admin'),false)
$$;
create function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select coalesce(private.current_role() = 'admin',false)
$$;
create function private.trace_public(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.traces where id=p_id and status='approved' and not is_hidden and deleted_at is null)
$$;
create function private.can_read_trace(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.traces where id=p_id and (
 (status='approved' and not is_hidden and deleted_at is null) or private.is_staff() or
 (author_id=auth.uid() and private.current_role() is not null)))
$$;
create function private.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
 begin new.updated_at := now(); return new; end
$$;
create function private.provision_profile() returns trigger language plpgsql security definer set search_path = '' as $$
 begin
 insert into public.profiles(id,display_name) values(new.id,
 left(coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'),''), 'Member'),100));
 return new;
 end
$$;
create trigger tidetrace_new_user after insert on auth.users for each row execute function private.provision_profile();
-- Safely provision accounts that existed before this migration; metadata never sets role.
insert into public.profiles(id,display_name)
 select id,left(coalesce(nullif(btrim(raw_user_meta_data->>'display_name'),''),'Member'),100) from auth.users;

create function private.tide_publication() returns trigger language plpgsql set search_path = '' as $$
 begin
 if new.status='published' then new.published_at := coalesce(new.published_at,now());
 else new.published_at := null; end if;
 return new;
 end
$$;
create trigger tide_publication before insert or update on public.tides for each row execute function private.tide_publication();

create function private.settings_actor() returns trigger language plpgsql set search_path = '' as $$
 begin new.updated_by := auth.uid(); return new; end
$$;
create trigger settings_actor before insert or update on public.settings for each row execute function private.settings_actor();

-- RPC mutations lock the record and check expected version to reject stale edits.
create function public.save_trace_draft(p_id uuid, p_version integer, p_title text, p_description text,
 p_category_id uuid, p_location_name text, p_latitude numeric default null, p_longitude numeric default null)
returns public.traces language plpgsql security definer set search_path = '' as $$
declare t public.traces;
begin
 if private.current_role() is null then raise exception 'Active account required' using errcode='42501'; end if;
 if p_id is null then
 insert into public.traces(author_id,title,description,category_id,location_name,latitude,longitude)
 values(auth.uid(),p_title,p_description,p_category_id,p_location_name,p_latitude,p_longitude) returning * into t;
 else
 select * into t from public.traces where id=p_id for update;
 if not found or t.author_id<>auth.uid() or t.status not in ('draft','revision_requested') or t.deleted_at is not null or t.is_hidden then
 raise exception 'Submission is not editable' using errcode='42501'; end if;
 if p_version is distinct from t.version then raise exception 'Stale submission version' using errcode='40001'; end if;
 update public.traces set title=p_title,description=p_description,category_id=p_category_id,
 location_name=p_location_name,latitude=p_latitude,longitude=p_longitude,version=version+1 where id=p_id returning * into t;
 end if;
 return t;
end $$;

-- Store only verified Storage objects; clients cannot invent media evidence.
create function public.attach_trace_media(p_trace_id uuid,p_object_path text,p_sort_order integer default 0)
returns public.trace_media language plpgsql security definer set search_path = '' as $$
declare t public.traces; m public.trace_media; object_metadata jsonb;
begin
 select * into t from public.traces where id=p_trace_id for update;
 if not found or private.current_role() is null or t.author_id<>auth.uid() or
 t.status not in ('draft','revision_requested') or t.is_hidden or t.deleted_at is not null then
 raise exception 'Submission is not editable' using errcode='42501'; end if;
 if split_part(p_object_path,'/',1)<>auth.uid()::text or split_part(p_object_path,'/',2)<>p_trace_id::text then
 raise exception 'Invalid media path'; end if;
 select metadata into object_metadata from storage.objects where bucket_id='trace-media' and name=p_object_path and owner_id=auth.uid()::text;
 if not found then raise exception 'Upload the file before attaching it'; end if;
 insert into public.trace_media(trace_id,object_path,mime_type,size_bytes,sort_order)
 values(p_trace_id,p_object_path,object_metadata->>'mimetype',(object_metadata->>'size')::bigint,p_sort_order)
 returning * into m;
 update public.traces set version=version+1 where id=p_trace_id;
 return m;
end $$;
create function public.detach_trace_media(p_media_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare t public.traces; trace_uuid uuid;
begin
 select trace_id into trace_uuid from public.trace_media where id=p_media_id;
 select * into t from public.traces where id=trace_uuid for update;
 if not found or private.current_role() is null or t.author_id<>auth.uid() or t.status not in ('draft','revision_requested') or t.is_hidden or t.deleted_at is not null then
 raise exception 'Submission is not editable' using errcode='42501'; end if;
 delete from public.trace_media where id=p_media_id;
 update public.traces set version=version+1 where id=trace_uuid;
 -- Physical object cleanup uses Storage API in a trusted maintenance job.
end $$;
create function public.submit_trace(p_id uuid,p_version integer) returns public.traces language plpgsql security definer set search_path = '' as $$
declare t public.traces;
begin
 select * into t from public.traces where id=p_id for update;
 if not found or private.current_role() is null or t.author_id<>auth.uid() or t.status not in ('draft','revision_requested') or t.is_hidden or t.deleted_at is not null then
 raise exception 'Submission is not eligible' using errcode='42501'; end if;
 if p_version is distinct from t.version then raise exception 'Stale submission version' using errcode='40001'; end if;
 if not exists(select 1 from public.categories where id=t.category_id and is_active) or
 not exists(select 1 from public.trace_media where trace_id=p_id and mime_type like 'image/%') then raise exception 'Active category and at least one image required'; end if;
 update public.traces set status='pending',submitted_at=now(),version=version+1 where id=p_id returning * into t;
 return t;
end $$;
create function public.moderate_trace(p_id uuid,p_version integer,p_decision public.trace_state,p_reason text default null)
returns public.traces language plpgsql security definer set search_path = '' as $$
declare t public.traces; action_uuid uuid;
begin
 if not private.is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 if p_decision is null or p_decision not in ('approved','rejected','revision_requested') then raise exception 'Invalid decision'; end if;
 if p_decision<>'approved' and coalesce(length(btrim(p_reason)),0)=0 then raise exception 'Feedback required'; end if;
 select * into t from public.traces where id=p_id for update;
 if not found or t.status<>'pending' or t.is_hidden or t.deleted_at is not null then raise exception 'Trace is not pending'; end if;
 if t.author_id=auth.uid() then raise exception 'Cannot review your own submission' using errcode='42501'; end if;
 if p_version is distinct from t.version then raise exception 'Stale submission version' using errcode='40001'; end if;
 insert into public.moderation_actions(actor_id,trace_id,action,reason,from_state,to_state)
 values(auth.uid(),p_id,'review_trace',coalesce(p_reason,''),t.status::text,p_decision::text) returning id into action_uuid;
 insert into public.notifications(recipient_id,action_id,type,message)
 values(t.author_id,action_uuid,'trace_review',format('Your Trace "%s": %s.%s',t.title,replace(p_decision::text,'_',' '),coalesce(' '||p_reason,'')));
 update public.traces set status=p_decision,published_at=case when p_decision='approved' then now() else null end,
 version=version+1 where id=p_id returning * into t;
 return t;
end $$;

-- Serialize all role/status changes, including the last-admin check.
create function public.admin_set_account(p_user_id uuid,p_role public.app_role,p_status public.account_status,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare previous public.profiles;
begin
 perform pg_advisory_xact_lock(742819001);
 if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_role is null or p_status is null or coalesce(length(btrim(p_reason)),0)=0 then raise exception 'Role, status and reason required'; end if;
 select * into previous from public.profiles where id=p_user_id for update;
 if not found then raise exception 'Account not found'; end if;
 if previous.role='admin' and previous.status='active' and (p_role<>'admin' or p_status<>'active') and
 (select count(*) from public.profiles where role='admin' and status='active')<=1 then raise exception 'Cannot remove the last active admin'; end if;
 update public.profiles set role=p_role,status=p_status where id=p_user_id;
 insert into public.admin_audit_logs(actor_id,target_user_id,action,old_values,new_values,reason)
 values(auth.uid(),p_user_id,'set_account',jsonb_build_object('role',previous.role,'status',previous.status),jsonb_build_object('role',p_role,'status',p_status),p_reason);
end $$;
create function public.get_my_profile() returns setof public.profiles language sql stable security definer set search_path = '' as $$
 select * from public.profiles where id=auth.uid()
$$;
create function public.admin_list_profiles() returns setof public.profiles language plpgsql stable security definer set search_path = '' as $$
 begin
 if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 return query select * from public.profiles order by created_at desc;
 end
$$;
create function public.mark_notifications_read(p_ids uuid[] default null) returns void language plpgsql security definer set search_path = '' as $$
 begin
 if private.current_role() is null then raise exception 'Active account required' using errcode='42501'; end if;
 update public.notifications set read_at=now() where recipient_id=auth.uid() and read_at is null and (p_ids is null or id=any(p_ids));
 end
$$;
create function public.resolve_report(p_id uuid,p_remove_content boolean,p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.reports; target_author uuid; action_uuid uuid; previous_state text;
begin
 if not private.is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 if p_remove_content is null or coalesce(length(btrim(p_reason)),0)=0 then raise exception 'Decision and reason required'; end if;
 select * into r from public.reports where id=p_id for update;
 if not found or r.status<>'open' then raise exception 'Report is not open'; end if;
 if p_remove_content then
 if r.trace_id is not null then
 select case when is_hidden then 'hidden' else 'visible' end into previous_state from public.traces where id=r.trace_id for update;
 update public.traces set is_hidden=true,version=version+1 where id=r.trace_id returning author_id into target_author;
 else
 select status::text into previous_state from public.comments where id=r.comment_id for update;
 update public.comments set status='hidden' where id=r.comment_id returning author_id into target_author;
 end if;
 -- Content action and report action are separate: each has exactly one target FK.
 insert into public.moderation_actions(actor_id,trace_id,comment_id,action,reason,from_state,to_state)
 values(auth.uid(),r.trace_id,r.comment_id,'hide_content',p_reason,previous_state,'hidden') returning id into action_uuid;
 insert into public.notifications(recipient_id,action_id,type,message)
 values(target_author,action_uuid,'content_hidden','Your content was hidden: '||p_reason);
 end if;
 update public.reports set status=case when p_remove_content then 'resolved'::public.report_status else 'dismissed'::public.report_status end,
 resolved_by=auth.uid(),resolved_at=now(),resolution_reason=p_reason where id=p_id;
 insert into public.moderation_actions(actor_id,report_id,action,reason,from_state,to_state)
 values(auth.uid(),p_id,'review_report',p_reason,'open',case when p_remove_content then 'resolved' else 'dismissed' end) returning id into action_uuid;
 insert into public.notifications(recipient_id,action_id,type,message)
 values(r.reporter_id,action_uuid,'report_review','Your report was reviewed: '||p_reason);
end $$;

-- Explicit privileges: no direct writes to workflow, authorization or audit fields.
do $$ declare t text; begin
 foreach t in array array['profiles','categories','traces','trace_media','tides','comments','reports','moderation_actions','notifications','settings','admin_audit_logs'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public, anon, authenticated',t);
 end loop;
 foreach t in array array['profiles','categories','traces','tides','comments','settings'] loop
 execute format('create trigger touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()',t);
 end loop;
end $$;
grant select(id,display_name) on public.profiles to anon,authenticated;
grant update(display_name) on public.profiles to authenticated;
grant select on public.categories,public.traces,public.trace_media,public.tides,public.comments to anon,authenticated;
grant select on public.reports,public.moderation_actions,public.notifications,public.settings,public.admin_audit_logs to authenticated;
grant insert(name,description,is_active),update(name,description,is_active) on public.categories to authenticated;
grant insert(title,slug,body,status),update(title,slug,body,status) on public.tides to authenticated;
grant insert(trace_id,body) on public.comments to authenticated;
grant insert(trace_id,comment_id,reason) on public.reports to authenticated;
grant insert(key,value),update(value) on public.settings to authenticated;

create policy profiles_read on public.profiles for select using (
 id=auth.uid() or private.is_staff() or
 exists(select 1 from public.traces t where t.author_id=profiles.id and private.trace_public(t.id)) or
 exists(select 1 from public.comments c where c.author_id=profiles.id and c.status='visible' and private.trace_public(c.trace_id)) or
 exists(select 1 from public.tides t where t.author_id=profiles.id and t.status='published')
);
create policy profiles_edit on public.profiles for update to authenticated using(id=auth.uid() and private.current_role() is not null) with check(id=auth.uid() and private.current_role() is not null);
create policy categories_read on public.categories for select using(is_active or private.is_staff());
create policy categories_insert on public.categories for insert to authenticated with check(private.is_admin());
create policy categories_update on public.categories for update to authenticated using(private.is_admin()) with check(private.is_admin());
create policy traces_read on public.traces for select using(private.can_read_trace(id));
create policy media_read on public.trace_media for select using(private.can_read_trace(trace_id));
create policy tides_read on public.tides for select using(status='published' or private.is_admin());
create policy tides_insert on public.tides for insert to authenticated with check(private.is_admin() and author_id=auth.uid());
create policy tides_update on public.tides for update to authenticated using(private.is_admin()) with check(private.is_admin());
create policy comments_read on public.comments for select using((status='visible' and private.trace_public(trace_id)) or private.is_staff());
create policy comments_insert on public.comments for insert to authenticated with check(private.current_role() is not null and author_id=auth.uid() and status='visible' and private.trace_public(trace_id));
create policy reports_read on public.reports for select to authenticated using(private.is_staff() or (reporter_id=auth.uid() and private.current_role() is not null));
create policy reports_insert on public.reports for insert to authenticated with check(
 private.current_role() is not null and reporter_id=auth.uid() and status='open' and (
 (trace_id is not null and private.trace_public(trace_id)) or
 exists(select 1 from public.comments c where c.id=comment_id and c.status='visible' and private.trace_public(c.trace_id)))
);
create policy actions_read on public.moderation_actions for select to authenticated using(private.is_staff() or
 (private.current_role() is not null and (
 exists(select 1 from public.traces t where t.id=trace_id and t.author_id=auth.uid()) or
 exists(select 1 from public.reports r where r.id=report_id and r.reporter_id=auth.uid()) or
 exists(select 1 from public.notifications n where n.action_id=moderation_actions.id and n.recipient_id=auth.uid()))));
create policy notifications_read on public.notifications for select to authenticated using(recipient_id=auth.uid() and private.current_role() is not null);
create policy settings_read on public.settings for select to authenticated using(private.is_admin());
create policy settings_insert on public.settings for insert to authenticated with check(private.is_admin());
create policy settings_update on public.settings for update to authenticated using(private.is_admin()) with check(private.is_admin());
create policy admin_audit_read on public.admin_audit_logs for select to authenticated using(private.is_admin());

-- Private media. Never overwrite submitted evidence. Detached objects are inaccessible.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('trace-media','trace-media',false,20971520,array['image/jpeg','image/png','image/webp','video/mp4']);
create policy tidetrace_media_read on storage.objects for select to anon,authenticated using(
 bucket_id='trace-media' and exists(select 1 from public.trace_media m where m.object_path=name and private.can_read_trace(m.trace_id))
);
create policy tidetrace_media_upload on storage.objects for insert to authenticated with check(
 bucket_id='trace-media' and private.current_role() is not null and owner_id=auth.uid()::text and
 (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.traces t where
 t.id::text=(storage.foldername(name))[2] and t.author_id=auth.uid() and t.status in ('draft','revision_requested') and not t.is_hidden and t.deleted_at is null)
);
-- No client UPDATE/DELETE Storage policies: use unique filenames, upsert:false.

-- Revoke Supabase/Postgres default function EXECUTE, then grant only intended calls.
-- Scope this to the functions introduced here, not unrelated project functions.
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature, n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='private' and p.proname in ('current_role','is_staff','is_admin','trace_public','can_read_trace','touch_updated_at','provision_profile','tide_publication','settings_actor'))
 or (n.nspname='public' and p.proname in ('save_trace_draft','attach_trace_media','detach_trace_media','submit_trace','moderate_trace','admin_set_account','get_my_profile','admin_list_profiles','mark_notifications_read','resolve_report')) loop
 execute format('revoke all on function %s from public, anon, authenticated',f.signature);
 if f.nspname='public' then execute format('grant execute on function %s to authenticated',f.signature); end if;
 end loop;
end $$;
grant execute on function private.current_role(),private.is_staff(),private.is_admin(),private.trace_public(uuid),private.can_read_trace(uuid) to anon,authenticated;
insert into public.categories(name) values('Coral condition'),('Mangroves'),('Fisheries'),('Pollution'),('Oral history'),('Other');
commit;
