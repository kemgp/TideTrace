# Egress reduction plan

Written 2026-11-16. Status: PR 1a and 1b released to production (20 to 21 Nov). Phase 2 (C1) built on `feature/storage-cleanup` (21 Nov): removed draft photos deleted at once, photos removed during a revision kept for staff until 30 days after the final decision, deleted when the author opens My Contributions. C2 not needed: production had no orphans on 21 Nov; rerun the orphan query every month or two.

## Why

- The organization is on the Supabase Free plan and is over its egress allowance for the cycle 18 Oct to 18 Nov 2026: 7.59 GB used of 5 GB. The production project shows "Exceeding usage limits".
- Nearly all of it is production (`TideTrace Database`). Staging used at most about 13 MB on its busiest day.
- On production, Storage is 97 to 99% of egress every day. Database (PostgREST) and Auth are a few MB a day.
- Peak days were 1 to 4 Nov at about 750 to 845 MB each. Recent days are much lower.
- Cached egress is almost empty, so photos are being served fresh every time.
- Releasing adds real traffic on top of this, so the causes below should be fixed first.

## Findings from production (17 Nov)

- `tide-assets` is not the problem: every lesson cover, image and PDF is under 231 kB.
- `trace-media` holds about 33 MB attached to Traces. The large files are Trace photos of 2 to 13 MB. Correction (18 Nov): photos were only compressed in the browser when Data Saver was on, so large originals kept arriving; PR 1b compresses every photo.
- Only two large photos are public (approved, not hidden): "Fish" (a member's, about 2.9 MB) and "TEst" (a test Trace, about 2.9 MB). The rest are pending, rejected, draft or hidden, so only their author and staff load them.
- The largest file (13 MB) is an orphan: no Trace uses it. It costs storage, not egress.
- Public photos load on the landing page strip (`useRecentTraces`, up to 10 photos for every visitor, signed out included), the Traces list, the map and Trace pages, with a new link every time.
- Immediate steps (no code): delete the "TEst" Trace and other own test Traces; delete the 13 MB orphan in the Storage dashboard. Keep "Fish" and fix it with the backfill in E3.

## Causes found in the code

| # | Cause | Where |
|---|-------|-------|
| 1 | Every photo link is new, so the browser never reuses a download. Trace photo links expire after 60 seconds; Tide cover, lesson image and slide links are signed again on every request. Supabase cannot produce the same signed link twice, so the "rounded expiry" idea in the speed plan (S1) does not work as written. | `server/src/routes/media.js` (`media/:id/url`, `tides/:id/cover`, `tides/:id/slides`, `tides/:id/images`), `withCoverUrls` in `server/src/routes/content.js` |
| 2 | List cards load the full photo (up to 1600 px). Cards are seen far more often than detail pages. | `client/src/components/TraceCard.jsx` |
| 3 | Admin uploads are stored as uploaded: covers and lesson images up to 5 MB each, slides PDFs up to 25 MB. Only Trace photos are compressed (`compressPhoto.js`). | `media.js` Tide routes, admin Tide editor |
| 4 | Slides PDFs are downloaded whole on every lesson view (range requests are off on purpose because links expire). | `client/src/api/pdfDocument.js`, `SlidesViewer.jsx` |
| 5 | Trace videos can be 20 MB and are not compressed (they only download when played: `preload="none"`). | `media.js` Trace upload, `TracePhotos.jsx` |
| 6 | Removing a photo from a draft deletes only the database row; the file stays in storage. Failed uploads also leave files. No cleanup job exists (see `supabase/README.md`). This costs storage space, not egress. | `detach_trace_media` in the initial schema |

## Decisions needed (recommendation first)

- **D1. Photo link lifetime.** Recommended: 1 hour for photos of approved, visible, not deleted Traces and for published Tide files; keep 60 seconds for drafts, pending, held, hidden and staff-only views. Trade-off: a copied link to a public photo works for up to an hour, including after the Trace is hidden or deleted.
- **D2. Card thumbnails.** Recommended: the browser makes a 480 px WebP copy at upload, stored beside the original. Supabase image resizing needs a paid plan. Photos uploaded before the change keep using the original on cards.
- **D3. Video cap.** Recommended: lower from 20 MB to 8 MB. Alternatives: keep 20 MB, or turn video off.
- **D4. Slides cap (low priority: Tide files are small today).** Recommended: lower from 25 MB to 10 MB, with a hint to export the PDF at a smaller size.
- **D5. Abandoned drafts.** Recommended: no action now. Their photos belong to members. Revisit with a rule such as "drafts untouched for 90 days" if they pile up.

## Phase 0: measure (you, in the production dashboard, no code)

1. Run these read-only queries in the SQL editor and note the results.

```sql
-- Largest files in all buckets.
select bucket_id, name, pg_size_pretty((metadata->>'size')::bigint) as size, created_at
from storage.objects
order by (metadata->>'size')::bigint desc nulls last
limit 20;

-- Size of each bucket.
select bucket_id, count(*) as files, pg_size_pretty(sum((metadata->>'size')::bigint)) as total
from storage.objects group by bucket_id;

-- Trace files with no database record (orphans), split by age.
select (o.created_at < now() - interval '24 hours') as older_than_a_day,
       count(*) as files, pg_size_pretty(sum((o.metadata->>'size')::bigint)) as total
from storage.objects o
where o.bucket_id = 'trace-media'
  and not exists (select 1 from public.trace_media m where m.object_path = o.name)
group by 1;

-- Tide files no lesson points to.
select count(*) as files, pg_size_pretty(sum((o.metadata->>'size')::bigint)) as total
from storage.objects o
where o.bucket_id = 'tide-assets'
  and not exists (select 1 from public.tides t where o.name in (t.cover_path, t.slides_path))
  and not exists (select 1 from public.tide_images i where i.object_path = o.name);

-- Attached Trace files by Trace status (drafts included).
select t.status, count(*) as files, pg_size_pretty(sum(m.size_bytes)) as total
from public.trace_media m join public.traces t on t.id = m.trace_id
group by t.status order by sum(m.size_bytes) desc;
```

2. Re-save oversized Tide covers and lesson images (anything over about 500 KB) at 1600 px wide and re-upload them in the admin editor.
3. Test on staging, not production, from now on.
4. Read what the usage page says happens at the limit. The cycle resets on 18 Nov.

## Phase 1: `feature/reduce-egress` (before release)

**E1. Reuse photo links (largest saving).**
- New `server/src/signedUrls.js`: an in-memory cache keyed by bucket and path. It returns the same signed link while at least 15 minutes of a 1 hour link remain, otherwise it signs a new one. It has a size cap of about 5,000 entries and drops the oldest.
- Each request still runs its own table query under row-level security before a link is handed out. Only the link string is reused, never the access check.
- Use it, per D1, for `media/:id/url` (public Traces only), Tide covers (`withCoverUrls` and `tides/:id/cover`), lesson images and slides (600 seconds raised to 1 hour, published lessons only).
- New uploads set `cacheControl: "31536000"`. Paths are unique per upload and never overwritten (`upsert: false`), so long caching is safe.
- Client: `TraceCard` and `TracePhotos` keep a per-session map from media id to link, so the list and the detail page share one download.
- Speed plan S1 (send photo links with the list) becomes easy after this and can follow later.

**E2. Compress admin images.**
- Covers and lesson images go through `compressPhoto` before upload (1600 px, WebP), the same as Trace photos.
- Server limits stay as a backstop.

**E3. Card thumbnails (speed plan S6, pulled forward).**
- The Trace upload also creates a 480 px WebP copy, `<uuid>.thumb.webp`, in the same folder.
- A small additive migration adds `thumb_path` to `trace_media`, with an owner-only RPC to set it on editable drafts. Check that the storage read policy covers the new file name.
- `TraceCard` and the landing strip use the thumbnail when present and the original otherwise.
- One-off backfill for existing photos over 500 kB: make a 1600 px WebP display copy and a 480 px thumbnail, and add a `display_path` the detail page and viewer use. The original is never changed (evidence stays as submitted). You run it on the Mac with the service key from your environment, dry run first.
- Add `width` and `height` on card images.

**E4. Slides and video caps.**
- Slides limit per D4, with an admin hint.
- Video limit per D3, on the client check, the server route and the `trace-media` bucket setting (the bucket limit is changed in the dashboard).

**Tests.**
- Server: link reuse and expiry, cache cap, non-public Traces get 60 second links that are never reused, upload `cacheControl`.
- Client: cards use the thumbnail and fall back to the original, a link is reused across list and detail, admin images are compressed, new size limits and their messages.
- SQL: the `thumb_path` RPC rejects other owners and non-editable Traces.

**Check on staging.**
- Open the Traces list, open a Trace, go back. In the browser network panel the photos should show as from cache the second time, and card images should be well under 100 KB.
- Watch the staging egress chart for a day of normal testing.

## Phase 2: `feature/storage-cleanup` (after release is fine)

- **C1. Stop creating orphans.** When a member removes a photo from a draft, retire the path in the database and delete the file through the Storage API. Model it on the existing profile-photo cleanup (`supabase/README.md`): a private retirement table, a claim function, and a narrow delete policy for claimed paths only. Submitted evidence stays undeletable.
- **C2. Clear existing orphans once.** A script that lists `trace-media` and `tide-assets` files with no database record and older than 24 hours. It runs as a dry run by default and deletes through the Storage API only when told to. You run it on the Mac with the service key from your environment, which is never committed or printed.
- **C3. Abandoned drafts.** Per D5.

## Phase 3: after release

- Check the production usage page daily for the first week and compare with the 1 to 4 Nov peak.
- If traffic still outgrows the Free plan, the choice is between more of this work and a paid Supabase plan. That decision is yours.

## Order

1. Phase 0 (you).
2. Decide D1 to D4.
3. PR 1: E1 and E2 first (no migration), then E3 and E4.
4. Staging check, then Phase A step 8.
5. PR 2: Phase 2.
