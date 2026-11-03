# TideTrace — Handoff (updated 2026-11-02, UI/UX plan added)

Current state of the project, what was changed in the latest session, and what is left.

### Focus ring consistency — `focus-ring-consistency` (2026-11-03, uncommitted)

- Tokens in `index.css`: `--focus-ring`, `--focus-halo`, `--focus-width` (2px). Dark mode swaps to `#a9b8ff` (was the 2.2:1 dark-blue ring on dark surfaces).
- Buttons, links, chips and other controls: `outline: var(--focus-width) solid var(--focus-ring)` with offset. Text fields (`.input`, search wrapper, code input, settings, auth, comment box, moderator select): border in ring colour + 1px inset + 3px halo (about 2.5px solid), no outline. Shared rule for `.app-shell` fields lives in `responsive.css`.
- A wrapper that draws the ring (`.search`) keeps its inner input outline-free. Invalid auth fields keep their red focus. Forced-colours mode draws a real outline.
- New focus styles should use the tokens, not hard-coded colours. Home page (teal on dark) left unchanged on purpose.

### Copy cleanup — `copy-cleanup` (2026-11-03, uncommitted)

- Removed em-dashes from interface strings (shortcuts now label + hint, dashboard banners are just the greeting, review-submission buttons are "Submit trace" / "Keep editing", empty states and placeholders use full stops). Empty-value "—" stays visible but is `aria-hidden` with hidden "Not available" text. Rule added to CLAUDE.md.
- Tests updated: comments empty state, and two placeholder checks now use `toContain("—")`.

### My Contributions polish — `my-contributions-polish` (2026-11-03, uncommitted)

- Rows: 56px thumbnail (`TraceThumb`: first photo, category colour fallback, reveal when decoded, skipped in Data Saver), status hint line, "Updated … ago", and a separate "Continue editing" / "Edit and resubmit" link for drafts and revision requests.
- Delete is a quiet grey text button (`DeleteTrace quiet`, `.contrib-delete`); the trace detail header keeps the normal danger button.
- Status filter and page live in the URL (`api/contributionParams.js`); the detail page's Back link returns to the same view and scroll position (`state.listSearch`, `state.restoreScroll`).
- Empty states use `EmptyState` ("You haven't submitted any traces yet." with an upload action, or a per-status line with "Show all traces").
- Tests: new `contributionsList.test.jsx`, `contributionParams.test.js`; two empty-state strings updated in `traces.test.jsx` and `deleteTrace.test.jsx`.

### Trace detail polish 2 — `trace-detail-polish-2` (2026-11-02, uncommitted)

- `ScrollManager` (App.jsx): new pages start at the top, browser Back/Forward restores position, in-place URL replaces never move the page. "Back to Traces" restores the list position via `state.restoreScroll` + `archive-scroll:<search>` in sessionStorage.
- Neighbours are fetched once in `LiveTraceDetail` and shared: `TraceStepper` (Newer/Older buttons beside Back, placeholders while loading, icon-only under 480px) and `TraceNeighbors` cards (arrows, two-line titles) after the comments.
- `RelatedTraces` renders nothing until it has data; heading is "More in {category}".
- Comment Delete is a quiet text button (danger on hover/focus); its dialog quotes the comment (140 chars).
- Archive shows "Showing results for … in …" with "Clear all filters" when filtering.

### Logo variants — `client/public/brand/` (2026-11-02, uncommitted, on `main`)

- New folder with 17 SVGs plus `png/` exports and `preview.html`/`preview.png` (open the HTML to see every variant on light and dark). Nothing in the app imports them yet; `tidetrace-logo.svg` is unchanged.
- Variants: `mark-{dark,black,white,teal,clay}`, `mark-dark-tile`, `badge-round[-dark]`, `app-icon[-dark|-maskable]`, `badge-trace` (teal-strong pill, two-wave mark), `badge-tide` (navy pill, single-wave mark), `lockup-horizontal[-dark]`, `lockup-stacked[-dark]`. Colors come from the existing tokens (`--navy`, `--teal-strong`, `--d-text`, `--d-bg`).
- Wordmark text is outlined from Poppins Bold (700). The app uses weight 600, which was not available when generating, so the wordmark is slightly heavier than the navbar.
- The Trace badge is teal-strong, not clay, so it never competes with the one-clay-per-screen rule.
- Not done: wiring into `index.html` (favicon/manifest), the navbar, or `social-preview.svg`. Below 24 px use `mark-*`; the wave inside badges and icons is too fine at 16 px. Create a branch before committing.
- Delete the leftover `_to_delete/` folder in the project root (temporary zip, safe to remove).

### Own-Trace deletion — `delete-own-traces` (2026-11-02, uncommitted)

- Branched from updated `main`; no commit or push. Apply `supabase/migrations/20261102000100_delete_own_trace.sql` before deploying the API/client changes.
- Owners can soft-delete every status. Comments become hidden; open Trace/comment reports resolve with `trace deleted`; existing history and notifications remain, with no new notifications. Member/public reads exclude deleted Traces; staff detail/history retain them and mark them deleted. The existing `moderate_trace` RPC still rejects a deleted pending Trace.
- The API deletes all Storage objects under the owner's Trace folder, including detached uploads, and verifies removal before returning 204. A Storage failure leaves the Trace deleted and shows an inline retry in the dialog, using owner-only `POST /api/traces/:id/photo-cleanup`. Repeated `DELETE /api/traces/:id` still returns 404. If the dialog/browser is closed before cleanup succeeds, the sweep described below finishes it the next time My Contributions opens.
- Interrupted photo removal is finished automatically: `POST /api/contributions/photo-cleanup` (RPC `deleted_trace_media_pending`) removes leftover photos for all of the caller's deleted Traces; My Contributions calls it quietly on load. Auto-resolved reports store `resolved_by = null`. Staff trace routes still exclude moderation-hidden Traces (only deleted ones are readable). A 404 on delete means already gone (notice + back to contributions); a 404 on photo retry means finished.
- Danger Delete buttons appear on contribution rows and owner details. Native modal uses the existing dialog styles, Cancel/Escape and focus return, disabled busy buttons/spinner, inline errors, and one `Trace deleted.` toast after navigation. Confirmed deletion clears the selected-photo guard to avoid a second confirmation.
- Added client, server and SQL regression coverage. JS/JSX/CSS syntax checks and `git diff --check` passed; tests, migration execution and browser checks were not run here.
- Run on the Mac: `cd client && npm test`, then `cd ../server && npm test`. Apply the migration above. Against a disposable local/test database with all migrations applied, run from the repo root: `psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/delete-own-trace.sql` (fixtures roll back). The SQL check is also wired into `supabase/tests/local-check.mjs` for environments already set up with PGlite.

## 1. What TideTrace is

Community ecological awareness app for Iloilo. **Traces** are member photo observations (category, location, description). **Tides** are short lessons published by admins. Flow: contribute → review → discover → learn.

Roles: **member** (submit and browse Traces, read Tides), **moderator** (review Traces, reports, comments, analytics), **admin** (users, moderators, categories, Tides, settings, history, analytics).

## 2. Repository layout

Project folder: `TideTrace_app/` (the app itself is in `TideTrace_app/TideTrace/`).

| Path | Contents |
|---|---|
| `TideTrace/client/` | React 19, React Router, Vite 8, Tailwind config, plain CSS. ~53 shared components, ~40 test files. |
| `TideTrace/server/` | Node ES modules, Express 5, Zod, Supabase JS client. Routes: `auth`, `content`, `media`, `staff`. |
| `TideTrace/supabase/` | 16 migrations (2026-09-21 → 2026-10-29), SQL security tests, email templates, first-admin bootstrap. |
| `TideTrace/docs/legal/` | Privacy policy, terms and conditions, publication notes. |
| `TideTrace/DEPLOYMENT.md` | Vercel (frontend) + Render (API) guide. |
| `TideTrace-Phase-2-Raw-Files/` | Phase 2 planning: PRD, ERD, architecture, user/moderator/admin flows, sitemap, 16 user stories, board backlog. The set is duplicated under `output/`. |
| Loose files | `tidetrace-mind-map-shareable.html`, `TideTrace copy.zip` (backup). |

Env files `server/.env` and `client/.env.local` exist locally and are git-ignored. They were not opened.

Commands (from `TideTrace/`): `npm run dev` (frontend, port 5173), `npm run dev:server` (API, port 3001), `npm test`, `npm run build`, `npm run verify:reads`. Node 22.12+.

## 3. Product status (from README)

Connected to the backend/Supabase: login, registration, email confirmation, recovery, profile name and photo, categories, Trace browsing, drafts, photo upload, submission, revision and resubmission, moderation with history, reports, comments, notifications, Tides (admin authoring, member completion), community map with sensitive-location pins, data saver, notification preferences, staff analytics.

The README still says dashboard data and actions use in-memory mock data in `client/src/context/AppContext.jsx`. Other sections describe connected dashboards, so that line may be out of date. Not checked.

Latest commits on `main`: "Updated map center", "Added community map and sensitive pins", "Update wording".

## 4. This session: UI/UX improvement pass (in progress)

Source: a Codex review (`better-*` UI/UX skills) of the live archive and submission form at desktop and 320px. The review found contrast failures, inconsistent button hierarchy, tiny type, and heavy mobile controls.

**Branch:** `ui-contrast-and-buttons` (created from `main`). Committed, pushed to `origin`, and merged via pull request (confirmed by the project owner). The commit message was amended afterwards to remove the Claude co-author trailer, so the commit ID differs from the original `89f8f5a`.

### Done on this branch (step 1: contrast, focus, buttons)

All 14 modified files are in `client/src/`.

1. **Color tokens** (`index.css` `:root`, and the separate `.tt-home` token set in `pages/Home/home.css`):
   - `--soft` `#6b7f9e` → `#526581` (muted text; 4.07:1 → 5.94:1 on white).
   - New `--clay-strong #a85025` (text and button backgrounds, 5.47:1 with white), `--clay-strong-dark #8f4320` (hover).
   - New `--teal-strong #2f6a70` replaces `#3f7d83` text colors and the teal button (6.15:1).
   - New `--danger #b3261e`, `--danger-dark #8f1d17`, `--danger-bg #fde8e6`.
   - `--clay` and `--teal` are unchanged and still used for decoration (strokes, avatars, borders).
2. **Fixed failing pairs:** approved/active badges, "on" chips, suspended badge, nav badge, eyebrow labels, `.mini.clay/.teal`, `.flag b`, `.edlink`, traychip, password rules, forgot-password teal text, homepage clay button and section taglines.
3. **Error messages** (`.err`, `.password-feedback`, `.auth-code-error`) now use `--danger` instead of orange clay text.
4. **Keyboard focus:** global `:focus-visible` outline, plus a stronger one on `.btn` and `.chip`. Previously `.btn` had none.
5. **Removed the duplicate Google Fonts `@import`** from `index.css`; `index.html` already loads the same fonts.
6. **New `.btn.danger`** variant; `Button.jsx` doc comment updated.
7. **Button roles** (blue = primary, clay = "contribute" accent, danger = destructive):
   - Login: clay → blue (matches Register, Forgot password, Verification).
   - NavigationGuard "Discard changes": clay → danger.
   - ManageReports "Remove content": clay → danger.
   - ReviewTraces: Approve teal → blue; Request revision clay → outline; Reject outline → danger.
   - Moderator dashboard "Review pending traces": teal → blue.
   - EditTide: Publish clay → blue; the save button is outline unless the Tide is already published (then blue).
   - Kept clay: New Trace, Submit Trace / Submit for review, Yes — submit trace, Upload Trace (dashboard), Join TideTrace (navbar), homepage "Make Your First Trace" and "Your dashboard".

### Verification

- `npm test` (client): 407 of 408 passed on the first full run. The one failure, `moderation.test.jsx` "does not replay a conflicting or uncertain decision (502)", timed out finding a button under 40 parallel workers. Re-run alone: 13/13 passed. Treated as a load flake; it was not caused by these edits (only class names changed; the tests find buttons by role and name).
- `npm run build`: passed (569 modules). Existing warnings, unrelated to this work: `vite.config.js` uses ESM syntax in a CommonJS file (rename to `.mjs` or set `"type": "module"`), and the JS bundle is ~817 kB (over the 500 kB warning; needs code splitting).
- Visual check of the key pages (login, homepage, archive, submission form, moderator review) done by the project owner.
- Not run: server tests (`npm test` at the root), 200% zoom, dark mode, real-device Safari, end-to-end submission. Contrast of the final rendered colors was calculated from the CSS values, not measured in a browser.
- Tests cannot be run in the cloud session used for this work because the installed `node_modules` are macOS builds. Run tests and builds on the Mac.

### Done on branch `type-scale-and-helper-notes` (step 2: type scale + helper notes) — UNCOMMITTED, UNTESTED

Branched from the CLAUDE.md commit. Edits are in the working tree; tests and build have not been run (cloud/Linux shell cannot run the macOS `node_modules`). Run `npm test` and `npm run build` on the Mac first.

- **Type scale:** 9 role variables in `index.css` `:root`: `--fs-badge .75rem`, `--fs-meta .8125rem`, `--fs-label .875rem`, `--fs-body 1rem`, `--fs-card 1.125rem`, `--fs-section 1.25rem`, `--fs-section-lg 1.5rem`, `--fs-title 1.75rem`, `--fs-title-lg 2rem`. Every `font-size` of 32px or less in 18 CSS files now uses a variable (mechanical mapping by value: ≤12→badge, ≤13.5→meta, ≤15→label, 16→body, ≤18→card, ≤21→section, ≤24→section-lg, ≤28→title, ≤32→title-lg). Left alone on purpose: hero `h1` 38px, the 100px size in `home.css`, the decorative `.fake-stats` mock, and the `font:` shorthands (`.code-input`, `.tt-nav`).
- Because it is mechanical, some small text grew (9–11px → 12px, 15px → 16px by value). **Check for wrapping or overflow** in badges, chips, tables, the navbar and mobile (320px).
- **Explicit overrides:** `.hint`, `.err`, `.auth-note` → 13px; `.input` 44px tall at 16px (stops iOS focus zoom); `.search input` and `.settings-field input` 16px; `.btn` and `.btn.sm` 14px; `.btn.sm` `min-height:44px`.
- **Helper notes:** all approved removals and shortenings applied (see list in git diff). `ManageReports` keeps its `id`/`aria-describedby`. Changed deviations from the list: `StaffAnalytics` hint was shortened, not split next to each metric; `ReviewTraces` hint is one shortened line, not one line per button.
- **Coordinates:** `TraceMap` now takes `showCoordinates`; raw coordinates show only when editing, in the moderator review, and in the owner's contribution view. Test in `test/maps.test.jsx` updated for this.
- `Dashboard "Updates every 30 seconds"` sentence removed; the timestamp has no seconds and the line is hidden until data loads.

### Done on branch `button-states` (step 3: button states) — UNCOMMITTED, UNTESTED

Branched from `main` after PRs #3 (type scale + helper notes) and #4 (CLAUDE.md) merged; the owner confirmed `npm test` and `npm run build` passed on those.

- **Hover/pressed:** `.btn.blue` hover uses new `--blue-dark #263e82`; outline and ghost hover use `--bg`; `.btn:active` shifts 1px down and darkens slightly; short transition, disabled under `prefers-reduced-motion`.
- **Loading:** `Button.jsx` has a `loading` prop (spinner using the existing `.button-spinner`, `aria-busy`, disabled). A plain `<button className="btn …">` gets the same look with `aria-busy="true"` + `disabled`. Only 15 places use `<Button>`; the other ~70 raw `.btn` buttons were NOT converted (they already swap their label, e.g. "Hiding location…").
- **Disabled:** unchanged look (50% opacity, not-allowed); busy buttons show 75% with a progress cursor.
- **Teal variant retired:** `.btn.teal` rule and the doc mention removed (it had no uses). `--teal-strong` is still used for text.

### Done on branch `mobile-filters-and-form-nav` (steps 4, 5 and 6) — UNCOMMITTED, UNTESTED

Branched from `main` after PR #5 (button states) merged.

- **Archive filters (`ViewTraces.jsx`):** labelled "Category" `<select>` (All categories + each category) shown at 640px and below; the chip row is hidden there (CSS only, so both are in the DOM). Desktop is unchanged.
- **Empty state:** when a search or category is active and nothing matches: "No traces match these filters. Try another search or clear filters." plus a **Clear filters** button (resets search, category, page). With no filters it still says "No approved traces found." Pagination is hidden when page 1 is empty (still shown on a later empty page so the user can go back).
- **Submission form nav (`TraceDraftLayout`):** below 768px the step list is behind a "Jump to section" toggle (`aria-expanded`/`aria-controls`) that closes after choosing a step. At 768px and up the sticky sidebar is unchanged and the toggle is hidden. The list is always in the DOM and hidden by CSS only.
- **Tests:** `traces.test.jsx` updated for the new empty text and a new test for the select + Clear filters; new `user-design.test.jsx` test for the toggle.
- **Check on a real phone:** the select's look, the toggle's open/close, and that nothing overlaps at 320px.

### Done on branch `account-menu` (steps 7, 8 and 9) — UNCOMMITTED, UNTESTED

Branched from `main` after PR #6 (mobile filters + form nav) merged. The branch name no longer matches its contents (it also holds the photo placeholder and form copy changes); a rename attempt failed on lock files, so keep the name.

- **Account menu (`Navbar.jsx`):** at 1280px and up, "Change profile" and "Log out" sit in an "Account" dropdown (disclosure pattern: `aria-expanded`/`aria-controls`, Escape closes and returns focus to the toggle, outside click or focus leaving closes it). Below 1280px the toggle is hidden and the two buttons appear inline in the mobile panel as before (CSS `display:contents`). All roles (user, moderator, admin) now get both items; moderator/admin previously had only Log out. The avatar button still goes straight to the profile. Items are always in the DOM and hidden by CSS only, so existing tests that click "Log out" still work. CSS is at the end of `responsive.css`.
- **Photo placeholders (`TraceCard.jsx`):** loading = neutral pulsing block (no category colour, hidden from screen readers); "No photo" and "Photo unavailable" (fetch failed or the image failed to load) are separate states with readable text on a neutral background; data saver shows "Data saver is on" above the "Load photo" button. Dark mode colours added.
- **Form copy:** shorter intros on the draft form (new and revision), shorter photo helper ("Required to submit; optional for a draft."). The submission hint, location privacy hint and 13px `.hint` size were already done earlier. Field labels were deliberately not changed (tests find fields by label).
- **Tests added:** Account menu behaviour for each role and signed-out (`responsive-navigation.test.jsx`); "No photo" vs "Photo unavailable" (`dataSaver.test.jsx`).
- **Check on screen:** the dropdown at desktop width (alignment, dark mode), the inline buttons in the mobile panel, and the three card photo states.

## 5. What's left (planned, in order)

2. **Type scale.** (DONE on `type-scale-and-helper-notes`, untested.) Define role-based sizes in `rem` as variables (page title 28–32, section 20–24, card title 16–18, body and inputs 16, labels and buttons 14–16, metadata 13–14, badges 12) and replace the ~15 scattered pixel sizes (9.5px–17px; most-used: 12px, 11px, 14px, 13px, 12.5px). Badges are 9.5px, hints 11px, chips 11.5px. Inputs are 38px tall at 13px text; 16px prevents iOS focus zoom. Files: `index.css`, `responsive.css`, `user.css`, `admin.css`, `moderator.css`, `TraceDraftLayout.css`, `home.css`.
3. **Button sizing and states.** (DONE on `button-states`, untested.) `.btn.sm` computes to about 37px tall and is used ~64 times; target 44px or document the exception. Raise labels to 14–16px. Add loading, pressed and disabled states. Retire the `teal` button variant (now unused except in `Button.jsx` docs).
4. **Mobile filters.** (DONE on `mobile-filters-and-form-nav`, untested.) Replace the three rows of category chips in `ViewTraces.jsx` with a labelled select under about 640px.
5. **Mobile form navigation.** (DONE on same branch, untested.) Turn the five-step panel in `TraceDraftLayout` into a "Jump to section" disclosure on mobile; keep the desktop sidebar.
6. **Empty state** (DONE on same branch, untested.) (`ViewTraces.jsx` line ~63): "No traces match these filters. Try another search or clear filters." with a Clear filters button; hide pagination when empty.
7. **Account menu** (DONE on `account-menu`, untested.) in `Navbar.jsx`: move "Change profile" and "Log out" into an accessible dropdown.
8. **Form copy** (DONE on `account-menu`, untested.) (`SubmitTrace.jsx`, `TraceDraftForm.jsx`, `TraceLocationPrivacy.jsx`): shorten the intro, put requirement hints beside fields, make the sensitive-location text at least 13px.
9. **Photo placeholder** (DONE on `account-menu`, untested.) (`TraceCard.jsx` ~line 84): neutral loading state; separate states for unavailable and data-saver photos.

Out of scope of the review, still unchecked: admin/moderator flows beyond the buttons above, dark mode, 200% zoom, real-device Safari, end-to-end submission, whether the search box shows focus (`.search input` sets `outline:none`; parent focus style not checked).

### Helper-note audit (approved; applied on `type-scale-and-helper-notes`)

About 60 small helper notes (`hint`, `auth-note`, `sub`, `*-help`). Rule: keep a note only if it prevents a mistake, protects privacy or helps recovery. Apply together with step 2 (the type scale), since the same lines use the tiny sizes. The project owner was to say which to keep before changes are made.

- **Remove:** `Login.jsx:56` ("Sign in with your TideTrace account…"); the first sentence of `DashboardStats.jsx:7` (keep "Updated 10:10 PM", no seconds); user `Profile.jsx:92` ("Your community account"); `History.jsx:22` ("Filters apply to all saved decisions"); the "appears everywhere" sentence in `ProfilePhoto.jsx:186`; "…account and role are unchanged" in `ResetPassword.jsx:68`; the static "Changes are saved only when…" branch in `TraceDraftForm.jsx:253` and `EditTide.jsx:106` (show only when there are unsaved changes); raw coordinates in `TraceMap.jsx:82` (show to owner/staff only); `ForgotPassword.jsx:57` (duplicate of `VerificationCode.jsx:69`); `ProfileNameForm.jsx:54` (or shorten to "Email can't be changed here.").
- **Shorten:** `SubmitTrace.jsx:108`; `ReviewTraces.jsx:231` (one line per action beside its button); `TraceLocationPrivacy.jsx:23`; `TraceDraftForm.jsx:228`; `NotificationPreferences.jsx:58,65`; `AccountManagement.jsx:35,102`; `StaffAnalytics.jsx:34` (definitions next to each metric); `ProfilePhoto.jsx:148`; `VerificationCode.jsx:52`; `EditTide.jsx:95-96`; `ManageReports.jsx:90`.
- **Keep:** privacy and sensitive-location notices (`TraceLocationPrivacy.jsx:10`, `TraceDraftForm.jsx:224`, "Location withheld", community map note); required-step prompts ("Resolve any photo upload errors…", "Address the moderator's feedback…", "Use another admin account…", "This Trace is not awaiting a decision."); notes linked by `aria-describedby`/`id` (ProfilePhoto drag/arrow-keys, photo selector helper, report explanation); recovery help (code, spam folder, newest email link, request another confirmation); empty and error states ("No comments yet…", "No pending submissions…", "Queue clear…", "Map preview is unavailable", "Unsupported attachment").
- **Meta text, not helper text:** author/date lines, review timestamps, "Member since", "Account ID", Tide slugs, draft review values. Keep the wording; give them a shared "meta" class at 13px instead of the 11px `hint` class.
- Not covered by the audit: text passed in as props (`helper`, `AuthLayout` subtitle), placeholders, error messages, CSS-only text.

## 5b. Status after 2026-11-02 and the next phase: UI/UX polish (PLANNED, NOT STARTED)

All planned steps 2–9 above are merged into `main`: PR #3 (type scale + helper notes), #4 (CLAUDE.md), #5 (button states), #6 (mobile filters, empty state, form section jump), #7 (account menu, photo placeholders, form copy). The "UNCOMMITTED, UNTESTED" labels in section 4 are historical.

The next phase is UI/UX polish, in this order. No code has been written for it yet.

### Motion rules (apply to everything below)

- Animate only `transform` and `opacity`. No layout properties.
- Durations: 120ms (press/hover), 200ms (small UI: menus, toasts, chips), 320ms (content fade/slide), 600–800ms (landing reveals only). One easing for entrances: `cubic-bezier(.22,.61,.36,1)` (already used by the headline).
- Every animation has a `prefers-reduced-motion` fallback (static or a plain opacity fade). The landing page already has `useReducedMotion`; the app shell already disables animations globally under reduced motion.
- At most one attention-grabbing motion per screen. Infinite loops only for loaders and the hero waves, and they must pause when off-screen or the tab is hidden.
- Define the durations/easing as CSS variables (`--dur-fast`, `--dur-ui`, `--dur-content`, `--ease-out`) next to the type scale in `index.css`.

### Phase A — Skeleton loaders (do first; most visible problem)

Findings (from the code, not yet seen in a browser):

1. **Every navigation shows a full-screen overlay for a fixed 650ms.** `App.jsx` (`loadedPath` timer) renders `SkeletonLoader`, which is `position:fixed; inset:0; z-index:9999` and draws a fake navbar over the real one. This happens even when the page is ready instantly, so every click feels slow and the navbar flickers.
2. **The same full-screen overlay appears whenever page data loads.** `RemoteState` (non-compact) renders `SkeletonLoader`, and `useRemoteData` drops its data whenever the request URL changes. So typing in the archive search, changing category, paging, or pressing Retry covers the whole screen, including the search box being typed in.
3. **Overlays can stack** (route overlay + page overlay).
4. **Five different loading styles:** `.psk` shimmer (1.4s ease), `.remote-skeleton-line` shimmer (1.5s linear, different colours), `.stat-placeholder` pulse, the landing `.tt-total-skeleton` (static), the map skeleton, and the new card-photo pulse.
5. **Shapes are hand-drawn per route** (16 variants in `SkeletonLoader.jsx`, ~430 lines with inline `<style>`), so they can drift from the real layouts and cause a jump when content appears. Not yet checked at 320px.
6. Many identical "Loading content" status regions; not specific to what is loading.

Plan:

- **A1. One skeleton system:** a small `Skeleton` component plus one stylesheet (`.sk`, `.sk-line`, `.sk-block`, `.sk-circle`), one shimmer keyframe, light/dark colours as tokens, static under reduced motion. Replace `.psk`, `.remote-skeleton*`, `.stat-placeholder`, `.tt-total-skeleton` and the card-photo pulse.
- **A2. Remove the fixed 650ms route overlay.** Skeletons render in place inside the page's content area, below the real navbar. No fake navbar.
- **A3. No flash:** show a skeleton only if loading takes longer than ~200ms; once shown, keep it at least ~300ms so it doesn't flicker.
- **A4. Keep old results while refetching** (stale-while-revalidate in `useRemoteData`, e.g. a `previousData`/`refreshing` flag). Search, filters, paging and retry keep the current list visible, dimmed slightly with `aria-busy`, plus a small "Updating…" status. Skeletons only on the first load of a page.
- **A5. Shape-matched skeletons** built from the real layout classes (`TraceCard` skeleton = same card, 220px photo block, title line, meta line; dashboard = real stat grid). Check 320 / 768 / 1280px for zero layout shift.
- **A6. Content arrives with a 150–200ms opacity fade** (none under reduced motion).
- **A7. Accessibility:** one status region per loading area with a specific label ("Loading traces…"), `aria-busy` on the region.
- Tests: 6 assertions use `status` "Loading content" (e.g. `traces.test.jsx`); they will need updating, and new tests for "keeps results while searching" and "no skeleton under 200ms".

#### Phase A status — done on branch `skeleton-loaders` (checked by eye on the Mac)

Branched from `main` (handoff plan commit `a77205c`). Run `npm test` and `npm run build` on the Mac first, then look at it in a browser; none of this has been seen on screen.

- **A1 (done):** one shimmer for every placeholder: tokens `--sk-base` / `--sk-shine` (light and dark) and one `@keyframes sk-shimmer` in `index.css`, shared by `.psk`, `.remote-skeleton-line`, `.stat-placeholder`, `.tt-total-skeleton` (landing totals, previously static) and the trace-card photo loading block (its own pulse removed). The map skeleton (`TraceMap.css`) is intentionally separate (pin icon + sweep).
- **A2 (done):** the fixed 650ms route overlay in `App.jsx` is gone (no `loadedPath` timer). `SkeletonLoader` no longer draws a fake navbar or covers the screen (`position:fixed; z-index:9999` removed); it renders in the page, under the real navbar. Because every page already shows its own heading, search and filters, the skeleton hides those parts with CSS (`.ps-head`, `.ps-headrow`, `.ps-search`, top-level `.ps-chips`/`.ps-button`, etc.) and shows only the content area. DOM is unchanged, so tests that look for the "Loading content" status still find it.
- **A3 (changed approach):** instead of a JavaScript delay, skeletons are in the DOM immediately (tests and screen readers rely on that) but fade in after 150ms with CSS (`sk-in`). A response faster than ~150ms shows no skeleton. A 300ms minimum display time was NOT implemented (it would need timers and would break the existing "removed after rerender" tests).
- **A4 (done, archive only):** `useRemoteData(path, { keepPrevious: true })` keeps returning the last successful list for the same account while a new request runs (`refreshing: true`, `loading: false`). Used by the archive (`ViewTraces`): searching, changing category and paging keep the cards visible, dimmed (`.is-refreshing`), with an "Updating traces…" status for screen readers and disabled pagination. Never use it for records identified by their path. Other lists (contributions, history, reports, etc.) can opt in later.
- **A5 (partly):** the nested "Account change history" placeholder is now compact (3 lines) instead of page-sized. The 16 hand-drawn route variants in `SkeletonLoader.jsx` are otherwise unchanged. Variants only used by the removed overlay (dashboard, profile pages) are now dead code; delete them after confirming in the browser. Not checked for layout shift at 320 / 768 / 1280px.
- **Reload flash (fixed on the same branch):** while a saved session is being restored (`sessionReady === false`, role unknown) `Navbar` used to show the signed-out links and Log in / Join buttons, which looked like the landing-page navbar. It now draws a placeholder with the same structure and classes as the real bar (`nav-restoring`: the logo link in its normal place, shimmer blocks for the links, action and avatar/menu, `aria-busy`), so nothing shifts when the real navigation arrives. `SessionGate` in `App.jsx` now shows the shared skeleton lines (with the "Restoring your session…" text kept for screen readers via `role="status"` and an `aria-label`) instead of plain text. Tests: `responsive-navigation.test.jsx`, `session.test.jsx` (assertion changed from the visible text to the labelled status). CSS: end of `index.css` and `responsive.css`. Check in the browser at 320px and desktop that the logo does not move on reload.
- **Dashboard totals row (fixed on the same branch):** the helper-note cleanup made the "Updated …" line render only after data arrived, so the "Refresh totals" button sat on the left and jumped right on load. `DashboardStats.jsx` now always renders the line (a small shimmer block while loading) and pins the button right with `margin-left:auto`.
- **Restore layout match (fixed on the same branch):** the placeholder navbar draws the real link labels and classes for the remembered role (`client/src/api/roleHint.js`, `sessionStorage` key `tidetrace-nav-role`, per tab on purpose: the auth tests require localStorage to stay empty and `session.js` removes the legacy role key, written by `Navbar` once a role is known), and `AppShell` applies the same role's shell class while `sessionReady === false`. The logged-in container is 1240px (`.app-shell.user-shell .wrap` etc.) against 1180px signed out, so without the class everything moved 60px when the account arrived. The hint only affects layout, never access. A new tab or a fresh browser session falls back to the member layout once. Also fixed: five bare `font-family:'Poppins'` declarations got a sans fallback (they flashed serif), and `index.html` preconnects to Google Fonts. Self-hosting fonts is still open (Phase D).
- **Not done:** A6 (fade-in of arriving content) and A7 (specific labels such as "Loading traces…"; the six tests asserting "Loading content" would need updating).
- **Tests:** new `useRemoteData.test.jsx` (keepPrevious, default behaviour, other account), archive test "keeps the archive results visible while a new search is loading", and a loadingSkeletons test for the in-place render.

### Phase B — Landing page

What is there now: WebGL gradient waves in the hero, a rotating "Explore/Contribute/Learn" pill (framer-motion), a stroke-drawn SVG headline, animated wave divider, scroll reveals, spotlight feature cards, community totals, a metaballs canvas in the final CTA. It is already motion-heavy; the work is mostly focus, meaning and performance, not more effects.

- **B1. Calmer hero, faster first paint.** Three motions compete (waves, rotating pill, headline drawing). Keep the waves as the background motion; show the headline as real text immediately, then play the stroke effect once on top (today the SVG is hidden until fonts load, up to 2.5s, which delays the main content). Let the pill rotate a few times, then rest on "Contribute".
- **B2. Pause the hero waves off-screen and in hidden tabs.** `GradientWaves` keeps its `requestAnimationFrame` loop running after you scroll past the hero (no IntersectionObserver or `visibilitychange`). `MetaBalls` already pauses; copy that pattern.
- **B3. Show the product: a "Recent traces" strip** between Features and Impact, using approved, non-sensitive public Traces (photo, title, place, category). Slow horizontal drift that pauses on hover/focus; a static scrollable row under reduced motion. Needs a public read endpoint or the existing public archive query. Decision needed: OK to show real member photos on the public landing page?
- **B4. Count-up community numbers** when the Impact section scrolls into view (0 → value over ~900ms, tabular numerals, final value in the markup for screen readers). Use the shared skeleton while loading.
- **B5. "How it works" connector:** a line that draws from step 1 → 2 → 3 as the section scrolls in, and each step number pops in turn. Optional: a small looping phone mock-up of the submission flow (category → photo → submitted) instead of plain text.
- **B6. Navbar on scroll:** after the hero, the bar gets a shadow and slightly reduced height; the current section's link is highlighted with a sliding underline (scroll-spy).
- **B7. Micro-interactions:** feature card icons nudge on hover/focus (pin bounce, arrow lift, heart beat, ~300ms, once per hover); CTA buttons get a short "wave fill" or lift on hover; the anchor-scroll already respects the sticky nav.
- **B8. Section rhythm:** reuse a static wave edge between alternating background sections so the ocean motif carries down the page; give the quote a large type treatment with a drawn wave underline.
- **B9. Mobile:** check the hero at 320px (headline size, wave canvas cost on low-end phones; consider a static gradient image below ~480px or on `saveData`/data-saver).

#### Phase B status — done on branch `landing-page-polish` (syntax-checked only; run `npm test`, `npm run build`, then look at it)

- **B1 (done):** the headline is real text from the first paint (`StrokeText` keeps the outline SVG's space reserved, draws once on top, then fades the plain copy out; font wait cut from 2.5s to 1.2s). The pill runs through the words twice and rests on "Contribute" (`loop={false}`). Under 480px or data saver the plain headline is used and the outline effect is skipped.
- **B2 (already true, no change):** `GradientWaves` already stops its loop when off-screen or the tab is hidden (`tick` returns on `!state.visible || document.hidden`). The earlier note was wrong.
- **B3 (done):** `RecentTraces` between Features and Impact. Uses the existing public `GET /api/traces?limit=24` and the public signed photo URLs; no server change. `pickTiles` keeps approved, non-sensitive traces with a photo and passes on only title, category and place (no author, no coordinates). Loads when within 400px of view; drifts slowly and pauses on hover or keyboard focus (no pause button, by decision); reduced motion, screens up to 768px and devices that cannot hover (`useCompactPointer`) get a still, swipeable row with no duplicates; hidden if fewer than 4 photos, on error, with data saver, or without IntersectionObserver. Real member photos approved by the owner. Links to the archive for members, `/register` otherwise.
- **B4 (done):** count-up (900ms, tabular numerals) when each number scrolls in; the final value stays in a screen-reader-only span; reduced motion shows plain numbers.
- **B5 (done, mock-up skipped):** connector line draws step 1 → 2 → 3 and the numbers pop in turn (vertical on phones). The optional looping phone mock-up was not built.
- **B6 (done, one deviation):** shadow after scrolling, scroll-spy highlight and a sliding underline (desktop). The bar does NOT shrink: it is in normal flow, so changing its height would shift the page under the reader's finger.
- **B7 (done):** per-icon nudges (pin bounce, arrow lift, globe turn, heart beat) on hover or focus; buttons lift on hover.
- **B8 (done):** static wave edges between sections (`.tt-edge` with an SVG data URI per colour) and a larger quote with a drawn wave underline.
- **B9 (done):** under 480px or data saver the WebGL waves are not mounted; the CSS gradient behind them shows instead.
- **Tests:** new `test/landingPolish.test.jsx` (tile filtering and privacy, strip drift/pause/static/hidden cases, count-up, connector, navbar shadow and scroll-spy) and one more case in `Home.test.jsx`.

#### Toast status — done on branch `toasts` (syntax-checked only; run `npm test`, `npm run build`, then look at it)

- **System (done):** `useToastQueue` (in `AppContext`) owns the list and timers; `Toasts.jsx` renders two always-mounted live regions (polite for success/info, `role="alert"` for errors). Variants with icons, close button, Escape to dismiss, optional action button, max 3 stacked (oldest dropped), the same message refreshes instead of stacking, hover/focus pauses the countdown. Success 4s, info 6s, error stays until dismissed. `showToast("text")` is unchanged for callers (success); `showToast({ message, type, action, duration })` and `useToast()` (`success/error/info/dismiss`) are new. The context now exposes `toasts`, `showToast`, `dismissToast`, `pauseToast`, `resumeToast` (the old `toast` string is gone). The sign-out warning is an `info` toast for 8s.
- **New toasts only where nothing visible confirmed the action:** notification preferences and data saver ("Preference saved." was screen-reader-only), hide exact location, submit/resubmit a Trace. Everything that already confirms on the page (profile name, comments, categories, settings, photos, reports, account changes) keeps its inline message by the one-action-one-confirmation rule.
- **Moderator review:** the saved decision is now an outcome banner on the page ("Decision saved: Approved. It now appears in the community archive.") with a "Review the queue" link; it is not a toast because the moderator stays on the same Trace.
- **Not done / by decision:** no Undo (needs server support per action). Error toasts exist but nothing uses them yet; add them only for background failures.
- **Tests:** new `test/toasts.test.jsx` (regions, expiry, errors persist, queue limit, dedupe, pause, close/Escape/action), rewritten `appContext.test.jsx`, `profile.test.jsx` preference assertion, `moderation.test.jsx` banner assertion.

### Phase C — App-wide micro-interactions

- **C1. Route content transition:** a 200ms fade/slide-up of the page content (View Transitions API where supported, CSS fallback). Replaces the overlay removed in A2.
- **C2. Trace cards:** hover/focus lift (`translateY(-2px)` + soft shadow) and the photo fades in when loaded instead of popping.
- **C3. Toasts:** slide/fade in from the bottom and out (today they appear without an exit).
- **C4. Menus and disclosures** (account menu, Jump to section, mobile nav): 150–200ms fade + small slide; chevrons rotate.
- **C5. Submission form progress:** mark completed steps in the step list with a check (category chosen, photo added, etc.), and show a short success animation (check draw) after "Submit for review".
- **C6. Notifications:** badge pops when the unread count goes up.
- **C7. Empty states:** a small wave/shell illustration and one action, consistent across archive, contributions, notifications, moderation queue.
- **C8. Map:** pin drops in with a short bounce when placed.

### Phase D — Performance (ties directly to the motion work)

- `gsap` is installed but never imported: remove it.
- `framer-motion` is used only by `RotatingText` (the hero pill): replace with a CSS version or lazy-load it.
- No route-level code splitting: lazy-load the landing page effects (`GradientWaves`, `MetaBalls`, `RotatingText`) and the staff/admin routes. This is the fix for the ~817 kB bundle warning.
- Rename `vite.config.js` → `vite.config.mjs` (build warning).

### Phase E — Checks still open

200% zoom, dark mode across the app (add dark colours for anything new), real-device Safari, the archive search box focus ring (`.search input` has `outline:none`), server tests.

### Suggested PR split

1. Phase A (skeletons + `useRemoteData` refresh behaviour) — one PR, biggest UX win.
2. Phase D performance + B1/B2 (hero) — one PR, measurable.
3. Rest of Phase B (landing additions) — one PR, after the B3 photo decision.
4. Phase C micro-interactions — one PR.
5. Phase E checks and fixes.

## 6. Decisions and caveats

- **Primary button = blue**, not clay (blue is already the most-used variant and passes at 7.76:1). Clay is reserved for contribution actions. One clay button per screen.
- **Danger is its own red.** Clay must not be used for destructive actions or errors.
- `home.css` defines its own `--clay`/`--soft` under `.tt-home`; token changes must be made in both places (done for this step).
- Tests do not reference button classes or these colors, but they do check wording and layout; update them when changing copy in later steps.
- This session's cloud environment cannot run the project's tests: the installed `node_modules` are macOS builds. Run tests and the build on your own machine.
- Deployed app: https://tide-trace.vercel.app (the exact deployed commit was not verified).

## 7. Suggested next actions (older; superseded by section 5b)

1. Start step 2 (type scale) together with the helper-note removals and shortenings from the audit above, and the 44px minimum for `.btn.sm`. Agree the keep/remove list first.
2. Then the mobile layouts (steps 4–5) and the account menu, which change behavior and need more testing.
3. Optional housekeeping: rename `vite.config.js` to `vite.config.mjs`; split the large JS bundle.
4. Commit conventions: no Claude co-author trailer in commit messages on this project (owner's preference).

## UI/UX polish status (branch `ux-polish`)
- Contrast: teal text -> `--teal-strong`; placeholders use `--placeholder`; Rejected/Removed badges use the danger palette; every badge has a decorative status mark (CSS `::before`).
- Focus: archive search shows a ring on `:focus-within`; settings, auth and moderator select rings strengthened.
- Tokens: `--d-*` dark surface/border/text tokens replace duplicated hex in dark rules; `--r-sm` (8px) / `--r-md` (12px) radii and `--shadow-sm|md|lg` (landing `home.css` keeps its own values).
- Dark mode added for status badges, trace detail, trace map and the draft editor.
- `components/EmptyState.jsx` replaces plain "No ... yet" lines (wording unchanged). Main content fades in on route change (opacity only).
- Not done: specific loading labels (tests rely on the "Loading content" accessible name), real-device Safari checks.

## Trace detail polish (branch `trace-detail-polish`, built on `delete-own-traces`)
- Header row holds status plus owner actions (Edit, outline Delete); Delete no longer sits under the comment box.
- Public view order: photo (blurred backdrop for portrait/small), title, chips, author and date, description, map with quiet address caption, report link, comments. Contribution view keeps its order.
- Authors no longer see Report Trace / Report comment on their own content. Report links are quiet, left-aligned text links.
- Comments: heading, larger avatars, EmptyState when empty, clearer disabled Send, focus ring on the box.
- Card is 820px wide on desktop; title uses the title scale; description at body size.
- **Public trace detail redesign (same branch):** two columns on desktop (story left: photo hero, title block, description, comments; sticky details panel right: location map, "About this trace", Delete or Report). One column on phones with the map right after the description. Photo hero uses a fixed 16:10 shape with a blurred backdrop, extra photos become a thumbnail row, and an expand button opens a native `<dialog>` viewer (`.photo-viewer`). Dates read "3 days ago" with the full date on hover (`api/relativeTime.js`, `components/RelativeTime.jsx`). Comments are a thread with the signed-in avatar beside the box; per-comment Report appears on hover/focus (always visible on touch). Withheld locations and no-photo states have their own panels. The contribution (owner) view keeps its single-column order with Edit/Delete in the header.
- Not built: thumbnail switching between photos, "show earlier comments" (pagination stays), a sticky comment box on phones.

## Trace detail phase 1 (branch `trace-detail-phase-1`)
- Photos: thumbnails switch the main photo (`is-active`); the viewer has previous/next buttons, arrow keys and an "N of M" counter; hero photos get a loading shimmer and the alt text "<title>, photo N" (non-hero alt text unchanged because tests and uploads rely on "Trace photo N").
- Loading: `TraceDetailSkeleton` mirrors the two-column page for `/user/traces/:id` (still `data-skeleton-type="detail"`).
- Details panel: "Open in Maps" (only with a public pin), "Copy link" (button text is the confirmation, no toast), photo count in the facts.
- Report is a modal dialog (`ReportDialog`); falls back to the `open` attribute where `showModal` is missing (jsdom).
- Comments accumulate into one thread with "Show more comments" (heading shows `(N+)` while more remain), a characters-left counter in the last 500, and a comment box that sticks to the bottom on phones.
- Tests: `traceDetailActions.test.jsx`, plus a skeleton case in `loadingSkeletons.test.jsx`.

## Trace detail phase 2

- Branch: `trace-detail-phase-2`. Migration: `supabase/migrations/20261103000100_trace_phase_two.sql`, required **before deploying or merging to main**. The owner confirmed it has been applied to shared Supabase on 2026-11-02; main triggers automatic deployments.
- New routes: `DELETE /api/comments/:id` (active owner, soft deletion and open-report resolution), `GET /api/traces/:id/neighbors` (public feed order, independent of archive filters), `GET /api/traces/:id/related` (same category, public, newest first, maximum three). Related reads use the same public selection and author-photo shaping as the archive; private coordinates remain in the existing private location table.
- Components: `DeleteComment` (native confirmation dialog, inline errors, success/info toast and heading focus), `TraceNeighbors`, `RelatedTraces`. Both TraceCard links carry archive state. Comment removal filters every loaded page and preserves the next-page control.
- URL contract: `q` is trimmed and capped at 200 characters; `category` is a UUID (unknown loaded category falls back to All); `page` is 1–10000; `view` is list/map. Defaults are omitted. Search replaces history; category, view and pagination push entries. Browser Back/Forward sync the input. Detail/neighbor/related links carry a validated canonical archive search through router state; direct detail links return to the plain archive.
- Necessary addition to the plan's file list: `useRemoteData.js` accepts an explicit `object` option for the neighbor response, which has no record `id`; existing record validation remains the default.
- Verification: 122 server tests and 494 client tests passed; the production build passed (existing bundle-size warning). The 14 deletion/archive tests passed again after the native-dialog focus fix. All migrations and `supabase/tests/trace-phase-two.sql` passed using temporary PGlite PostgreSQL with minimal Supabase auth/storage bootstrap; no project dependencies were added. Native `psql`/Supabase CLI were unavailable, so a full disposable Supabase run remains outstanding.
- Chrome fixture checks passed: dialog Cancel/Escape and focus return, submitted failure stays inline, deletion removes the only comment with one toast and focuses Comments, archive page/filter return, neighbor navigation, related counts 0/1/5; light/dark at 320px and 1280px with no horizontal scroll. Screenshots caught and corrected mobile neighbor ordering. Hosted API/database integration and real-device Safari were not checked.
- Manual release checklist: apply the migration; run `psql -v ON_ERROR_STOP=1 -f supabase/tests/trace-phase-two.sql` against a disposable Supabase database; verify deletion/network-off recovery with a real account; check newest/middle/oldest neighbor links; check related categories with 0/1/4+ others; check filtered page 2 → detail → Back, browser Back/Forward and reload; keyboard-only, light/dark, 320px/desktop on the hosted app.

## Route error page (branch `error-page`)
- `components/RouteError.jsx` is the router's `errorElement` (set in `main.jsx`). A page that crashes while rendering now shows "Something went wrong" with Reload page and Go to home, instead of React Router's developer screen. A 404 route response shows "Page not found".
- It uses a plain `<a href="/">` and `window.location.reload()` and no app providers, because the crash may be inside `AppProvider`. The error text is shown only in development builds.
- Errors thrown outside the router (in `main.jsx`) and in event handlers or async code are not caught by this.
## Dashboard polish (branch `dashboard-polish`)
- Banner second line is built from the dashboard counts (`api/dashboardText.js`): revision requests and drafts first, "You're all caught up." or "Share your first trace." otherwise.
- "Needs your attention" (`components/NeedsAttention.jsx`): up to three traces, revision requests first, then drafts. Revision rows open the trace page, draft rows open the editor. Hidden when there is nothing to do; a "See all" link appears when more than three.
- Stat tiles are links to My Contributions (all, approved, pending) through an optional third item in `DashboardStats`.
- "Continue learning" (`components/NextLesson.jsx`): first unfinished lesson on the first page of Tides, with fallbacks for all finished, none, or a load error.
- No server changes. New tests: `client/test/dashboardPolish.test.jsx`.
- Layout pass: greeting is the page `h1`; "Upload trace" lives in the banner; the "Refresh totals" button, the Explore button and the "Go to" shortcuts block are gone from the user dashboard (totals still refresh on focus and every 30s). Desktop uses two columns (attention left, totals and learning right); with nothing to act on, totals and learning share one row. The attention list holds its space with placeholder rows while loading. "Recent from the community" has a "See all traces" link.
- Fixed: the revision list asked the server for `status=revision`; the API only accepts `revision_requested`.
- "What's new" (`components/WhatsNew.jsx`): up to three unread notifications under "Needs your attention", each linking to the Notifications page. Notifications have no trace id (only `action_id` into `moderation_actions`), so rows cannot deep-link to a trace yet; that needs the join to be exposed (check RLS on `moderation_actions` first).
- `useNotifications` now keeps the last known unread count for the same account while a refresh runs (tab focus, 60s poll), so the nav badge and "What's new" no longer vanish and return. The list itself still shows its loading state on refresh.

## Tides polish (branch `tides-polish`)
- Lesson cards (`components/TideCard.jsx`, `TideCard.css`): a colour block with a book icon (colour slot is a stable hash of the lesson id, `api/tideText.js`), a 16px two-line title, a three-line preview cut from the body, and "N min read" (about 200 words a minute) beside the completion status.
- `components/TideThumb.jsx` already accepts `tide.image_url`: when lessons get an image column it shows the image (revealed after it has fully loaded) and falls back to the colour block if it fails. The Tides API returns `select *`, so a new column reaches the card without server changes; the admin editor and an upload path still need building.
- "N of M completed" with a progress bar (`components/TidesProgress.jsx`): finished count from the dashboard totals, total from `community-summary` (`published_tides`). Clamped so unpublished-after-completion lessons cannot exceed the total. Hidden if either request fails.
- Removed the second heading ("Learn a new topic"); the progress line sits in its place.

## Tides lessons (branch `tides-lessons`)
- **Readable lessons:** lesson text is formatted by `api/lessonFormat.js` and rendered through React by `components/LessonBody.jsx` (never raw HTML). `## ` is a heading, `### ` a smaller heading, `- ` or `* ` a bullet, consecutive `1.` lines a numbered list, `**text**` bold. Single line breaks are kept. Old plain-text lessons still read fine. Reading time shows under the title and a thin progress bar follows the scroll (`ReadingProgress.jsx`).
- **Previous/Next:** `GET /api/tides/:id/neighbors` (library order, published only). After "Mark as complete" the next lesson card is highlighted as "Up next" (`LessonNav.jsx`).
- **New columns on `tides`** (migration `20261104000100_tide_lessons.sql`): `summary` (max 300), `category_id`, `cover_path`, `slides_path`, `slides_pages`. Admins set summary and topic through the normal save; the file paths can only be set by the `set_tide_asset` / `clear_tide_asset` functions.
- **Files:** private bucket `tide-assets` (covers: JPEG/PNG/WebP up to 5 MB; slides: PDF up to 25 MB). Admin routes `POST/DELETE /api/tides/:id/cover` and `/slides?pages=N`; `GET` of the same paths returns a signed link (10 minutes) for published lessons. The old file is removed after a replacement, and a failed attach removes the new upload. The `/api/tides` list adds `image_url` (signed, 1 hour) for cards.
- **Slides:** admin exports PowerPoint as PDF (File, Export, PDF) and uploads it on the lesson editor (the lesson must be saved once first). The browser counts pages with pdf.js (`api/pdfDocument.js`, the only file that imports it, loaded lazily). Members flip pages in `SlidesViewer.jsx` (buttons, arrow keys, Home/End, progress bar). The lesson content is kept as the text version below the slides and is required to publish.
- **Library:** topic chips, search (title and summary), and a progress filter (all / not started / completed) on `/api/tides?category_id=&q=&progress=`. `progress` needs a signed-in member.
- **Needs from you:** `npm install pdfjs-dist` in `client`, apply the migration, run the server and client tests, and run `supabase/tests/tide-lessons.sql` on a test database.
- Not done: slide-by-slide completion tracking, reordering lessons, a cover preview in the editor (it only says whether one is set).

## Navbar simplification (branch `navbar-simplify`)
- Member bar links are now Dashboard, Traces, Tides and Contributions. Notifications is a bell icon beside the profile photo (`.nav-bell`, small unread badge capped at 99+, label "Notifications (N unread)"); Settings is in the Account menu (admins and moderators keep "Change profile"; the admin Settings link is unchanged, it is a different page).
- No server changes. Tests: `responsive-navigation.test.jsx` updated and extended; `notifications.test.jsx` unchanged (the bell keeps the same link names).
- The profile photo is now the Account menu button at every width (`aria-label="Account menu"`): a dropdown with the member's name (and role for staff), Settings or Change profile, and Log out. The text "Account" button and the copies of these actions inside the mobile menu panel are gone; the hamburger holds only the page links. Styles are in `responsive.css` under "Account menu".
- The bell is now a dropdown (`components/NotificationMenu.jsx`): header with "Mark all as read", All/Unread tabs, the latest 10 notifications (unread ones bold with a dot, relative time), and a "See all notifications" link to the full page. The list is fetched when the menu is first opened and refreshed each time it opens or the unread count changes. Choosing a row opens the Notifications page and marks that notification read (notifications have no target to link to yet). On phones the panel spans the screen width under the header. Tests: `notificationMenu.test.jsx`.

## Tides chapters and images (branch `tides-chapters`)
- **Chapters:** a lesson with "Show in chapters" ticked (`tides.paged`) is split at each `## ` heading; text before the first heading becomes an "Introduction" chapter. Needs at least two chapters and no slides, otherwise the lesson shows in one piece. Reader (`ChapterReader.jsx`) has a contents list, Previous/Next, and keeps the chapter in `?part=N` (clamped). Reading progress follows the chapter; "Mark as complete" appears on the last chapter only. Splitting lives in `splitChapters` in `api/lessonFormat.js`.
- **Images in text:** line of its own `![description](image:UUID)`. Table `tide_images` (alt text required, max 40 per lesson), private bucket path `<lesson>/image-<uuid>.<ext>`, JPEG/PNG/WebP up to 5 MB with magic-byte check. Server: `POST/GET /tides/:id/images`, `DELETE /tides/:id/images/:imageId` (signed URLs, 1 hour). The lesson page only requests the image list when the text uses images. A missing image shows its description instead. Images need a saved lesson (the editor says so for new ones). Deleting an image removes its lines from the text.
- **Text import:** `.txt`/`.md` into the content box (`api/importText.js`). A file using `# ` titles is moved down one level so they become `##` chapters. Asks before replacing existing content. No `.docx`.
- Migration: `20261105000100_tide_chapters_images.sql`; SQL checks: `supabase/tests/tide-chapters.sql`.
- Not done: `.docx` import, per-chapter completion tracking, chapter reordering in the editor, images for slides lessons.

## Saved lesson progress (on `tides-chapters`)
- Chaptered lessons remember the chapter a member last reached: table `tide_progress` (one row per member and lesson, read-only to members) written only through `save_tide_progress` (migration `20261106000100_tide_progress.sql`, SQL checks in `supabase/tests/tide-progress.sql`).
- Server: `PUT /tides/:id/progress` `{part,total}`, `GET /tide-progress?tide_ids=`. `/tides?progress=` is now `completed` or `incomplete` (replaces `not_started`; incomplete = not completed, including in progress).
- Lesson page: opening a lesson without `?part=` jumps to the saved chapter and shows "Continuing from chapter N" with a start-over button. Moving between chapters saves after 400 ms. Nothing is saved on chapter 1 of a new lesson, after completion, or if the saved-state reads fail. Save errors are silent.
- Tides list: cards say "Completed", "In progress, chapter N of M" or "Not started". The progress filter reads All lessons / Incomplete / Completed.
- Not covered: single-page lessons and slides lessons (no position is saved), a resume link on the dashboard "next lesson" card.
