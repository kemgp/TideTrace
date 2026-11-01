# TideTrace — Handoff (2026-11-01)

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

**Branch:** `ui-contrast-and-buttons` (created from `main`). **Nothing is committed.**

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

- `npm test` (client): 407 of 408 passed on the first full run. The one failure, `moderation.test.jsx` "does not replay a conflicting or uncertain decision (502)", timed out finding a button under 40 parallel workers. Re-run alone: 13/13 passed. Treated as a load flake. It was not caused by these edits (only class names changed; the tests find buttons by role and name).
- **Not yet done:** `npm run build`; visual check of the archive, submission form, moderator review page and homepage at desktop and 320px; contrast measurement of the final rendered colors in a browser; server tests (`npm test` at the root, not rerun).
- `npm run build` rewrites `client/dist/`. Check `git status` afterwards to see whether `dist` is tracked, and do not commit unrelated `dist` changes with this work.

## 5. What's left (planned, in order)

2. **Type scale.** Define role-based sizes in `rem` as variables (page title 28–32, section 20–24, card title 16–18, body and inputs 16, labels and buttons 14–16, metadata 13–14, badges 12) and replace the ~15 scattered pixel sizes (9.5px–17px; most-used: 12px, 11px, 14px, 13px, 12.5px). Badges are 9.5px, hints 11px, chips 11.5px. Inputs are 38px tall at 13px text; 16px prevents iOS focus zoom. Files: `index.css`, `responsive.css`, `user.css`, `admin.css`, `moderator.css`, `TraceDraftLayout.css`, `home.css`.
3. **Button sizing and states.** `.btn.sm` computes to about 37px tall and is used ~64 times; target 44px or document the exception. Raise labels to 14–16px. Add loading, pressed and disabled states. Retire the `teal` button variant (now unused except in `Button.jsx` docs).
4. **Mobile filters.** Replace the three rows of category chips in `ViewTraces.jsx` with a labelled select under about 640px.
5. **Mobile form navigation.** Turn the five-step panel in `TraceDraftLayout` into a "Jump to section" disclosure on mobile; keep the desktop sidebar.
6. **Empty state** (`ViewTraces.jsx` line ~63): "No traces match these filters. Try another search or clear filters." with a Clear filters button; hide pagination when empty.
7. **Account menu** in `Navbar.jsx`: move "Change profile" and "Log out" into an accessible dropdown.
8. **Form copy** (`SubmitTrace.jsx`, `TraceDraftForm.jsx`, `TraceLocationPrivacy.jsx`): shorten the intro, put requirement hints beside fields, make the sensitive-location text at least 13px.
9. **Photo placeholder** (`TraceCard.jsx` ~line 84): neutral loading state; separate states for unavailable and data-saver photos.

Out of scope of the review, still unchecked: admin/moderator flows beyond the buttons above, dark mode, 200% zoom, real-device Safari, end-to-end submission, whether the search box shows focus (`.search input` sets `outline:none`; parent focus style not checked).

## 6. Decisions and caveats

- **Primary button = blue**, not clay (blue is already the most-used variant and passes at 7.76:1). Clay is reserved for contribution actions. One clay button per screen.
- **Danger is its own red.** Clay must not be used for destructive actions or errors.
- `home.css` defines its own `--clay`/`--soft` under `.tt-home`; token changes must be made in both places (done for this step).
- Tests do not reference button classes or these colors, but they do check wording and layout; update them when changing copy in later steps.
- This session's cloud environment cannot run the project's tests: the installed `node_modules` are macOS builds. Run tests and the build on your own machine.
- Deployed app: https://tide-trace.vercel.app (the exact deployed commit was not verified).

## 7. Suggested next actions

1. Run `npm run build` and look at the app (`npm run dev`) on: `/user/traces`, `/user/traces/upload`, `/moderator/review/<id>`, `/login`, the homepage — at desktop and phone widths.
2. If it looks right, commit the branch (`git add -A && git commit`) and decide whether to merge before starting step 2.
3. Then start the type scale.
