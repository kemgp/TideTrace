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
