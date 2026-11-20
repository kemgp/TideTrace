# Phase A release checklist (step 8): `staging` into `main`

Written 20 Nov 2026. What goes live: Phase A steps 3 to 7 (quizzes, moderator flags, admin Energy activity, the dashboard flags item) with Tide Energy **switched off**, plus egress PRs 1a and 1b (reused photo links, restricted photos through the API, compressed uploads, thumbnails and display copies). Turning Tide Energy on is a separate, later decision (Part E).

Allow about 45 minutes. Do Parts B and C in one sitting: step C1d starts the 8 MB upload limit, and production's current app only compresses photos for Data Saver users until C3 deploys the new one.

## A. Already done on staging

- [x] Phase A steps 1 to 7 merged and checked on staging (awards, quizzes, flags, Energy activity, case page, dashboard item).
- [x] Egress PR 1a checked: photos from memory cache on the second view, draft photos as `blob:` addresses, a 7 MB lesson cover stored as 256 kB WebP.
- [x] Egress PR 1b checked: small card images, sharp Trace page, new uploads get a `.thumb.webp`; staging backfill done (4 photos, 0 failed).
- [x] Tests on the Mac: client 760, server 186, all SQL checks.
- [x] Energy off: covered by tests (routes 404, no energy UI). Also checked by hand on production in C4.

## B. Prepare (no changes yet)

1. **Production settings stay off.** Render production service: `ENERGY_ENABLED` unset or `false`. Vercel, Production environment: `VITE_ENERGY_ENABLED` unset or `false`.
2. **See which migrations production already has.** Production Supabase, SQL Editor:

   ```sql
   select
     to_regclass('public.energy_ledger') is not null as has_tide_energy,
     to_regprocedure('public.get_quiz_ready()') is not null as has_quiz_ready,
     not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tide_completions' and policyname = 'completions_insert') as completion_insert_revoked,
     exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'trace_media' and column_name = 'thumb_path') as has_media_copies;
   ```

   Run in C1 only the migrations whose column says `false`.
3. **Backup.** Production Supabase, Database, Backups: note the latest backup. If your plan has none, that is acceptable here: every migration below only adds tables, functions, columns and policies, and the one removal (the direct insert permission on `tide_completions`) can be granted back.
4. **Have ready:** the production project reference (from the dashboard address bar) and where to copy the production secret key (Project Settings, API Keys). Do not copy the key until C2.

## C. Release (in this order)

1. **Migrations on production**, SQL Editor, one file at a time, oldest first, skipping any already present:
   - a. `supabase/migrations/20261110000100_tide_energy.sql`: inert while energy is off; safe to rerun.
   - b. `supabase/migrations/20261111000100_quiz_ready.sql`
   - c. `supabase/migrations/20261116000100_revoke_completion_insert.sql`: safe now, because production's API has called `complete_tide` since Phase A step 2.
   - d. `supabase/migrations/20261118000100_trace_media_copies.sql`: photo copies; sets the `trace-media` limit to 8 MB.
   - Run the B2 query again: all four columns `true`.
2. **Photo backfill on production**, Terminal, repo root:

   ```
   read -s SUPABASE_SERVICE_ROLE_KEY && export SUPABASE_SERVICE_ROLE_KEY
   SUPABASE_URL=https://PRODUCTION-REF.supabase.co node scripts/backfill-media-variants.mjs
   SUPABASE_URL=https://PRODUCTION-REF.supabase.co node scripts/backfill-media-variants.mjs --apply
   unset SUPABASE_SERVICE_ROLE_KEY
   ```

   Paste the production `sb_secret_…` key at the silent prompt. The dry run downloads nothing; check its list (expect about 25 to 30 photos, display copies for the large ones) before `--apply`. Rerun `--apply` if any failed. Then, in the SQL Editor:

   ```sql
   select count(*) filter (where thumb_path is null) as without_thumbnail,
          count(*) filter (where display_path is not null) as with_display_copy
   from public.trace_media m join public.traces t on t.id = m.trace_id
   where m.mime_type like 'image/%' and t.deleted_at is null;
   ```

   `without_thumbnail` should be 0.
3. **Merge.** GitHub: new pull request, base `main`, compare `staging`, title "Phase A release: quizzes, flags, Energy activity (energy off) and egress reductions". Merge it. Wait for the Render production deploy and the Vercel production deploy to finish.
4. **Smoke test production** (about 10 minutes, browser Network panel open):
   - [ ] Landing page loads; the recent Traces strip shows photos.
   - [ ] Signed in as a member: Traces list cards load; card images are small; going back to the list shows `(memory cache)`.
   - [ ] A Trace page shows its photo sharply.
   - [ ] New draft with a large phone photo: it uploads (resized first), and its `trace-media` folder gets a `.thumb.webp`. Delete the draft afterwards.
   - [ ] A lesson can still be completed.
   - [ ] Moderator: the review queue opens a pending Trace and its photo shows (image address starts with `blob:`).
   - [ ] Admin: dashboard loads.
   - [ ] Energy is off everywhere: no energy pill, no Energy activity in Insights, no quiz on lessons, no flag buttons. Opening `https://PRODUCTION-API/api/energy` gives "API route not found".
5. **Note it.** Add a line to `handoff.md` with the date and what was released.

## D. If something goes wrong

- **App broken after C3:** on GitHub, open the merged release pull request and click **Revert**, then merge the revert pull request. Production goes back to the previous code. Leave the migrations in place: they are additive and the old code ignores them.
- **Then also:** in production Storage, set the `trace-media` bucket file size limit back to 20 MB, because the old app uploads photos uncompressed.
- **Backfill problems:** the originals are never changed. Rerun the script; finished photos are skipped.

## E. Later: turning Tide Energy on (separate decision)

Do not do this as part of the release. Before it:

- [ ] Update `docs/legal/` privacy policy and terms for the energy ledger, quiz attempts and moderator flags (not done yet; required before public use).
- [ ] Moderators know how to flag awards and admins how to review them.
- [ ] At least one quiz is written and published.

Then, in this order: set `ENERGY_ENABLED=true` on Render production; set `VITE_ENERGY_ENABLED=true` on Vercel Production and redeploy **without the build cache**; check the energy screens appear; then Admin, Settings, activate Tide Energy (awards start from that moment, with no backfill).

Rollback: pause energy in Settings (no more awards), then set both flags to `false`. Never drop tables; issued awards stay and can be reversed by an admin.

## F. After the release

- Production Supabase usage page, daily for a week: egress per day should stay far below the 1 to 4 Nov peak (about 800 MB a day). The cycle runs 18 Nov to 18 Dec; restrictions apply if the organization goes over 5 GB again.
- Next planned work: egress Phase 2 (storage cleanup), then the speed and code health plan (CI first).
