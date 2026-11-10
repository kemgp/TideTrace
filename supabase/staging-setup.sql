-- TideTrace staging setup: every migration in order, combined for a FRESH Supabase project.
-- Do NOT run on production or any project that already has the schema.
-- Source of truth stays in supabase/migrations/. Regenerate this file when a migration is added.
-- Excludes tests/, bootstrap-first-admin.sql and sample lesson files.

-- ===== 20260921000100_initial_schema.sql =====
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

-- ===== 20260927000100_tide_completions.sql =====
-- Apply after the initial schema. Existing compatible completion records are preserved.
begin;
create table if not exists public.tide_completions (
 user_id uuid not null references public.profiles(id) on delete cascade,
 tide_id uuid not null references public.tides(id) on delete cascade,
 completed_at timestamptz not null default now(),
 primary key (user_id,tide_id)
);
create unique index if not exists tide_completions_owner_lesson on public.tide_completions(user_id,tide_id);
alter table public.tide_completions enable row level security;
-- Replace earlier experimental policies rather than leaving permissive policies active.
do $$ declare p record; begin
 for p in select policyname from pg_policies where schemaname='public' and tablename='tide_completions' loop
  execute format('drop policy %I on public.tide_completions',p.policyname);
 end loop;
end $$;
revoke all on public.tide_completions from public,anon,authenticated;
revoke insert(completed_at),update(user_id,tide_id,completed_at) on public.tide_completions from public,anon,authenticated;
grant select on public.tide_completions to authenticated;
grant insert(user_id,tide_id) on public.tide_completions to authenticated;
create policy completions_read on public.tide_completions for select to authenticated
 using(user_id=auth.uid() and private.current_role() is not null);
create policy completions_insert on public.tide_completions for insert to authenticated
 with check(user_id=auth.uid() and private.current_role() is not null and
 exists(select 1 from public.tides where id=tide_id and status='published'));
-- No update/delete grants: completing again cannot reset the original timestamp.
commit;

-- ===== 20260928000100_dashboard_summary.sql =====
-- Aggregate all rows, independent of API pagination. No existing data is changed.
begin;
create or replace function public.get_dashboard_summary() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid(); actor_role public.app_role := private.current_role(); summary jsonb;
begin
 if actor is null or actor_role is null then raise exception 'Active account required' using errcode='42501'; end if;
 if actor_role = 'user' then
  select jsonb_build_object(
   'traces',count(*),
   'drafts',count(*) filter(where status='draft'),
   'pending',count(*) filter(where status='pending' and not is_hidden),
   'approved',count(*) filter(where status='approved' and not is_hidden),
   'needs_revision',count(*) filter(where status='revision_requested' and not is_hidden),
   'comments_posted',(select count(*) from public.comments where author_id=actor),
   'tides_finished',(select count(*) from public.tide_completions where user_id=actor),
   'member_since',(select created_at from public.profiles where id=actor)
  ) into summary from public.traces where author_id=actor and deleted_at is null;
 elsif actor_role = 'moderator' then
  select jsonb_build_object(
   'pending',(select count(*) from public.traces where status='pending' and not is_hidden and deleted_at is null),
   'flagged_comments',(select count(distinct comment_id) from public.reports where status='open'),
   'open_reports',(select count(*) from public.reports where status='open'),
   'reviewed_today',(select count(*) from public.moderation_actions where actor_id=actor and action in ('review_trace','review_report') and created_at >= (date_trunc('day',now() at time zone 'Asia/Manila') at time zone 'Asia/Manila'))
  ) into summary;
 else
  select jsonb_build_object(
   'users',(select count(*) from public.profiles),
   'active_users',(select count(*) from public.profiles where status='active'),
   'moderators',(select count(*) from public.profiles where role='moderator' and status='active'),
   'published_traces',(select count(*) from public.traces where status='approved' and not is_hidden and deleted_at is null),
   'published_tides',(select count(*) from public.tides where status='published'),
   'pending',(select count(*) from public.traces where status='pending' and not is_hidden and deleted_at is null),
   'open_reports',(select count(*) from public.reports where status='open')
  ) into summary;
 end if;
 return summary || jsonb_build_object('id',actor,'role',actor_role,'as_of',now());
end $$;
revoke all on function public.get_dashboard_summary() from public,anon,authenticated;
grant execute on function public.get_dashboard_summary() to authenticated;
commit;

-- ===== 20261001000100_account_edit_guard.sql =====
-- Preserve the existing serialized account workflow and audit logging.
begin;
create or replace function public.admin_update_account(
 p_user_id uuid, p_role public.app_role, p_status public.account_status,
 p_reason text, p_expected_updated_at timestamptz
) returns void language plpgsql security definer set search_path = '' as $$
declare previous public.profiles;
begin
 perform pg_advisory_xact_lock(742819001);
 if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 select * into previous from public.profiles where id=p_user_id for update;
 if not found then raise exception 'Account not found'; end if;
 if p_expected_updated_at is null or previous.updated_at <> p_expected_updated_at then
  raise exception 'Account changed. Reload it before retrying.' using errcode='40001';
 end if;
 if coalesce(length(btrim(p_reason)),0) not between 1 and 2000 then raise exception 'A reason between 1 and 2000 characters is required'; end if;
 if previous.role=p_role and previous.status=p_status then raise exception 'No account changes selected'; end if;
 perform public.admin_set_account(p_user_id,p_role,p_status,p_reason);
end $$;
revoke all on function public.admin_update_account(uuid,public.app_role,public.account_status,text,timestamptz) from public,anon,authenticated;
grant execute on function public.admin_update_account(uuid,public.app_role,public.account_status,text,timestamptz) to authenticated;
commit;

-- ===== 20261001000200_restrict_admin_assignment.sql =====
-- Block admin promotion through both account-management RPCs.
-- Existing admins may retain their role during status changes.
create or replace function public.admin_set_account(p_user_id uuid,p_role public.app_role,p_status public.account_status,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare previous public.profiles;
begin
 perform pg_advisory_xact_lock(742819001);
 if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_role is null or p_status is null or coalesce(length(btrim(p_reason)),0)=0 then raise exception 'Role, status and reason required'; end if;
 select * into previous from public.profiles where id=p_user_id for update;
 if not found then raise exception 'Account not found'; end if;
 if p_role='admin' and previous.role<>'admin' then raise exception 'Admin roles cannot be assigned through account management' using errcode='42501'; end if;
 if previous.role='admin' and previous.status='active' and (p_role<>'admin' or p_status<>'active') and
 (select count(*) from public.profiles where role='admin' and status='active')<=1 then raise exception 'Cannot remove the last active admin'; end if;
 update public.profiles set role=p_role,status=p_status where id=p_user_id;
 insert into public.admin_audit_logs(actor_id,target_user_id,action,old_values,new_values,reason)
 values(auth.uid(),p_user_id,'set_account',jsonb_build_object('role',previous.role,'status',previous.status),jsonb_build_object('role',p_role,'status',p_status),p_reason);
end $$;

-- ===== 20261001000300_preserve_trace_categories.sql =====
-- Preserve category labels for existing readable Traces after deactivation.
-- The public category selector endpoint still returns active categories only.
alter policy categories_read on public.categories using (
 is_active or private.is_staff() or exists (
  select 1 from public.traces t where t.category_id=categories.id
 )
);

-- ===== 20261005000100_staff_analytics.sql =====
-- All-time staff analytics, calculated over all saved rows (not paginated lists).
begin;
create or replace function public.get_staff_analytics() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid(); actor_role public.app_role := private.current_role(); payload jsonb;
begin
 if actor is null or actor_role is null or actor_role not in ('admin','moderator') then
  raise exception 'Staff access required' using errcode='42501';
 end if;
 with eligible as (
  select * from public.traces where deleted_at is null and not is_hidden and status<>'draft'
 ), category_counts as (
  select c.id,c.name,count(*) as total from eligible t join public.categories c on c.id=t.category_id group by c.id,c.name
 )
 select jsonb_build_object(
  'id',actor,'role',actor_role,'as_of',now(),
  'traces',(select count(*) from eligible),
  'approved',(select count(*) from eligible where status='approved'),
  'pending',(select count(*) from eligible where status='pending'),
  'rejected',(select count(*) from eligible where status='rejected'),
  'needs_revision',(select count(*) from eligible where status='revision_requested'),
  'categories',coalesce((select jsonb_agg(jsonb_build_object('id',id,'label',name,'value',total) order by total desc,name,id) from category_counts),'[]'::jsonb),
  'comments',(select count(*) from public.comments c join eligible t on t.id=c.trace_id where c.status='visible'),
  'completions',(select count(*) from public.tide_completions),
  'my_reviews',(select count(*) from public.moderation_actions where actor_id=actor and action='review_trace'),
  'my_report_decisions',(select count(*) from public.moderation_actions where actor_id=actor and action='review_report')
 ) into payload;
 if actor_role='admin' then
  payload := payload || jsonb_build_object(
   'users',(select count(*) from public.profiles),
   'active_users',(select count(*) from public.profiles where status='active'),
   'reviewers',coalesce((select jsonb_agg(jsonb_build_object('id',id,'label',display_name,'value',total) order by total desc,id) from (
    select p.id,p.display_name,count(*) as total from public.moderation_actions a join public.profiles p on p.id=a.actor_id
    where a.action='review_trace' group by p.id,p.display_name
   ) reviewers),'[]'::jsonb)
  );
 end if;
 return payload;
end $$;
revoke all on function public.get_staff_analytics() from public,anon,authenticated;
grant execute on function public.get_staff_analytics() to authenticated;
commit;

-- ===== 20261005000200_workflow_settings.sql =====
-- Safe to rerun after SQL Editor installation or a migration retry.
begin;
create or replace function public.get_workflow_settings() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare saved public.settings;
begin
 if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 select * into saved from public.settings where key='workflow';
 return jsonb_build_object('id','workflow','value',coalesce(saved.value,'{"submissions_paused":false,"max_media_per_trace":10}'::jsonb),'updated_at',saved.updated_at);
end $$;
create or replace function private.validate_workflow_settings() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.key<>'workflow' then return new; end if;
 if jsonb_typeof(new.value)<>'object' or not(new.value ?& array['submissions_paused','max_media_per_trace']) or
 (new.value - 'submissions_paused' - 'max_media_per_trace')<>'{}'::jsonb or
 jsonb_typeof(new.value->'submissions_paused')<>'boolean' or jsonb_typeof(new.value->'max_media_per_trace')<>'number' then
 raise exception 'Invalid workflow settings'; end if;
 if (new.value->>'max_media_per_trace')::numeric not between 1 and 10 or
 (new.value->>'max_media_per_trace')::numeric<>trunc((new.value->>'max_media_per_trace')::numeric) then raise exception 'Media limit must be an integer from 1 to 10'; end if;
 insert into public.admin_audit_logs(actor_id,target_user_id,action,old_values,new_values,reason)
 values(auth.uid(),auth.uid(),'update_workflow_settings',case when tg_op='INSERT' then '{}'::jsonb else old.value end,new.value,'Platform workflow settings updated');
 return new;
end $$;
create or replace trigger validate_workflow_settings before insert or update on public.settings for each row execute function private.validate_workflow_settings();
create or replace function public.save_workflow_settings(p_value jsonb,p_expected_updated_at timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare saved public.settings;
begin
 if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(742819002);
 select * into saved from public.settings where key='workflow' for update;
 if saved.updated_at is distinct from p_expected_updated_at then raise exception 'Settings changed. Reload before saving' using errcode='40001'; end if;
 insert into public.settings(key,value) values('workflow',p_value) on conflict(key) do update set value=excluded.value;
 return public.get_workflow_settings();
end $$;
create or replace function private.enforce_submission_setting() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status='pending' and (tg_op='INSERT' or old.status is distinct from new.status) and
 coalesce((select (value->>'submissions_paused')::boolean from public.settings where key='workflow'),false) then
 raise exception 'Trace submissions are temporarily paused. Save your draft and try again later'; end if;
 return new;
end $$;
create or replace trigger enforce_submission_setting before insert or update on public.traces for each row execute function private.enforce_submission_setting();
create or replace function private.enforce_media_limit() returns trigger
language plpgsql security definer set search_path='' as $$
declare maximum integer;
begin
 perform 1 from public.traces where id=new.trace_id for update;
 select coalesce((select (value->>'max_media_per_trace')::integer from public.settings where key='workflow'),10) into maximum;
 if (select count(*) from public.trace_media where trace_id=new.trace_id)>=maximum then raise exception 'This Trace has reached the media limit'; end if;
 return new;
end $$;
create or replace trigger enforce_media_limit before insert on public.trace_media for each row execute function private.enforce_media_limit();
revoke all on function private.validate_workflow_settings(),private.enforce_submission_setting(),private.enforce_media_limit() from public,anon,authenticated;
revoke all on function public.get_workflow_settings(),public.save_workflow_settings(jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.get_workflow_settings(),public.save_workflow_settings(jsonb,timestamptz) to authenticated;
commit;

-- ===== 20261010000100_community_summary.sql =====
-- Public aggregate counts only; no member identities or private records returned.
begin;
create or replace function public.get_community_summary() returns jsonb
language sql stable security definer set search_path='' as $$
 with published as (
  select author_id from public.traces where status='approved' and not is_hidden and deleted_at is null
 )
 select jsonb_build_object(
  'id','community',
  'published_traces',(select count(*) from published),
  'contributors',(select count(distinct author_id) from published),
  'published_tides',(select count(*) from public.tides where status='published'),
  'tides_completed',(select count(*) from public.tide_completions),
  'as_of',now()
 )
$$;
revoke all on function public.get_community_summary() from public,anon,authenticated;
grant execute on function public.get_community_summary() to anon,authenticated;
commit;

-- ===== 20261014000100_profile_photos.sql =====
-- Safe to rerun after manual bucket creation or SQL Editor installation.
begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-photos','profile-photos',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set
 public=excluded.public,
 file_size_limit=excluded.file_size_limit,
 allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists tidetrace_avatar_upload on storage.objects;
create policy tidetrace_avatar_upload on storage.objects for insert to authenticated with check(
 bucket_id='profile-photos' and private.current_role() is not null and
 owner_id=auth.uid()::text and (storage.foldername(name))[1]=auth.uid()::text
);
drop policy if exists tidetrace_avatar_read on storage.objects;
create policy tidetrace_avatar_read on storage.objects for select to authenticated using(
 bucket_id='profile-photos' and owner_id=auth.uid()::text and
 (storage.foldername(name))[1]=auth.uid()::text
);

-- Only attach an existing image owned by the caller. No direct avatar_path grant.
create or replace function public.set_profile_photo(p_object_path text) returns public.profiles
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

-- ===== 20261014000200_trace_author_photos.sql =====
-- Safe to rerun after SQL Editor installation or a migration retry.
begin;

-- Existing profile RLS still decides whose public projection is readable.
grant select(avatar_path) on public.profiles to anon,authenticated;

create or replace function private.published_author_photo(p_path text) returns boolean
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
drop policy if exists tidetrace_published_author_photo_read on storage.objects;
create policy tidetrace_published_author_photo_read on storage.objects
for select to anon,authenticated using(
 bucket_id='profile-photos' and private.published_author_photo(name)
);

commit;

-- ===== 20261015000100_photo_management_and_comment_avatars.sql =====
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

-- ===== 20261015000200_search_public_traces.sql =====
begin;
-- Invoker permissions preserve RLS; explicit visibility also restricts staff searches.
create or replace function public.search_public_traces(p_query text)
returns setof public.traces
language sql stable security invoker set search_path='' as $$
 select t.* from public.traces t
 where t.status='approved' and not t.is_hidden and t.deleted_at is null
 and length(btrim(p_query)) between 1 and 200
 and (
  strpos(lower(t.title),lower(btrim(p_query)))>0
  or strpos(lower(t.description),lower(btrim(p_query)))>0
  or strpos(lower(t.location_name),lower(btrim(p_query)))>0
  or exists(select 1 from public.profiles p where p.id=t.author_id
    and strpos(lower(p.display_name),lower(btrim(p_query)))>0)
 )
$$;
revoke all on function public.search_public_traces(text) from public;
grant execute on function public.search_public_traces(text) to anon,authenticated;
commit;

-- ===== 20261015000300_notification_preferences.sql =====
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

-- ===== 20261015000400_data_saver.sql =====
begin;
alter table public.profiles add column if not exists data_saver boolean not null default false;
create or replace function public.set_data_saver(p_enabled boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if private.current_role() is null then raise exception 'Active account required' using errcode='42501'; end if;
 if p_enabled is null then raise exception 'Choose on or off' using errcode='22023'; end if;
 update public.profiles set data_saver=p_enabled where id=auth.uid();
 return jsonb_build_object('id',auth.uid(),'data_saver',p_enabled);
end $$;
revoke all on function public.set_data_saver(boolean) from public,anon;
grant execute on function public.set_data_saver(boolean) to authenticated;
commit;

-- ===== 20261029000100_sensitive_trace_locations.sql =====
begin;

alter table public.traces add column is_sensitive boolean not null default false;
alter table public.traces add constraint sensitive_coordinates_private
 check (not is_sensitive or (latitude is null and longitude is null));

create table private.trace_locations (
 trace_id uuid primary key references public.traces(id) on delete cascade,
 latitude numeric not null check (latitude between -90 and 90),
 longitude numeric not null check (longitude between -180 and 180)
);
alter table private.trace_locations enable row level security;
revoke all on private.trace_locations from public,anon,authenticated;

-- Replacing the signature keeps old eight-argument clients working via the default.
drop function public.save_trace_draft(uuid,integer,text,text,uuid,text,numeric,numeric);
create function public.save_trace_draft(p_id uuid, p_version integer, p_title text, p_description text,
 p_category_id uuid, p_location_name text, p_latitude numeric default null, p_longitude numeric default null,
 p_is_sensitive boolean default null)
returns public.traces language plpgsql security definer set search_path='' as $$
declare t public.traces; sensitive boolean;
begin
 if private.current_role() is null then raise exception 'Active account required' using errcode='42501'; end if;
 if (p_latitude is null) <> (p_longitude is null) or
    (p_latitude is not null and not (p_latitude between -90 and 90 and p_longitude between -180 and 180)) then
  raise exception 'Provide valid paired coordinates' using errcode='22023';
 end if;
 if p_id is not null then
  select * into t from public.traces where id=p_id for update;
  if not found or t.author_id<>auth.uid() or t.status not in ('draft','revision_requested') or t.deleted_at is not null or t.is_hidden then
   raise exception 'Submission is not editable' using errcode='42501';
  end if;
  if p_version is distinct from t.version then raise exception 'Stale submission version' using errcode='40001'; end if;
 end if;
 sensitive := coalesce(p_is_sensitive,t.is_sensitive,false);
 if p_id is null then
  insert into public.traces(author_id,title,description,category_id,location_name,latitude,longitude,is_sensitive)
  values(auth.uid(),p_title,p_description,p_category_id,p_location_name,
   case when not sensitive then p_latitude end,case when not sensitive then p_longitude end,sensitive) returning * into t;
 else
  update public.traces set title=p_title,description=p_description,category_id=p_category_id,location_name=p_location_name,
   latitude=case when not sensitive then p_latitude end,longitude=case when not sensitive then p_longitude end,
   is_sensitive=sensitive,version=version+1 where id=p_id returning * into t;
 end if;
 if sensitive and p_latitude is not null then
  insert into private.trace_locations(trace_id,latitude,longitude) values(t.id,p_latitude,p_longitude)
   on conflict(trace_id) do update set latitude=excluded.latitude,longitude=excluded.longitude;
 else
  delete from private.trace_locations where trace_id=t.id;
 end if;
 return t;
end $$;

create function public.get_trace_private_location(p_id uuid)
returns table(latitude numeric,longitude numeric) language plpgsql stable security definer set search_path='' as $$
begin
 if private.current_role() is null or not exists (
  select 1 from public.traces t where t.id=p_id and (t.author_id=auth.uid() or private.is_staff())
 ) then raise exception 'Location access denied' using errcode='42501'; end if;
 return query select l.latitude,l.longitude from private.trace_locations l where l.trace_id=p_id;
end $$;

create function public.hide_trace_location(p_id uuid,p_version integer)
returns public.traces language plpgsql security definer set search_path='' as $$
declare t public.traces;
begin
 if private.current_role() is null then raise exception 'Active account required' using errcode='42501'; end if;
 select * into t from public.traces where id=p_id for update;
 if not found or (t.author_id<>auth.uid() and not private.is_staff()) or t.deleted_at is not null then
  raise exception 'Location access denied' using errcode='42501';
 end if;
 if p_version is distinct from t.version then raise exception 'Stale submission version' using errcode='40001'; end if;
 if t.is_sensitive then return t; end if;
 if t.latitude is not null then
  insert into private.trace_locations(trace_id,latitude,longitude) values(t.id,t.latitude,t.longitude);
 end if;
 update public.traces set is_sensitive=true,latitude=null,longitude=null,version=version+1 where id=p_id returning * into t;
 insert into public.moderation_actions(actor_id,trace_id,action,from_state,to_state)
  values(auth.uid(),p_id,'hide_trace_location','public','sensitive');
 return t;
end $$;

revoke all on function public.save_trace_draft(uuid,integer,text,text,uuid,text,numeric,numeric,boolean),
 public.get_trace_private_location(uuid),public.hide_trace_location(uuid,integer) from public,anon,authenticated;
grant execute on function public.save_trace_draft(uuid,integer,text,text,uuid,text,numeric,numeric,boolean),
 public.get_trace_private_location(uuid),public.hide_trace_location(uuid,integer) to authenticated;

create index traces_map_latitude on public.traces(latitude)
 where status='approved' and not is_hidden and deleted_at is null and not is_sensitive and latitude is not null;
commit;

-- ===== 20261102000100_delete_own_trace.sql =====
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

-- ===== 20261103000100_trace_phase_two.sql =====
begin;

-- Active authenticated members may delete their own visible comments.
create or replace function public.delete_own_comment(p_comment_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if private.current_role() is null then raise exception 'Active account required' using errcode='42501'; end if;
 perform 1 from public.comments c where c.id=p_comment_id and c.author_id=auth.uid() and c.status='visible'
  and exists(select 1 from public.traces t where t.id=c.trace_id and t.deleted_at is null) for update;
 if not found then raise exception 'Record not found.' using errcode='PT404'; end if;
 update public.comments set status='deleted',updated_at=now() where id=p_comment_id;
 update public.reports set status='resolved',resolution_reason='comment deleted',resolved_at=now(),resolved_by=null
  where comment_id=p_comment_id and status='open';
end $$;
revoke all on function public.delete_own_comment(uuid) from public,anon;
grant execute on function public.delete_own_comment(uuid) to authenticated;

-- Anonymous visitors and authenticated members may read public feed neighbors.
create or replace function public.trace_neighbors(p_trace_id uuid)
returns table(direction text,id uuid,title text)
language sql stable security definer set search_path='' as $$
 with current_trace as (
  select t.id,t.published_at from public.traces t where t.id=p_trace_id
   and t.status='approved' and not t.is_hidden and t.deleted_at is null and t.published_at is not null
 ), feed as (
  select t.id,t.title,t.published_at from public.traces t
   where t.status='approved' and not t.is_hidden and t.deleted_at is null and t.published_at is not null
 )
 (select 'newer'::text,t.id,t.title from feed t cross join current_trace c
  where t.published_at>c.published_at or (t.published_at=c.published_at and t.id<c.id)
  order by t.published_at asc,t.id desc limit 1)
 union all
 (select 'older'::text,t.id,t.title from feed t cross join current_trace c
  where t.published_at<c.published_at or (t.published_at=c.published_at and t.id>c.id)
  order by t.published_at desc,t.id asc limit 1)
$$;
revoke all on function public.trace_neighbors(uuid) from public;
grant execute on function public.trace_neighbors(uuid) to anon,authenticated;
commit;

-- ===== 20261104000100_tide_lessons.sql =====
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

-- ===== 20261105000100_tide_chapters_images.sql =====
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

-- ===== 20261106000100_tide_progress.sql =====
-- Remembers which chapter of a lesson each member last reached, so they can carry on where they left off.
-- Completion stays in tide_completions; this table only holds unfinished reading.
begin;
create table if not exists public.tide_progress (
 user_id uuid not null references public.profiles(id) on delete cascade,
 tide_id uuid not null references public.tides(id) on delete cascade,
 part integer not null check (part >= 1),
 total integer not null check (total >= 2 and total <= 500),
 updated_at timestamptz not null default now(),
 primary key (user_id,tide_id),
 check (part <= total)
);
alter table public.tide_progress enable row level security;
do $$ declare p record; begin
 for p in select policyname from pg_policies where schemaname='public' and tablename='tide_progress' loop
  execute format('drop policy %I on public.tide_progress',p.policyname);
 end loop;
end $$;
revoke all on public.tide_progress from public,anon,authenticated;
grant select on public.tide_progress to authenticated;
create policy progress_read on public.tide_progress for select to authenticated
 using(user_id=auth.uid() and private.current_role() is not null);

-- The only way to write progress: validates the lesson and the numbers, and keeps one row per member and lesson.
create or replace function public.save_tide_progress(p_tide_id uuid,p_part integer,p_total integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare saved public.tide_progress;
begin
 if auth.uid() is null or private.current_role() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_part is null or p_total is null or p_total not between 2 and 500 or p_part not between 1 and p_total then
  raise exception 'Invalid chapter' using errcode='P0001';
 end if;
 if not exists(select 1 from public.tides where id=p_tide_id and status='published') then
  raise exception 'Record not found.' using errcode='PT404';
 end if;
 insert into public.tide_progress(user_id,tide_id,part,total) values(auth.uid(),p_tide_id,p_part,p_total)
 on conflict (user_id,tide_id) do update set part=excluded.part,total=excluded.total,updated_at=now()
 returning * into saved;
 return jsonb_build_object('tide_id',saved.tide_id,'part',saved.part,'total',saved.total,'updated_at',saved.updated_at);
end $$;
revoke all on function public.save_tide_progress(uuid,integer,integer) from public,anon;
grant execute on function public.save_tide_progress(uuid,integer,integer) to authenticated;
commit;

-- ===== 20261107000100_moderator_workflow.sql =====
-- Moderator workflow: hold for an admin, saved reasons, grouped report decisions,
-- author summary for reviewers, and staff notifications for new reports.
-- Hold is a separate table (not a trace_state value) so the public trace columns and enum stay unchanged.
begin;

create table if not exists public.trace_holds (
 trace_id uuid primary key references public.traces(id) on delete cascade,
 held_by uuid not null references public.profiles(id),
 reason text not null check(length(btrim(reason)) between 1 and 2000),
 held_at timestamptz not null default now()
);
alter table public.trace_holds enable row level security;
revoke all on public.trace_holds from public,anon,authenticated;
grant select on public.trace_holds to authenticated;
drop policy if exists trace_holds_read on public.trace_holds;
create policy trace_holds_read on public.trace_holds for select to authenticated using(private.is_staff());

create table if not exists public.moderator_reason_templates (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
 kind text not null check(kind in ('review','report')),
 body text not null check(length(btrim(body)) between 1 and 500),
 created_at timestamptz not null default now()
);
create index if not exists moderator_reason_templates_owner on public.moderator_reason_templates(owner_id,kind,created_at);
alter table public.moderator_reason_templates enable row level security;
revoke all on public.moderator_reason_templates from public,anon,authenticated;
grant select,delete on public.moderator_reason_templates to authenticated;
grant insert(kind,body) on public.moderator_reason_templates to authenticated;
drop policy if exists reason_templates_read on public.moderator_reason_templates;
drop policy if exists reason_templates_insert on public.moderator_reason_templates;
drop policy if exists reason_templates_delete on public.moderator_reason_templates;
create policy reason_templates_read on public.moderator_reason_templates for select to authenticated using(owner_id=auth.uid() and private.is_staff());
create policy reason_templates_insert on public.moderator_reason_templates for insert to authenticated with check(owner_id=auth.uid() and private.is_staff());
create policy reason_templates_delete on public.moderator_reason_templates for delete to authenticated using(owner_id=auth.uid() and private.is_staff());

create index if not exists moderation_actions_actor_created on public.moderation_actions(actor_id,created_at desc);

-- A held Trace stays pending. Only an admin can decide it or release the hold.
create or replace function public.hold_trace(p_id uuid,p_version integer,p_reason text) returns public.traces
language plpgsql security definer set search_path = '' as $$
declare t public.traces;
begin
 if not private.is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 if coalesce(length(btrim(p_reason)),0)=0 then raise exception 'Reason required'; end if;
 select * into t from public.traces where id=p_id for update;
 if not found or t.status<>'pending' or t.is_hidden or t.deleted_at is not null then raise exception 'Trace is not pending'; end if;
 if t.author_id=auth.uid() then raise exception 'Cannot review your own submission' using errcode='42501'; end if;
 if p_version is distinct from t.version then raise exception 'Stale submission version' using errcode='40001'; end if;
 if exists(select 1 from public.trace_holds where trace_id=p_id) then raise exception 'Trace is already on hold'; end if;
 insert into public.trace_holds(trace_id,held_by,reason) values(p_id,auth.uid(),btrim(p_reason));
 insert into public.moderation_actions(actor_id,trace_id,action,reason,from_state,to_state)
 values(auth.uid(),p_id,'hold_trace',btrim(p_reason),'pending','on_hold');
 update public.traces set version=version+1 where id=p_id returning * into t;
 return t;
end $$;

create or replace function public.release_trace_hold(p_id uuid) returns public.traces
language plpgsql security definer set search_path = '' as $$
declare t public.traces;
begin
 if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 select * into t from public.traces where id=p_id for update;
 if not found or not exists(select 1 from public.trace_holds where trace_id=p_id) then raise exception 'Trace is not on hold'; end if;
 delete from public.trace_holds where trace_id=p_id;
 insert into public.moderation_actions(actor_id,trace_id,action,reason,from_state,to_state)
 values(auth.uid(),p_id,'release_hold','','on_hold','pending');
 update public.traces set version=version+1 where id=p_id returning * into t;
 return t;
end $$;

-- Same as the initial definition, plus: moderators cannot decide a held Trace, and a decision clears the hold.
create or replace function public.moderate_trace(p_id uuid,p_version integer,p_decision public.trace_state,p_reason text default null)
returns public.traces language plpgsql security definer set search_path = '' as $$
declare t public.traces; action_uuid uuid;
begin
 if not private.is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 if p_decision is null or p_decision not in ('approved','rejected','revision_requested') then raise exception 'Invalid decision'; end if;
 if p_decision<>'approved' and coalesce(length(btrim(p_reason)),0)=0 then raise exception 'Feedback required'; end if;
 select * into t from public.traces where id=p_id for update;
 if not found or t.status<>'pending' or t.is_hidden or t.deleted_at is not null then raise exception 'Trace is not pending'; end if;
 if t.author_id=auth.uid() then raise exception 'Cannot review your own submission' using errcode='42501'; end if;
 if exists(select 1 from public.trace_holds where trace_id=p_id) and not private.is_admin() then raise exception 'Trace is on hold for an admin' using errcode='42501'; end if;
 if p_version is distinct from t.version then raise exception 'Stale submission version' using errcode='40001'; end if;
 insert into public.moderation_actions(actor_id,trace_id,action,reason,from_state,to_state)
 values(auth.uid(),p_id,'review_trace',coalesce(p_reason,''),t.status::text,p_decision::text) returning id into action_uuid;
 insert into public.notifications(recipient_id,action_id,type,message)
 values(t.author_id,action_uuid,'trace_review',format('Your Trace "%s": %s.%s',t.title,replace(p_decision::text,'_',' '),coalesce(' '||p_reason,'')));
 delete from public.trace_holds where trace_id=p_id;
 update public.traces set status=p_decision,published_at=case when p_decision='approved' then now() else null end,
 version=version+1 where id=p_id returning * into t;
 return t;
end $$;

-- Decide several open reports at once (a group on the same content, or a bulk dismissal).
-- Content is hidden once per target, and the author is told once.
create or replace function public.resolve_reports(p_ids uuid[],p_remove_content boolean,p_reason text) returns integer
language plpgsql security definer set search_path = '' as $$
declare r public.reports; target_author uuid; action_uuid uuid; previous_state text;
 handled integer := 0; wanted integer; hidden_traces uuid[] := '{}'; hidden_comments uuid[] := '{}';
begin
 if not private.is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 if p_remove_content is null or coalesce(length(btrim(p_reason)),0)=0 then raise exception 'Decision and reason required'; end if;
 if p_ids is null or cardinality(p_ids)=0 or cardinality(p_ids)>50 then raise exception 'Between 1 and 50 reports required'; end if;
 select count(distinct id) into wanted from unnest(p_ids) as id;
 for r in select * from public.reports where id=any(p_ids) order by id for update loop
  if r.status<>'open' then raise exception 'Report is not open'; end if;
  if p_remove_content then
   if r.trace_id is not null and not (r.trace_id=any(hidden_traces)) then
    select case when is_hidden then 'hidden' else 'visible' end into previous_state from public.traces where id=r.trace_id for update;
    update public.traces set is_hidden=true,version=version+1 where id=r.trace_id returning author_id into target_author;
    hidden_traces := hidden_traces||r.trace_id;
    insert into public.moderation_actions(actor_id,trace_id,action,reason,from_state,to_state)
    values(auth.uid(),r.trace_id,'hide_content',p_reason,previous_state,'hidden') returning id into action_uuid;
    insert into public.notifications(recipient_id,action_id,type,message)
    values(target_author,action_uuid,'content_hidden','Your content was hidden: '||p_reason);
   elsif r.comment_id is not null and not (r.comment_id=any(hidden_comments)) then
    select status::text into previous_state from public.comments where id=r.comment_id for update;
    update public.comments set status='hidden' where id=r.comment_id returning author_id into target_author;
    hidden_comments := hidden_comments||r.comment_id;
    insert into public.moderation_actions(actor_id,comment_id,action,reason,from_state,to_state)
    values(auth.uid(),r.comment_id,'hide_content',p_reason,previous_state,'hidden') returning id into action_uuid;
    insert into public.notifications(recipient_id,action_id,type,message)
    values(target_author,action_uuid,'content_hidden','Your content was hidden: '||p_reason);
   end if;
  end if;
  update public.reports set status=case when p_remove_content then 'resolved'::public.report_status else 'dismissed'::public.report_status end,
   resolved_by=auth.uid(),resolved_at=now(),resolution_reason=p_reason where id=r.id;
  insert into public.moderation_actions(actor_id,report_id,action,reason,from_state,to_state)
  values(auth.uid(),r.id,'review_report',p_reason,'open',case when p_remove_content then 'resolved' else 'dismissed' end) returning id into action_uuid;
  insert into public.notifications(recipient_id,action_id,type,message)
  values(r.reporter_id,action_uuid,'report_review','Your report was reviewed: '||p_reason);
  handled := handled+1;
 end loop;
 if handled<>wanted then raise exception 'Report is not open'; end if;
 return handled;
end $$;

-- What a reviewer needs to know about an author. Staff only.
create or replace function public.staff_author_summary(p_author_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
 if not private.is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 return jsonb_build_object(
  'traces',(select count(*) from public.traces where author_id=p_author_id and status<>'draft' and deleted_at is null),
  'approved',(select count(*) from public.traces where author_id=p_author_id and status='approved' and deleted_at is null),
  'needed_changes',(select count(*) from public.moderation_actions a join public.traces t on t.id=a.trace_id
    where t.author_id=p_author_id and a.action='review_trace' and a.to_state in ('revision_requested','rejected')),
  'reports_against',(select count(*) from public.reports r
    left join public.traces t on t.id=r.trace_id left join public.comments c on c.id=r.comment_id
    where t.author_id=p_author_id or c.author_id=p_author_id));
end $$;

-- Tell active staff when someone files a report.
create or replace function private.notify_staff_report() returns trigger
language plpgsql security definer set search_path = '' as $$
declare label text;
begin
 if new.comment_id is not null then label := 'a comment';
 else select coalesce(nullif(btrim(title),''),'a Trace') into label from public.traces where id=new.trace_id; end if;
 insert into public.notifications(recipient_id,type,message)
 select p.id,'staff_report',format('New report to review: %s.',coalesce(label,'content'))
 from public.profiles p where p.role in ('moderator','admin') and p.status='active' and p.id<>new.reporter_id;
 return new;
end $$;
drop trigger if exists notify_staff_report on public.reports;
create trigger notify_staff_report after insert on public.reports
for each row execute function private.notify_staff_report();

revoke all on function public.hold_trace(uuid,integer,text),public.release_trace_hold(uuid),public.resolve_reports(uuid[],boolean,text),
 public.staff_author_summary(uuid) from public,anon;
grant execute on function public.hold_trace(uuid,integer,text),public.release_trace_hold(uuid),public.resolve_reports(uuid[],boolean,text),
 public.staff_author_summary(uuid) to authenticated;
revoke all on function private.notify_staff_report() from public,anon,authenticated;
commit;

-- ===== 20261108000100_admin_needs_you.sql =====
-- Two extra admin totals for the "Needs you" strip on the admin dashboard:
-- held_traces (pending Traces with an admin hold) and oldest_pending_at (submission time of the longest-waiting pending Trace).
-- The user and moderator results are unchanged. No data is changed.
begin;
create or replace function public.get_dashboard_summary() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid(); actor_role public.app_role := private.current_role(); summary jsonb;
begin
 if actor is null or actor_role is null then raise exception 'Active account required' using errcode='42501'; end if;
 if actor_role = 'user' then
  select jsonb_build_object(
   'traces',count(*),
   'drafts',count(*) filter(where status='draft'),
   'pending',count(*) filter(where status='pending' and not is_hidden),
   'approved',count(*) filter(where status='approved' and not is_hidden),
   'needs_revision',count(*) filter(where status='revision_requested' and not is_hidden),
   'comments_posted',(select count(*) from public.comments where author_id=actor),
   'tides_finished',(select count(*) from public.tide_completions where user_id=actor),
   'member_since',(select created_at from public.profiles where id=actor)
  ) into summary from public.traces where author_id=actor and deleted_at is null;
 elsif actor_role = 'moderator' then
  select jsonb_build_object(
   'pending',(select count(*) from public.traces where status='pending' and not is_hidden and deleted_at is null),
   'flagged_comments',(select count(distinct comment_id) from public.reports where status='open'),
   'open_reports',(select count(*) from public.reports where status='open'),
   'reviewed_today',(select count(*) from public.moderation_actions where actor_id=actor and action in ('review_trace','review_report') and created_at >= (date_trunc('day',now() at time zone 'Asia/Manila') at time zone 'Asia/Manila'))
  ) into summary;
 else
  select jsonb_build_object(
   'users',(select count(*) from public.profiles),
   'active_users',(select count(*) from public.profiles where status='active'),
   'moderators',(select count(*) from public.profiles where role='moderator' and status='active'),
   'published_traces',(select count(*) from public.traces where status='approved' and not is_hidden and deleted_at is null),
   'published_tides',(select count(*) from public.tides where status='published'),
   'pending',(select count(*) from public.traces where status='pending' and not is_hidden and deleted_at is null),
   'open_reports',(select count(*) from public.reports where status='open'),
   'held_traces',(select count(*) from public.trace_holds h join public.traces t on t.id=h.trace_id where t.status='pending' and not t.is_hidden and t.deleted_at is null),
   'oldest_pending_at',(select min(submitted_at) from public.traces where status='pending' and not is_hidden and deleted_at is null)
  ) into summary;
 end if;
 return summary || jsonb_build_object('id',actor,'role',actor_role,'as_of',now());
end $$;
revoke all on function public.get_dashboard_summary() from public,anon,authenticated;
grant execute on function public.get_dashboard_summary() to authenticated;
commit;

-- ===== 20261109000100_dashboard_active_traces.sql =====
-- Member dashboard: add active_traces, the sum of the Draft, Needs revision, In review and Approved cards (so rejected and hidden Traces are left out).
-- Hidden (removed) Traces are listed in their own Removed section of My Contributions: "removed" counts them and "traces" (the All filter) no longer does.
-- "traces" is unchanged (it still backs the All filter in My Contributions). Moderator and admin results are unchanged. No data is changed.
begin;

create or replace function public.get_dashboard_summary() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid(); actor_role public.app_role := private.current_role(); summary jsonb;
begin
 if actor is null or actor_role is null then raise exception 'Active account required' using errcode='42501'; end if;
 if actor_role = 'user' then
  select jsonb_build_object(
   'traces',count(*) filter(where not is_hidden),
   'removed',count(*) filter(where is_hidden),
   'active_traces',count(*) filter(where status<>'rejected' and not is_hidden),
   'drafts',count(*) filter(where status='draft' and not is_hidden),
   'pending',count(*) filter(where status='pending' and not is_hidden),
   'approved',count(*) filter(where status='approved' and not is_hidden),
   'needs_revision',count(*) filter(where status='revision_requested' and not is_hidden),
   'comments_posted',(select count(*) from public.comments where author_id=actor),
   'tides_finished',(select count(*) from public.tide_completions where user_id=actor),
   'member_since',(select created_at from public.profiles where id=actor)
  ) into summary from public.traces where author_id=actor and deleted_at is null;
 elsif actor_role = 'moderator' then
  select jsonb_build_object(
   'pending',(select count(*) from public.traces where status='pending' and not is_hidden and deleted_at is null),
   'flagged_comments',(select count(distinct comment_id) from public.reports where status='open'),
   'open_reports',(select count(*) from public.reports where status='open'),
   'reviewed_today',(select count(*) from public.moderation_actions where actor_id=actor and action in ('review_trace','review_report') and created_at >= (date_trunc('day',now() at time zone 'Asia/Manila') at time zone 'Asia/Manila'))
  ) into summary;
 else
  select jsonb_build_object(
   'users',(select count(*) from public.profiles),
   'active_users',(select count(*) from public.profiles where status='active'),
   'moderators',(select count(*) from public.profiles where role='moderator' and status='active'),
   'published_traces',(select count(*) from public.traces where status='approved' and not is_hidden and deleted_at is null),
   'published_tides',(select count(*) from public.tides where status='published'),
   'pending',(select count(*) from public.traces where status='pending' and not is_hidden and deleted_at is null),
   'open_reports',(select count(*) from public.reports where status='open'),
   'held_traces',(select count(*) from public.trace_holds h join public.traces t on t.id=h.trace_id where t.status='pending' and not t.is_hidden and t.deleted_at is null),
   'oldest_pending_at',(select min(submitted_at) from public.traces where status='pending' and not is_hidden and deleted_at is null)
  ) into summary;
 end if;
 return summary || jsonb_build_object('id',actor,'role',actor_role,'as_of',now());
end $$;
revoke all on function public.get_dashboard_summary() from public,anon,authenticated;
grant execute on function public.get_dashboard_summary() to authenticated;
commit;

-- ===== 20261110000100_tide_energy.sql =====
-- Phase A, step 1: Tide Energy, Tide quizzes, moderator flags and admin investigations (database only).
-- Plan: docs/plans/phase-a-plan.md, sections 6.1 to 6.5.
--
-- Additive and inert until an admin activates energy: no award is issued while the "energy" setting is
-- missing or its activated_at is null. moderate_trace and get_dashboard_summary keep their signatures and
-- behave exactly as before while energy is inactive. Safe to run before the API and client that use it.
-- Awards are written only by security definer functions, in the same transaction as the event they reward.
-- The direct insert grant on tide_completions stays until the API uses complete_tide (plan step 7).
begin;

do $$ begin
 create type public.energy_award_type as enum ('trace_approval','tide_completion','quiz_pass','reversal');
exception when duplicate_object then null; end $$;
do $$ begin
 create type public.quiz_status as enum ('draft','published');
exception when duplicate_object then null; end $$;
do $$ begin
 create type public.energy_flag_status as enum ('open','dismissed','upheld');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------------------------------------
-- Ledger: append-only, one award per owner, type and source, even after a reversal.
-- source_id is the Trace id (trace_approval), the Tide id (tide_completion, quiz_pass) or, for a reversal,
-- the reversed entry's id. No foreign key on source_id on purpose: deleting content never revokes energy.
create table if not exists public.energy_ledger (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete restrict,
 award_type public.energy_award_type not null,
 source_id uuid not null,
 amount integer not null,
 reverses_id uuid references public.energy_ledger(id),
 reason text,
 created_by uuid references public.profiles(id),
 created_at timestamptz not null default now(),
 constraint energy_ledger_one_award unique (owner_id, award_type, source_id),
 constraint energy_ledger_reversal_link check ((award_type = 'reversal') = (reverses_id is not null)),
 constraint energy_ledger_reversal_reason check (award_type <> 'reversal' or length(btrim(coalesce(reason,''))) between 1 and 2000),
 constraint energy_ledger_amount check (case award_type
  when 'trace_approval' then amount = 20
  when 'tide_completion' then amount = 5
  when 'quiz_pass' then amount = 15
  else amount < 0 end)
);
create unique index if not exists energy_ledger_one_reversal on public.energy_ledger(reverses_id) where reverses_id is not null;
create index if not exists energy_ledger_owner on public.energy_ledger(owner_id, created_at desc);
create index if not exists energy_ledger_recent on public.energy_ledger(created_at desc);

create or replace function private.energy_ledger_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
 raise exception 'Energy ledger entries cannot be changed or removed' using errcode = '42501';
end $$;
drop trigger if exists energy_ledger_append_only on public.energy_ledger;
create trigger energy_ledger_append_only before update or delete on public.energy_ledger
for each row execute function private.energy_ledger_append_only();
drop trigger if exists energy_ledger_no_truncate on public.energy_ledger;
create trigger energy_ledger_no_truncate before truncate on public.energy_ledger
for each statement execute function private.energy_ledger_append_only();

-- ---------------------------------------------------------------------------------------------------------
-- Quizzes. Questions and options are readable only through get_tide_quiz; the key and explanations live in
-- the private schema and reach members only after a pass.
create table if not exists public.tide_quizzes (
 tide_id uuid primary key references public.tides(id) on delete cascade,
 status public.quiz_status not null default 'draft',
 version integer not null default 1 check (version > 0),
 published_at timestamptz,
 updated_at timestamptz not null default now(),
 updated_by uuid references public.profiles(id)
);
create table if not exists public.tide_quiz_questions (
 id uuid primary key default gen_random_uuid(),
 tide_id uuid not null references public.tide_quizzes(tide_id) on delete cascade,
 position smallint not null check (position between 1 and 5),
 prompt text not null default '' check (length(prompt) <= 500),
 options text[] not null check (cardinality(options) = 4),
 unique (tide_id, position)
);
create table if not exists private.tide_quiz_keys (
 question_id uuid primary key references public.tide_quiz_questions(id) on delete cascade,
 correct_index smallint check (correct_index between 0 and 3),
 explanation text not null default '' check (length(explanation) <= 1000)
);
create table if not exists private.tide_quiz_attempts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id),
 tide_id uuid not null references public.tides(id) on delete cascade,
 version integer not null,
 passed boolean not null,
 attempted_at timestamptz not null default now()
);
create index if not exists tide_quiz_attempts_recent on private.tide_quiz_attempts(user_id, tide_id, attempted_at desc);
create table if not exists public.tide_quiz_passes (
 user_id uuid not null references public.profiles(id),
 tide_id uuid not null references public.tides(id) on delete cascade,
 version integer not null,
 first_passed_at timestamptz not null default now(),
 primary key (user_id, tide_id)
);

-- ---------------------------------------------------------------------------------------------------------
-- Moderator flags on issued Trace awards. One open flag per award.
create table if not exists public.energy_flags (
 id uuid primary key default gen_random_uuid(),
 ledger_id uuid not null references public.energy_ledger(id),
 flagged_by uuid not null references public.profiles(id),
 reason text not null check (length(btrim(reason)) between 1 and 2000),
 status public.energy_flag_status not null default 'open',
 resolved_by uuid references public.profiles(id),
 resolved_at timestamptz,
 resolution_reason text,
 created_at timestamptz not null default now(),
 check ((status = 'open') = (resolved_at is null))
);
create unique index if not exists energy_flags_one_open on public.energy_flags(ledger_id) where status = 'open';
create index if not exists energy_flags_by on public.energy_flags(flagged_by, created_at desc);

-- ---------------------------------------------------------------------------------------------------------
-- Access: no direct writes for anyone. Owners read their own ledger and passes; staff read their own flags;
-- admins read all of it. Everything else goes through the functions below.
do $$ declare t text; begin
 foreach t in array array['energy_ledger','tide_quizzes','tide_quiz_questions','tide_quiz_passes','energy_flags'] loop
  execute format('alter table public.%I enable row level security', t);
  execute format('revoke all on public.%I from public, anon, authenticated', t);
 end loop;
end $$;
revoke all on private.tide_quiz_keys, private.tide_quiz_attempts from public, anon, authenticated;
grant select on public.energy_ledger, public.tide_quiz_passes, public.energy_flags to authenticated;
drop policy if exists energy_ledger_read on public.energy_ledger;
create policy energy_ledger_read on public.energy_ledger for select to authenticated
 using ((owner_id = auth.uid() and private.current_role() is not null) or private.is_admin());
drop policy if exists quiz_passes_read on public.tide_quiz_passes;
create policy quiz_passes_read on public.tide_quiz_passes for select to authenticated
 using ((user_id = auth.uid() and private.current_role() is not null) or private.is_admin());
drop policy if exists energy_flags_read on public.energy_flags;
create policy energy_flags_read on public.energy_flags for select to authenticated
 using ((flagged_by = auth.uid() and private.is_staff()) or private.is_admin());

-- ---------------------------------------------------------------------------------------------------------
-- Activation. settings key "energy" = {"activated_at": "<timestamptz>" | null}. Null or missing = off.
create or replace function private.validate_energy_settings() returns trigger
language plpgsql security definer set search_path = '' as $$
declare stamp timestamptz;
begin
 if new.key <> 'energy' then return new; end if;
 if jsonb_typeof(new.value) <> 'object' or (new.value - 'activated_at') <> '{}'::jsonb or not (new.value ? 'activated_at')
  or jsonb_typeof(new.value->'activated_at') not in ('null','string') then
  raise exception 'Invalid energy settings' using errcode = '22023';
 end if;
 if jsonb_typeof(new.value->'activated_at') = 'string' then
  begin stamp := (new.value->>'activated_at')::timestamptz;
  exception when others then raise exception 'Invalid energy settings' using errcode = '22023'; end;
  -- Activation is "from now": no back-dating (it would not backfill anyway) and no scheduling ahead.
  if (tg_op = 'INSERT' or old.value->>'activated_at' is distinct from new.value->>'activated_at')
   and abs(extract(epoch from stamp - now())) > 60 then
   raise exception 'Energy can only be activated from the current time' using errcode = '22023';
  end if;
 end if;
 insert into public.admin_audit_logs(actor_id, target_user_id, action, old_values, new_values, reason)
 values (auth.uid(), auth.uid(), 'update_energy_settings',
  case when tg_op = 'INSERT' then '{}'::jsonb else old.value end, new.value,
  case when new.value->>'activated_at' is null then 'Tide Energy paused' else 'Tide Energy activated' end);
 return new;
end $$;
drop trigger if exists validate_energy_settings on public.settings;
create trigger validate_energy_settings before insert or update on public.settings
for each row execute function private.validate_energy_settings();

create or replace function private.energy_active() returns boolean
language sql stable security definer set search_path = '' as $$
 select coalesce((select (value->>'activated_at')::timestamptz <= now() from public.settings where key = 'energy'), false)
$$;

-- The only writer of award rows. Returns the new row, or null when nothing was issued (inactive, inactive
-- owner, or already awarded: retries and races end here without an error).
create or replace function private.issue_award(p_owner uuid, p_type public.energy_award_type, p_source uuid)
returns public.energy_ledger language plpgsql security definer set search_path = '' as $$
declare entry public.energy_ledger;
begin
 if p_type = 'reversal' then raise exception 'Reversals are not awards' using errcode = '22023'; end if;
 if not private.energy_active() then return null; end if;
 if not exists (select 1 from public.profiles where id = p_owner and status = 'active') then return null; end if;
 insert into public.energy_ledger(owner_id, award_type, source_id, amount)
 values (p_owner, p_type, p_source, case p_type when 'trace_approval' then 20 when 'tide_completion' then 5 else 15 end)
 on conflict (owner_id, award_type, source_id) do nothing
 returning * into entry;
 return entry;
end $$;

-- A short label for an entry's source, for notifications and history.
create or replace function private.energy_source_title(p_type public.energy_award_type, p_source uuid)
returns text language sql stable security definer set search_path = '' as $$
 select case p_type
  when 'trace_approval' then (select nullif(btrim(title), '') from public.traces where id = p_source)
  else (select title from public.tides where id = p_source) end
$$;

create or replace function private.energy_entry_json(e public.energy_ledger) returns jsonb
language sql stable security definer set search_path = '' as $$
 select jsonb_build_object(
  'id', e.id, 'owner_id', e.owner_id, 'award_type', e.award_type, 'source_id', e.source_id, 'amount', e.amount,
  'reverses_id', e.reverses_id, 'reason', e.reason, 'created_at', e.created_at,
  'source_type', coalesce(o.award_type, e.award_type),
  'title', coalesce(private.energy_source_title(coalesce(o.award_type, e.award_type), coalesce(o.source_id, e.source_id)), 'Untitled'),
  'source_deleted', case when coalesce(o.award_type, e.award_type) = 'trace_approval'
    then exists (select 1 from public.traces t where t.id = coalesce(o.source_id, e.source_id) and t.deleted_at is not null) else false end,
  'reversed', exists (select 1 from public.energy_ledger r where r.reverses_id = e.id))
 from (select 1) one left join public.energy_ledger o on o.id = e.reverses_id
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Trace approval: unchanged checks and order (20261107000100), plus the award in the same transaction.
create or replace function public.moderate_trace(p_id uuid,p_version integer,p_decision public.trace_state,p_reason text default null)
returns public.traces language plpgsql security definer set search_path = '' as $$
declare t public.traces; action_uuid uuid; award public.energy_ledger; earned text := '';
begin
 if not private.is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 if p_decision is null or p_decision not in ('approved','rejected','revision_requested') then raise exception 'Invalid decision'; end if;
 if p_decision<>'approved' and coalesce(length(btrim(p_reason)),0)=0 then raise exception 'Feedback required'; end if;
 select * into t from public.traces where id=p_id for update;
 if not found or t.status<>'pending' or t.is_hidden or t.deleted_at is not null then raise exception 'Trace is not pending'; end if;
 if t.author_id=auth.uid() then raise exception 'Cannot review your own submission' using errcode='42501'; end if;
 if exists(select 1 from public.trace_holds where trace_id=p_id) and not private.is_admin() then raise exception 'Trace is on hold for an admin' using errcode='42501'; end if;
 if p_version is distinct from t.version then raise exception 'Stale submission version' using errcode='40001'; end if;
 insert into public.moderation_actions(actor_id,trace_id,action,reason,from_state,to_state)
 values(auth.uid(),p_id,'review_trace',coalesce(p_reason,''),t.status::text,p_decision::text) returning id into action_uuid;
 if p_decision='approved' then
  award := private.issue_award(t.author_id,'trace_approval',p_id);
  if award.id is not null then earned := format(' You earned %s Tide Energy.', award.amount); end if;
 end if;
 insert into public.notifications(recipient_id,action_id,type,message)
 values(t.author_id,action_uuid,'trace_review',format('Your Trace "%s": %s.%s%s',t.title,replace(p_decision::text,'_',' '),earned,coalesce(' '||p_reason,'')));
 delete from public.trace_holds where trace_id=p_id;
 update public.traces set status=p_decision,published_at=case when p_decision='approved' then now() else null end,
 version=version+1 where id=p_id returning * into t;
 return t;
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- Tide completion through one function: records it and, for a new completion, issues the award.
create or replace function public.complete_tide(p_tide_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); done timestamptz; award public.energy_ledger;
begin
 if actor is null or private.current_role() is null then raise exception 'Active account required' using errcode='42501'; end if;
 if not exists (select 1 from public.tides where id = p_tide_id and status = 'published') then
  raise exception 'Lesson is not available' using errcode='P0002';
 end if;
 insert into public.tide_completions(user_id, tide_id) values (actor, p_tide_id)
 on conflict (user_id, tide_id) do nothing returning completed_at into done;
 if done is not null then
  award := private.issue_award(actor, 'tide_completion', p_tide_id);
 else
  select completed_at into done from public.tide_completions where user_id = actor and tide_id = p_tide_id;
 end if;
 return jsonb_build_object('user_id', actor, 'tide_id', p_tide_id, 'completed_at', done,
  'awarded', award.id is not null, 'amount', coalesce(award.amount, 0));
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- Member quiz.
create or replace function private.quiz_retry_after(p_user uuid, p_tide uuid) returns integer
language sql stable security definer set search_path = '' as $$
 select coalesce(greatest(0, ceil(30 - extract(epoch from now() - max(attempted_at))))::integer, 0)
 from private.tide_quiz_attempts where user_id = p_user and tide_id = p_tide
$$;

create or replace function public.get_tide_quiz(p_tide_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid(); quiz public.tide_quizzes; has_passed boolean;
begin
 if actor is null or private.current_role() is null then raise exception 'Active account required' using errcode='42501'; end if;
 select q.* into quiz from public.tide_quizzes q join public.tides t on t.id = q.tide_id
 where q.tide_id = p_tide_id and q.status = 'published' and t.status = 'published';
 if not found then raise exception 'Quiz is not available' using errcode='P0002'; end if;
 if not exists (select 1 from public.tide_completions where user_id = actor and tide_id = p_tide_id) then
  raise exception 'Complete the lesson before the quiz' using errcode='42501';
 end if;
 has_passed := exists (select 1 from public.tide_quiz_passes where user_id = actor and tide_id = p_tide_id);
 return jsonb_build_object(
  'tide_id', p_tide_id, 'version', quiz.version, 'passed', has_passed,
  'retry_after', private.quiz_retry_after(actor, p_tide_id),
  'questions', (select coalesce(jsonb_agg(jsonb_build_object(
     'id', qq.id, 'position', qq.position, 'prompt', qq.prompt, 'options', to_jsonb(qq.options))
     || case when has_passed then jsonb_build_object('correct_index', k.correct_index, 'explanation', k.explanation) else '{}'::jsonb end
     order by qq.position), '[]'::jsonb)
   from public.tide_quiz_questions qq left join private.tide_quiz_keys k on k.question_id = qq.id
   where qq.tide_id = p_tide_id));
end $$;

-- Graded on the server. Returns only whether the attempt passed; never a score or which answers were wrong.
create or replace function public.submit_tide_quiz(p_tide_id uuid, p_version integer, p_answers smallint[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); quiz public.tide_quizzes; wait integer; right_answers integer; ok boolean;
 first_pass boolean := false; award public.energy_ledger;
begin
 if actor is null or private.current_role() is null then raise exception 'Active account required' using errcode='42501'; end if;
 -- One submission at a time per member and Tide, so parallel submits cannot race the cooldown or the first pass.
 perform pg_advisory_xact_lock(hashtextextended(actor::text || ':' || p_tide_id::text, 7319));
 select q.* into quiz from public.tide_quizzes q join public.tides t on t.id = q.tide_id
 where q.tide_id = p_tide_id and q.status = 'published' and t.status = 'published';
 if not found then raise exception 'Quiz is not available' using errcode='P0002'; end if;
 if not exists (select 1 from public.tide_completions where user_id = actor and tide_id = p_tide_id) then
  raise exception 'Complete the lesson before the quiz' using errcode='42501';
 end if;
 if p_version is distinct from quiz.version then raise exception 'Quiz changed. Reload it before answering.' using errcode='40001'; end if;
 if p_answers is null or cardinality(p_answers) <> 5 or array_position(p_answers, null) is not null
  or exists (select 1 from unnest(p_answers) a where a not between 0 and 3) then
  raise exception 'Answer all five questions' using errcode='22023';
 end if;
 wait := private.quiz_retry_after(actor, p_tide_id);
 if wait > 0 then raise exception 'Try again in % seconds', wait using errcode='TT429', detail = wait::text; end if;
 select count(*) into right_answers from public.tide_quiz_questions qq join private.tide_quiz_keys k on k.question_id = qq.id
 where qq.tide_id = p_tide_id and k.correct_index = p_answers[qq.position];
 ok := right_answers >= 4;
 insert into private.tide_quiz_attempts(user_id, tide_id, version, passed) values (actor, p_tide_id, quiz.version, ok);
 if ok then
  insert into public.tide_quiz_passes(user_id, tide_id, version) values (actor, p_tide_id, quiz.version)
  on conflict (user_id, tide_id) do nothing returning true into first_pass;
  if first_pass then award := private.issue_award(actor, 'quiz_pass', p_tide_id); end if;
 end if;
 return jsonb_build_object('passed', ok, 'first_pass', coalesce(first_pass, false),
  'awarded', award.id is not null, 'amount', coalesce(award.amount, 0), 'retry_after', case when ok then 0 else 30 end);
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- Admin quiz authoring. p_questions: [{"prompt": "...", "options": ["","","",""], "correct": 0..3|null, "explanation": "..."}].
create or replace function public.admin_get_tide_quiz(p_tide_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare quiz public.tide_quizzes;
begin
 if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if not exists (select 1 from public.tides where id = p_tide_id) then raise exception 'Lesson not found' using errcode='P0002'; end if;
 select * into quiz from public.tide_quizzes where tide_id = p_tide_id;
 if not found then return jsonb_build_object('tide_id', p_tide_id, 'exists', false, 'status', null, 'version', null, 'questions', '[]'::jsonb); end if;
 return jsonb_build_object('tide_id', p_tide_id, 'exists', true, 'status', quiz.status, 'version', quiz.version,
  'published_at', quiz.published_at, 'updated_at', quiz.updated_at,
  'passes', (select count(*) from public.tide_quiz_passes where tide_id = p_tide_id),
  'questions', (select coalesce(jsonb_agg(jsonb_build_object('id', qq.id, 'position', qq.position, 'prompt', qq.prompt,
     'options', to_jsonb(qq.options), 'correct', k.correct_index, 'explanation', coalesce(k.explanation, '')) order by qq.position), '[]'::jsonb)
   from public.tide_quiz_questions qq left join private.tide_quiz_keys k on k.question_id = qq.id where qq.tide_id = p_tide_id));
end $$;

create or replace function public.admin_save_tide_quiz(p_tide_id uuid, p_expected_version integer, p_questions jsonb, p_publish boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare quiz public.tide_quizzes; item jsonb; n integer; pos integer := 0; opts text[]; question_uuid uuid; correct smallint;
 complete boolean := true;
begin
 if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_publish is null then raise exception 'Choose draft or published' using errcode='22023'; end if;
 perform 1 from public.tides where id = p_tide_id for update;
 if not found then raise exception 'Lesson not found' using errcode='P0002'; end if;
 select * into quiz from public.tide_quizzes where tide_id = p_tide_id for update;
 if found and p_expected_version is distinct from quiz.version then
  raise exception 'This quiz changed. Reload it before saving.' using errcode='40001';
 end if;
 if not found and p_expected_version is not null then
  raise exception 'This quiz changed. Reload it before saving.' using errcode='40001';
 end if;
 if p_questions is null or jsonb_typeof(p_questions) <> 'array' then raise exception 'Invalid quiz' using errcode='22023'; end if;
 n := jsonb_array_length(p_questions);
 if n > 5 then raise exception 'A quiz has at most five questions' using errcode='22023'; end if;
 for item in select value from jsonb_array_elements(p_questions) loop
  if jsonb_typeof(item) <> 'object' or jsonb_typeof(item->'options') <> 'array' or jsonb_array_length(item->'options') <> 4
   or exists (select 1 from jsonb_array_elements(item->'options') o where jsonb_typeof(o) <> 'string')
   or coalesce(jsonb_typeof(item->'prompt'), 'null') not in ('string')
   or coalesce(jsonb_typeof(item->'explanation'), 'string') <> 'string'
   or coalesce(jsonb_typeof(item->'correct'), 'null') not in ('number', 'null') then
   raise exception 'Invalid quiz question' using errcode='22023';
  end if;
  if item->'correct' is not null and jsonb_typeof(item->'correct') = 'number'
   and ((item->>'correct')::numeric not in (0,1,2,3)) then raise exception 'Invalid correct answer' using errcode='22023'; end if;
  if length(btrim(item->>'prompt')) = 0 or length(btrim(coalesce(item->>'explanation', ''))) = 0
   or jsonb_typeof(item->'correct') is distinct from 'number'
   or exists (select 1 from jsonb_array_elements_text(item->'options') o where length(btrim(o)) = 0) then
   complete := false;
  end if;
 end loop;
 if p_publish and (n <> 5 or not complete) then
  raise exception 'A published quiz needs five questions, four options each, one correct answer and an explanation' using errcode='22023';
 end if;
 if quiz.tide_id is null then
  insert into public.tide_quizzes(tide_id, status, version, published_at, updated_by)
  values (p_tide_id, case when p_publish then 'published'::public.quiz_status else 'draft'::public.quiz_status end, 1,
   case when p_publish then now() end, auth.uid()) returning * into quiz;
 else
  -- Any save after the first bumps the version, so members holding an older copy are asked to reload.
  update public.tide_quizzes set status = case when p_publish then 'published'::public.quiz_status else 'draft'::public.quiz_status end,
   version = version + 1, published_at = case when p_publish then coalesce(published_at, now()) end,
   updated_at = now(), updated_by = auth.uid()
  where tide_id = p_tide_id returning * into quiz;
 end if;
 delete from public.tide_quiz_questions where tide_id = p_tide_id;
 for item in select value from jsonb_array_elements(p_questions) loop
  pos := pos + 1;
  select array_agg(btrim(o) order by ord) into opts from jsonb_array_elements_text(item->'options') with ordinality as x(o, ord);
  insert into public.tide_quiz_questions(tide_id, position, prompt, options)
  values (p_tide_id, pos, btrim(item->>'prompt'), opts) returning id into question_uuid;
  correct := case when jsonb_typeof(item->'correct') = 'number' then (item->>'correct')::smallint end;
  insert into private.tide_quiz_keys(question_id, correct_index, explanation)
  values (question_uuid, correct, btrim(coalesce(item->>'explanation', '')));
 end loop;
 return public.admin_get_tide_quiz(p_tide_id);
end $$;

create or replace function public.admin_unpublish_tide_quiz(p_tide_id uuid, p_expected_version integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare quiz public.tide_quizzes;
begin
 if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 select * into quiz from public.tide_quizzes where tide_id = p_tide_id for update;
 if not found then raise exception 'Quiz not found' using errcode='P0002'; end if;
 if p_expected_version is distinct from quiz.version then raise exception 'This quiz changed. Reload it before saving.' using errcode='40001'; end if;
 update public.tide_quizzes set status = 'draft', version = version + 1, published_at = null, updated_at = now(), updated_by = auth.uid()
 where tide_id = p_tide_id;
 return public.admin_get_tide_quiz(p_tide_id);
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- Member energy.
create or replace function public.get_energy_status() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
 if private.current_role() is null then raise exception 'Active account required' using errcode='42501'; end if;
 return jsonb_build_object('active', private.energy_active());
end $$;

-- p_kind: null (all), 'trace', 'tide' or 'quiz'. A reversal belongs to the kind of the award it reverses.
create or replace function public.get_my_energy(p_limit integer default 20, p_offset integer default 0, p_kind text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid(); wanted public.energy_award_type;
begin
 if actor is null or private.current_role() is null then raise exception 'Active account required' using errcode='42501'; end if;
 if p_limit is null or p_limit not between 1 and 50 or p_offset is null or p_offset < 0 then raise exception 'Invalid page' using errcode='22023'; end if;
 if p_kind is not null and p_kind not in ('trace','tide','quiz') then raise exception 'Invalid filter' using errcode='22023'; end if;
 wanted := case p_kind when 'trace' then 'trace_approval' when 'tide' then 'tide_completion' when 'quiz' then 'quiz_pass' end;
 return jsonb_build_object(
  'balance', (select coalesce(sum(amount), 0) from public.energy_ledger where owner_id = actor),
  'active', private.energy_active(),
  'items', (select coalesce(jsonb_agg(private.energy_entry_json(e) order by e.created_at desc, e.id), '[]'::jsonb) from (
    select e.* from public.energy_ledger e left join public.energy_ledger o on o.id = e.reverses_id
    where e.owner_id = actor and (wanted is null or coalesce(o.award_type, e.award_type) = wanted)
    order by e.created_at desc, e.id limit p_limit offset p_offset) e));
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- Staff: award status of reviewed Traces, flagging, own flags.
create or replace function public.staff_energy_awards(p_trace_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
 if not private.is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 if p_trace_ids is null or cardinality(p_trace_ids) > 100 then raise exception 'Between 0 and 100 Traces' using errcode='22023'; end if;
 return jsonb_build_object('active', private.energy_active(),
  'awards', (select coalesce(jsonb_agg(jsonb_build_object(
    'trace_id', e.source_id, 'ledger_id', e.id, 'amount', e.amount, 'created_at', e.created_at,
    'owner_name', p.display_name,
    'reversed', exists (select 1 from public.energy_ledger r where r.reverses_id = e.id),
    'open_flag', exists (select 1 from public.energy_flags f where f.ledger_id = e.id and f.status = 'open'),
    'my_flags', (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'status', f.status, 'reason', f.reason,
       'resolution_reason', f.resolution_reason, 'resolved_at', f.resolved_at, 'created_at', f.created_at) order by f.created_at desc), '[]'::jsonb)
       from public.energy_flags f where f.ledger_id = e.id and f.flagged_by = auth.uid()))), '[]'::jsonb)
   from public.energy_ledger e join public.profiles p on p.id = e.owner_id
   where e.award_type = 'trace_approval' and e.source_id = any(p_trace_ids)));
end $$;

create or replace function public.flag_energy_award(p_ledger_id uuid, p_reason text) returns public.energy_flags
language plpgsql security definer set search_path = '' as $$
declare e public.energy_ledger; flag public.energy_flags; label text;
begin
 if not private.is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 if coalesce(length(btrim(p_reason)), 0) not between 1 and 2000 then raise exception 'Reason required' using errcode='22023'; end if;
 select * into e from public.energy_ledger where id = p_ledger_id for update;
 if not found then raise exception 'Award not found' using errcode='P0002'; end if;
 if e.award_type <> 'trace_approval' then raise exception 'Only Trace awards can be flagged' using errcode='22023'; end if;
 if e.owner_id = auth.uid() then raise exception 'Cannot flag your own award' using errcode='42501'; end if;
 if exists (select 1 from public.energy_ledger where reverses_id = e.id) then raise exception 'This award was already reversed' using errcode='22023'; end if;
 if exists (select 1 from public.energy_flags where ledger_id = e.id and status = 'open') then
  raise exception 'This award already has an open flag' using errcode='23505';
 end if;
 insert into public.energy_flags(ledger_id, flagged_by, reason) values (e.id, auth.uid(), btrim(p_reason)) returning * into flag;
 label := coalesce(private.energy_source_title(e.award_type, e.source_id), 'a Trace');
 insert into public.notifications(recipient_id, type, message)
 select p.id, 'energy_flag', format('New energy flag to review: "%s".', label)
 from public.profiles p where p.role = 'admin' and p.status = 'active' and p.id <> auth.uid();
 return flag;
end $$;

create or replace function public.staff_my_energy_flags(p_limit integer default 20, p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
 if not private.is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 if p_limit is null or p_limit not between 1 and 50 or p_offset is null or p_offset < 0 then raise exception 'Invalid page' using errcode='22023'; end if;
 return (select coalesce(jsonb_agg(row order by created_at desc, id), '[]'::jsonb) from (
  select f.id, f.created_at, jsonb_build_object('id', f.id, 'ledger_id', f.ledger_id, 'status', f.status, 'reason', f.reason,
   'resolution_reason', f.resolution_reason, 'resolved_at', f.resolved_at, 'created_at', f.created_at,
   'trace_id', e.source_id, 'title', coalesce(private.energy_source_title(e.award_type, e.source_id), 'Untitled'),
   'owner_name', p.display_name, 'amount', e.amount) as row
  from public.energy_flags f join public.energy_ledger e on e.id = f.ledger_id join public.profiles p on p.id = e.owner_id
  where f.flagged_by = auth.uid()
  order by f.created_at desc, f.id limit p_limit offset p_offset) s);
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- Admin investigations.
create or replace function public.dismiss_energy_flag(p_flag_id uuid, p_reason text) returns public.energy_flags
language plpgsql security definer set search_path = '' as $$
declare flag public.energy_flags; e public.energy_ledger;
begin
 if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if coalesce(length(btrim(p_reason)), 0) not between 1 and 2000 then raise exception 'Reason required' using errcode='22023'; end if;
 select * into flag from public.energy_flags where id = p_flag_id for update;
 if not found then raise exception 'Flag not found' using errcode='P0002'; end if;
 if flag.status <> 'open' then raise exception 'Flag is not open' using errcode='22023'; end if;
 select * into e from public.energy_ledger where id = flag.ledger_id;
 update public.energy_flags set status = 'dismissed', resolved_by = auth.uid(), resolved_at = now(), resolution_reason = btrim(p_reason)
 where id = flag.id returning * into flag;
 insert into public.admin_audit_logs(actor_id, target_user_id, action, old_values, new_values, reason)
 values (auth.uid(), e.owner_id, 'dismiss_energy_flag', jsonb_build_object('flag_id', flag.id, 'ledger_id', e.id, 'status', 'open'),
  jsonb_build_object('flag_id', flag.id, 'ledger_id', e.id, 'status', 'dismissed'), btrim(p_reason));
 -- The member is never told about a dismissed flag; only the moderator who raised it.
 insert into public.notifications(recipient_id, type, message)
 select flag.flagged_by, 'energy_flag_outcome', format('Your flag on "%s" was reviewed: dismissed. Reason: %s',
  coalesce(private.energy_source_title(e.award_type, e.source_id), 'a Trace'), btrim(p_reason))
 where flag.flagged_by <> auth.uid() and exists (select 1 from public.profiles where id = flag.flagged_by and status = 'active');
 return flag;
end $$;

-- Reverse any award once. The original stays; a compensating entry is added. Final: there is no undo.
create or replace function public.reverse_energy_award(p_ledger_id uuid, p_reason text) returns public.energy_ledger
language plpgsql security definer set search_path = '' as $$
declare e public.energy_ledger; reversal public.energy_ledger; label text; what text; flag public.energy_flags;
begin
 if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if coalesce(length(btrim(p_reason)), 0) not between 1 and 2000 then raise exception 'Reason required' using errcode='22023'; end if;
 select * into e from public.energy_ledger where id = p_ledger_id for update;
 if not found then raise exception 'Award not found' using errcode='P0002'; end if;
 if e.award_type = 'reversal' then raise exception 'A reversal cannot be reversed' using errcode='22023'; end if;
 if e.owner_id = auth.uid() then raise exception 'Cannot reverse your own award' using errcode='42501'; end if;
 if exists (select 1 from public.energy_ledger where reverses_id = e.id) then raise exception 'This award was already reversed' using errcode='22023'; end if;
 insert into public.energy_ledger(owner_id, award_type, source_id, amount, reverses_id, reason, created_by)
 values (e.owner_id, 'reversal', e.id, -e.amount, e.id, btrim(p_reason), auth.uid()) returning * into reversal;
 label := coalesce(private.energy_source_title(e.award_type, e.source_id), 'Untitled');
 what := case e.award_type when 'trace_approval' then format('your Trace "%s"', label)
  when 'tide_completion' then format('completing "%s"', label) else format('passing the quiz on "%s"', label) end;
 insert into public.admin_audit_logs(actor_id, target_user_id, action, old_values, new_values, reason)
 values (auth.uid(), e.owner_id, 'reverse_energy_award', jsonb_build_object('ledger_id', e.id, 'amount', e.amount),
  jsonb_build_object('ledger_id', e.id, 'reversal_id', reversal.id, 'amount', reversal.amount), btrim(p_reason));
 insert into public.notifications(recipient_id, type, message)
 select e.owner_id, 'energy_reversal', format('An admin reversed %s Tide Energy for %s. Reason: %s', e.amount, what, btrim(p_reason))
 where exists (select 1 from public.profiles where id = e.owner_id and status = 'active');
 for flag in update public.energy_flags set status = 'upheld', resolved_by = auth.uid(), resolved_at = now(), resolution_reason = btrim(p_reason)
  where ledger_id = e.id and status = 'open' returning * loop
  insert into public.notifications(recipient_id, type, message)
  select flag.flagged_by, 'energy_flag_outcome', format('Your flag on "%s" was reviewed: award reversed. Reason: %s', label, btrim(p_reason))
  where flag.flagged_by <> auth.uid() and exists (select 1 from public.profiles where id = flag.flagged_by and status = 'active');
 end loop;
 return reversal;
end $$;

-- p_kind: null, 'trace', 'tide' or 'quiz'. Totals cover everything; the list is paged, newest first.
create or replace function public.admin_energy_activity(p_limit integer default 20, p_offset integer default 0, p_kind text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare wanted public.energy_award_type;
begin
 if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_limit is null or p_limit not between 1 and 50 or p_offset is null or p_offset < 0 then raise exception 'Invalid page' using errcode='22023'; end if;
 if p_kind is not null and p_kind not in ('trace','tide','quiz') then raise exception 'Invalid filter' using errcode='22023'; end if;
 wanted := case p_kind when 'trace' then 'trace_approval' when 'tide' then 'tide_completion' when 'quiz' then 'quiz_pass' end;
 return jsonb_build_object(
  'active', private.energy_active(),
  'totals', jsonb_build_object(
   'open_flags', (select count(*) from public.energy_flags where status = 'open'),
   'awards', (select count(*) from public.energy_ledger where award_type <> 'reversal'),
   'energy_issued', (select coalesce(sum(amount), 0) from public.energy_ledger where award_type <> 'reversal'),
   'reversals', (select count(*) from public.energy_ledger where award_type = 'reversal')),
  'open_flags', (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'ledger_id', f.ledger_id, 'reason', f.reason, 'created_at', f.created_at,
     'title', coalesce(private.energy_source_title(e.award_type, e.source_id), 'Untitled'), 'owner_name', o.display_name,
     'flagged_by_name', s.display_name, 'amount', e.amount) order by f.created_at), '[]'::jsonb)
   from public.energy_flags f join public.energy_ledger e on e.id = f.ledger_id
   join public.profiles o on o.id = e.owner_id join public.profiles s on s.id = f.flagged_by where f.status = 'open'),
  'awards', (select coalesce(jsonb_agg(private.energy_entry_json(e) || jsonb_build_object('owner_name', p.display_name,
     'open_flag', exists (select 1 from public.energy_flags f where f.ledger_id = e.id and f.status = 'open')) order by e.created_at desc, e.id), '[]'::jsonb)
   from (select * from public.energy_ledger where award_type <> 'reversal' and (wanted is null or award_type = wanted)
         order by created_at desc, id limit p_limit offset p_offset) e join public.profiles p on p.id = e.owner_id));
end $$;

create or replace function public.admin_energy_award(p_ledger_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.energy_ledger;
begin
 if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 select * into e from public.energy_ledger where id = p_ledger_id;
 if not found then raise exception 'Award not found' using errcode='P0002'; end if;
 return private.energy_entry_json(e) || jsonb_build_object(
  'owner_name', (select display_name from public.profiles where id = e.owner_id),
  'reversal', (select private.energy_entry_json(r) || jsonb_build_object('created_by_name', p.display_name)
   from public.energy_ledger r left join public.profiles p on p.id = r.created_by where r.reverses_id = e.id),
  'flags', (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'status', f.status, 'reason', f.reason, 'created_at', f.created_at,
     'flagged_by_name', s.display_name, 'resolution_reason', f.resolution_reason, 'resolved_at', f.resolved_at,
     'resolved_by_name', r.display_name) order by f.created_at), '[]'::jsonb)
   from public.energy_flags f join public.profiles s on s.id = f.flagged_by left join public.profiles r on r.id = f.resolved_by
   where f.ledger_id = e.id),
  'audit', (select coalesce(jsonb_agg(jsonb_build_object('action', a.action, 'reason', a.reason, 'created_at', a.created_at,
     'actor_name', p.display_name) order by a.created_at), '[]'::jsonb)
   from public.admin_audit_logs a left join public.profiles p on p.id = a.actor_id
   where a.action in ('dismiss_energy_flag', 'reverse_energy_award') and a.new_values->>'ledger_id' = e.id::text));
end $$;

-- Activation from Settings. Pausing sets null; activating again starts a new boundary (no backfill).
create or replace function public.get_energy_settings() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare saved public.settings;
begin
 if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 select * into saved from public.settings where key = 'energy';
 return jsonb_build_object('active', private.energy_active(), 'activated_at', saved.value->'activated_at',
  'updated_at', saved.updated_at, 'updated_by_name', (select display_name from public.profiles where id = saved.updated_by));
end $$;

create or replace function public.set_energy_active(p_active boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
 if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_active is null then raise exception 'Choose on or off' using errcode='22023'; end if;
 if p_active and private.energy_active() then return public.get_energy_settings(); end if;
 insert into public.settings(key, value) values ('energy', jsonb_build_object('activated_at', case when p_active then to_jsonb(now()) else 'null'::jsonb end))
 on conflict (key) do update set value = excluded.value;
 return public.get_energy_settings();
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- Admin "Needs you": open energy flags (20261109000100 plus one field; member and moderator results unchanged).
create or replace function public.get_dashboard_summary() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid(); actor_role public.app_role := private.current_role(); summary jsonb;
begin
 if actor is null or actor_role is null then raise exception 'Active account required' using errcode='42501'; end if;
 if actor_role = 'user' then
  select jsonb_build_object(
   'traces',count(*) filter(where not is_hidden),
   'removed',count(*) filter(where is_hidden),
   'active_traces',count(*) filter(where status<>'rejected' and not is_hidden),
   'drafts',count(*) filter(where status='draft' and not is_hidden),
   'pending',count(*) filter(where status='pending' and not is_hidden),
   'approved',count(*) filter(where status='approved' and not is_hidden),
   'needs_revision',count(*) filter(where status='revision_requested' and not is_hidden),
   'comments_posted',(select count(*) from public.comments where author_id=actor),
   'tides_finished',(select count(*) from public.tide_completions where user_id=actor),
   'member_since',(select created_at from public.profiles where id=actor)
  ) into summary from public.traces where author_id=actor and deleted_at is null;
 elsif actor_role = 'moderator' then
  select jsonb_build_object(
   'pending',(select count(*) from public.traces where status='pending' and not is_hidden and deleted_at is null),
   'flagged_comments',(select count(distinct comment_id) from public.reports where status='open'),
   'open_reports',(select count(*) from public.reports where status='open'),
   'reviewed_today',(select count(*) from public.moderation_actions where actor_id=actor and action in ('review_trace','review_report') and created_at >= (date_trunc('day',now() at time zone 'Asia/Manila') at time zone 'Asia/Manila'))
  ) into summary;
 else
  select jsonb_build_object(
   'users',(select count(*) from public.profiles),
   'active_users',(select count(*) from public.profiles where status='active'),
   'moderators',(select count(*) from public.profiles where role='moderator' and status='active'),
   'published_traces',(select count(*) from public.traces where status='approved' and not is_hidden and deleted_at is null),
   'published_tides',(select count(*) from public.tides where status='published'),
   'pending',(select count(*) from public.traces where status='pending' and not is_hidden and deleted_at is null),
   'open_reports',(select count(*) from public.reports where status='open'),
   'held_traces',(select count(*) from public.trace_holds h join public.traces t on t.id=h.trace_id where t.status='pending' and not t.is_hidden and t.deleted_at is null),
   'oldest_pending_at',(select min(submitted_at) from public.traces where status='pending' and not is_hidden and deleted_at is null),
   'open_energy_flags',(select count(*) from public.energy_flags where status='open')
  ) into summary;
 end if;
 return summary || jsonb_build_object('id',actor,'role',actor_role,'as_of',now());
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- Function privileges: Supabase grants EXECUTE on new public functions by default, so revoke, then grant
-- only the intended calls. Private helpers are callable only from the definer functions above.
revoke all on function private.energy_ledger_append_only(), private.validate_energy_settings(), private.energy_active(),
 private.issue_award(uuid, public.energy_award_type, uuid), private.energy_source_title(public.energy_award_type, uuid),
 private.energy_entry_json(public.energy_ledger), private.quiz_retry_after(uuid, uuid) from public, anon, authenticated;
revoke all on function public.moderate_trace(uuid, integer, public.trace_state, text), public.complete_tide(uuid),
 public.get_tide_quiz(uuid), public.submit_tide_quiz(uuid, integer, smallint[]),
 public.admin_get_tide_quiz(uuid), public.admin_save_tide_quiz(uuid, integer, jsonb, boolean), public.admin_unpublish_tide_quiz(uuid, integer),
 public.get_energy_status(), public.get_my_energy(integer, integer, text),
 public.staff_energy_awards(uuid[]), public.flag_energy_award(uuid, text), public.staff_my_energy_flags(integer, integer),
 public.dismiss_energy_flag(uuid, text), public.reverse_energy_award(uuid, text),
 public.admin_energy_activity(integer, integer, text), public.admin_energy_award(uuid),
 public.get_energy_settings(), public.set_energy_active(boolean), public.get_dashboard_summary() from public, anon, authenticated;
grant execute on function public.moderate_trace(uuid, integer, public.trace_state, text), public.complete_tide(uuid),
 public.get_tide_quiz(uuid), public.submit_tide_quiz(uuid, integer, smallint[]),
 public.admin_get_tide_quiz(uuid), public.admin_save_tide_quiz(uuid, integer, jsonb, boolean), public.admin_unpublish_tide_quiz(uuid, integer),
 public.get_energy_status(), public.get_my_energy(integer, integer, text),
 public.staff_energy_awards(uuid[]), public.flag_energy_award(uuid, text), public.staff_my_energy_flags(integer, integer),
 public.dismiss_energy_flag(uuid, text), public.reverse_energy_award(uuid, text),
 public.admin_energy_activity(integer, integer, text), public.admin_energy_award(uuid),
 public.get_energy_settings(), public.set_energy_active(boolean), public.get_dashboard_summary() to authenticated;
commit;

