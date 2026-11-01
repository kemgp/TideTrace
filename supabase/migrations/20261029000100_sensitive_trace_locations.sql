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
