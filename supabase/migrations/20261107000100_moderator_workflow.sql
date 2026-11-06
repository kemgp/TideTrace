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
