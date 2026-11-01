# TideTrace — Handoff (updated 2026-11-02)

Current state of the project, what was changed in the latest session, and what is left.

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

## 6. Decisions and caveats

- **Primary button = blue**, not clay (blue is already the most-used variant and passes at 7.76:1). Clay is reserved for contribution actions. One clay button per screen.
- **Danger is its own red.** Clay must not be used for destructive actions or errors.
- `home.css` defines its own `--clay`/`--soft` under `.tt-home`; token changes must be made in both places (done for this step).
- Tests do not reference button classes or these colors, but they do check wording and layout; update them when changing copy in later steps.
- This session's cloud environment cannot run the project's tests: the installed `node_modules` are macOS builds. Run tests and the build on your own machine.
- Deployed app: https://tide-trace.vercel.app (the exact deployed commit was not verified).

## 7. Suggested next actions

1. Start step 2 (type scale) together with the helper-note removals and shortenings from the audit above, and the 44px minimum for `.btn.sm`. Agree the keep/remove list first.
2. Then the mobile layouts (steps 4–5) and the account menu, which change behavior and need more testing.
3. Optional housekeeping: rename `vite.config.js` to `vite.config.mjs`; split the large JS bundle.
4. Commit conventions: no Claude co-author trailer in commit messages on this project (owner's preference).
