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
