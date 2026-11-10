-- Hands-on check of Tide Energy on a database where the migration is applied (staging).
-- Paste into the Supabase SQL Editor and run. It acts as your oldest active admin and member,
-- prints a report, and then undoes everything: the run always ends with an error that carries
-- the report, and that error rolls the whole run back. Nothing is saved, nobody is notified.
do $$
declare
 admin_id uuid; member_id uuid; lesson uuid; lesson_title text; draft_ids text[]; r jsonb; n integer;
 report text := '';
begin
 select id into admin_id from public.profiles where role = 'admin' and status = 'active' order by created_at limit 1;
 select id into member_id from public.profiles where role = 'user' and status = 'active' order by created_at limit 1;
 if admin_id is null or member_id is null then raise exception 'Needs one active admin and one active member account.'; end if;
 select t.id, t.title into lesson, lesson_title from public.tides t
 where t.status = 'published' and not exists (select 1 from public.tide_completions c where c.user_id = member_id and c.tide_id = t.id)
 order by t.published_at limit 1;
 if lesson is null then raise exception 'Needs a published lesson the member has not finished yet.'; end if;
 select coalesce(array_agg(id::text), '{}') into draft_ids from public.tides where status <> 'published';

 perform set_config('role', 'authenticated', true);

 perform set_config('request.jwt.claim.sub', member_id::text, true);
 report := report || format(E'\n1. Energy on before the test: %s (expected false)', public.get_energy_status()->>'active');
 begin
  perform public.set_energy_active(true);
  report := report || E'\n2. Member turning energy on: ALLOWED. This is a problem.';
 exception when insufficient_privilege then
  report := report || E'\n2. Member turning energy on: blocked (expected)';
 end;

 perform set_config('request.jwt.claim.sub', admin_id::text, true);
 r := public.set_energy_active(true);
 report := report || format(E'\n3. Admin turns energy on: active = %s (expected true)', r->>'active');

 perform set_config('request.jwt.claim.sub', member_id::text, true);
 r := public.complete_tide(lesson);
 report := report || format(E'\n4. Member finishes "%s": earned %s (expected 5)', lesson_title, r->>'amount');
 r := public.complete_tide(lesson);
 report := report || format(E'\n5. Member finishes it again: earned %s (expected 0)', r->>'amount');
 r := public.get_my_energy();
 report := report || format(E'\n6. Member energy history: %s entries, latest "%s"', jsonb_array_length(r->'items'), r->'items'->0->>'title');
 begin
  update public.energy_ledger set amount = 500;
  report := report || E'\n7. Member editing their energy: ALLOWED. This is a problem.';
 exception when insufficient_privilege then
  report := report || E'\n7. Member editing their energy: blocked (expected)';
 end;
 select count(*) into n from public.energy_ledger;
 report := report || format(E'\n8. Energy entries the member can read: %s (only their own)', n);

 perform set_config('request.jwt.claim.sub', admin_id::text, true);
 report := report || format(E'\n9. Admin dashboard open energy flags: %s (expected 0)', public.get_dashboard_summary()->>'open_energy_flags');

 perform set_config('request.jwt.claim.sub', '', true);
 perform set_config('role', 'anon', true);
 select count(*) into n from storage.objects where bucket_id = 'tide-assets' and split_part(name, '/', 1) = any(draft_ids);
 report := report || format(E'\n10. Draft lesson files a signed-out visitor can list: %s (expected 0)', n);

 raise exception E'TEST RUN ONLY. Everything above was undone.\n%', report;
end $$;
