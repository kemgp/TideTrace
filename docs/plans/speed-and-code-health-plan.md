# Speed and code health plan

Written 14 Nov 2026 from a walk through production (`tide-trace.vercel.app`, member account, 1440px and 375px) and a read of `staging` plus the uncommitted `feature/energy-flags` work. Planning only: no application code was changed.

Each step is one branch from `staging` and one pull request, in the order given. Nothing here changes what a member can see or do.

## Part 1: Speed

### What was measured

- API calls from the browser took 0.4 to 1.0 seconds each. A page makes three to five.
- `GET /api/dashboard` ran four times across a handful of page views.
- The production build is one 784 KB script and one 256 KB stylesheet (`client/dist/assets`), loaded by every visitor.

### Why it is slow (from the code)

1. **Every signed-in request makes three trips to Supabase in a row.** `authenticate` in `server/src/middleware.js` calls `auth/v1/user`, then `get_my_profile`, and only then does the route run its own query.
2. **Photos cost one API call each and are never cached.** `TraceCard`, `TraceThumb` and `useRecentTraces` call `GET /api/media/:id/url` per photo. That route runs a table query and a storage call, and returns a link that expires in 60 seconds, so the address changes on every visit and the browser downloads the photo again. The original upload is used at every size.
3. **The client keeps nothing between pages.** `useRemoteData` and `useDashboard` hold results in component state, so every mount refetches. Four components call `useDashboard` separately. Polling adds the unread count every 20 seconds, the notification list every 60 and the dashboard every 30.
4. **The API forbids caching.** `security()` sets `Cache-Control: no-store` on every response, including categories and community totals.
5. **One bundle for all roles.** `App.jsx` imports every page statically, so members download the admin and moderator screens, the landing effects and unused `gsap`.

### Steps

**S1. Send photo links with the list (largest visible win).**
- Built 25 Nov 2026 on `feature/speed-s1-photo-links` (see `handoff.md`). Uses the E1 link cache and the thumbnail and display copies. The moderation list is left out: its photos are restricted and stay on `/media/:id/file`.
- Server: in `content.js`, sign Trace photo paths in one batch with `createSignedUrls`, the way `withCoverUrls` already does for lesson covers, and add `url` to each `trace_media` row on `GET /traces`, `/traces/:id`, `/traces/:id/related`, `/contributions` and the moderation list.
- Use a one hour expiry. Supabase cannot sign the same link twice, so reuse links from the server-side cache in `egress-reduction-plan.md` (E1) instead of rounding.
- Client: `TraceCard`, `TraceThumb` and `useRecentTraces` use the supplied `url` and fall back to `media/:id/url` only when it is missing.
- Keep `GET /media/:id/url` for the photo viewer and retries.
- Check: opening the archive makes one API call, not seven. Hidden and deleted Traces still return no link (existing storage rules).

**S2. Stop repeating the sign-in check.**
- Built 28 Nov 2026 on `feature/speed-s2-auth-cache` (see `handoff.md`). Changed from the plan: staff and admin routes always check fresh, so losing a role still takes effect on the next request; only member reads reuse the check. Also sends `Access-Control-Max-Age: 600` so the CORS preflight is not repeated before every call.
- Server: cache the result of `authenticate` (user id and profile) in memory for 30 seconds, keyed by a hash of the token, with a size cap. Never cache failures.
- Row-level security still checks every query, so a suspended account loses data access at once; only the API-level 403 can lag by up to 30 seconds. State this in `DEPLOYMENT.md`.
- Later option: verify the token signature locally with Supabase signing keys. Read the current Supabase documentation before choosing this.
- Check: server timing for a signed-in request drops from three upstream calls to one on a warm cache. Add tests for expiry, a changed token and a suspended profile.

**S3. One shared read cache in the client.**
- Add a small cache inside `readData` (or a `useCachedData` hook): one in-flight request per path, last result reused while a refresh runs, cleared on sign-out and after any write to a related path.
- Move `useDashboard` and `useNotifications` onto it so four components share one request.
- Slow the polls: unread count to 60 seconds, dashboard refresh on focus only. Keep the 20 second check only while Tide Energy notices need it, or replace it with Supabase Realtime later.
- Check: moving Dashboard, Traces, Tides, Contributions and back makes each list request once; pages paint from the cache first.

**S4. Allow short caching where the data is public.**
- `Cache-Control: private, max-age=60` for `categories` and `community-summary`; `public, max-age=60` for the signed-out trace list used by the landing page. Everything else stays `no-store`.

**S5. Smaller downloads.**
- `React.lazy` per role: landing page, member, moderator, admin. Lazy-load `GradientWaves`, `MetaBalls` and `RotatingText`.
- Remove `gsap`. Replace `framer-motion` (used only by `RotatingText`) with CSS.
- Rename `vite.config.js` to `vite.config.mjs`.
- Self-host the three font families, only the weights in use.
- Check: `npm run build` shows a member entry under about 300 KB and no bundle-size warning.

**S6. Right-sized photos.** Moved into `egress-reduction-plan.md` (E3).
- At upload, `compressPhoto.js` also produces a card-sized copy (about 640px wide, WebP) stored beside the original; cards and thumbnails use it, the detail page and viewer use the original.
- Add `width`, `height` and `loading="lazy"` on card images (the first row stays eager).
- Needs a small additive migration for the second path. Old Traces keep using the original.

**S7. Hosting checks (settings, no code).**
- Render: confirm the service is in the same region as the Supabase project (Singapore is closest to Iloilo for both).
- Render free instances sleep after idle time and take up to a minute to wake. For the demo, use a paid instance or a keep-alive ping to `/api/health`.

### How to measure

Before S1, record on production with the browser network panel: time to first photo on the archive, number of API calls per page, and the median duration of `/api/dashboard`. Repeat after S1, S2, S3 and S5 on staging.

## Part 2: Code health

**C1. Continuous integration (do first).** Built 21 Nov 2026: `.github/workflows/ci.yml`.
- `.github/workflows/ci.yml`: on every pull request, Node 22, `npm ci`, `npm test`, `npm run build`. Linux runners install their own `node_modules`, so the "tests must run on the Mac" limit stops applying to pull requests.
- Second job: `node supabase/tests/local-check.mjs` with PGlite.
- Then protect `main` and `staging`: require the checks.

**C2. Formatter and linter.**
- Prettier with one config; one commit that only reformats, merged when no other branch is open (it touches every file). Add the commit to `.git-blame-ignore-revs`.
- ESLint with the React hooks and jsx-a11y rules; fix errors, leave warnings for later. Add both to CI.
- This removes the 300 to 850 character lines without hand editing.

**C3. Remove the prototype layer.**
- `AppContext.jsx` still imports `data/mockData.js` and keeps mock traces, tides, reports, history and logs in state, with `addTrace`, `decideTrace` and similar. Find what still reads them (`App.jsx` line 103), move those to the API hooks, then delete the mock state and file.
- Delete the dead files already listed in `handoff.md` (`forgot-password.css`, unused skeleton variants, `TraceMarker` component, `.parked-dashboard-polish/`). Correct the mock-data line in `README.md`.

**C4. Split the large files.**
- `App.jsx` (708 lines): routes into `routes/member.jsx`, `routes/moderator.jsx`, `routes/admin.jsx` (this is also the split S5 needs), footer and shells into components.
- `ReviewTraces.jsx`: `Decision`, `ModWorkspace` and `ModerationHistory` into their own files.
- `server/test/api.test.js` (2,058 lines): one file per route module.
- `server/src/routes/content.js`: traces, tides and notifications into separate routers.

**C5. CSS.**
- Add a check (script in CI) that fails on new raw hex colours outside the token blocks; replace the existing 262 distinct values file by file, starting with `index.css`.
- Fold `ocean.css` overrides into the rules they override, so `.app-shell:is(...)` prefixes and most of the 112 `!important` can go.
- Move the 115 inline `style={{}}` uses into classes where they repeat.
- Decide on Tailwind: it is installed and configured but the styles are plain CSS. Remove it or use it.

**C6. Types at the edges (optional).**
- `// @ts-check` plus JSDoc types on `client/src/api/*` and `server/src/routes/*`, checked by `tsc --noEmit` in CI. No rewrite to TypeScript.

**C7. Explicit columns.**
- Replace `select("*")` on `tides`, `notifications`, `comments` and `settings` reads with named columns, so a new column is a decision.

## Order

1. C1 (CI), so every later step is checked automatically.
2. S1, S2 (the two changes members will feel).
3. C2 (reformat) at a quiet moment, right after Phase A step 6 merges.
4. S3, S4.
5. C3, then C4 together with S5.
6. S6, S7, C5.
7. C6, C7 if time allows.

Phase A step 7 can proceed in parallel with everything except C2 and C4, which touch the same files.
