# TideTrace

TideTrace is a community conservation application with a React frontend and a Node.js API backed by Supabase PostgreSQL, Auth and Storage.

## Current status

- The frontend includes public, member, moderator and admin screens. Login, registration, email confirmation and logout use the backend. Dashboard data and actions still use in-memory mock data in `client/src/context/AppContext.jsx`.
- Community archive categories and approved Traces, My Contributions, and their detail pages now read saved records through the API. Contributions are scoped to the authenticated account by the backend. Lists have loading/error/empty states, retry controls, and pagination; they do not fall back to mock records.
- Members can create and edit their own Trace drafts through the API. The initial form supports photo selection and a local preview. Save draft saves details only; Submit Trace saves the record, uploads the selected photo, and submits for review. Saved draft details upload a selected photo through Submit for review, with no separate upload button. Signed previews and attachment removal are supported. Only a category is required to save a draft; saving does not submit or publish the Trace. Version checks prevent stale edits. Complete drafts can be submitted for review and become Pending until reviewed.
- Moderators and admins can review real Pending Traces, inspect saved photos, approve, request revision, or reject, and read persisted moderation history.
- The backend implements authentication, profiles, categories, Traces, evidence uploads, comments, reports, notifications, Tides, moderation and account administration.
- The existing Supabase schema supplies row-level security, guarded workflow functions and audit records. Configure a Supabase project before using persistent data.
- Dashboard access is determined by the current database profile returned by `/api/auth/me`; the old demo role picker is removed. Sessions survive reloads and refresh automatically. Saved roles are never trusted; the backend checks the current account before dashboard access is restored.

## Getting started

Use Node.js 22.12+ (or a newer supported Node release). Install dependencies from the repository root:

```sh
npm ci
```

Start the frontend:

```sh
npm run dev
```

Open the local URL printed by Vite on port **5173**. If the port is occupied, Vite reports an error. To open a browser automatically, run `npm run dev -- --open`.

For the API, copy `server/.env.example` to `server/.env` and set your Supabase project URL and publishable key. Follow [the database setup](supabase/README.md), then start a second terminal:

```sh
npm run dev:server
```

The API listens at `http://127.0.0.1:3001/api`. `GET /api/health` works without credentials; data endpoints return a setup message until Supabase is configured. The frontend proxies `/api` to port 3001.

See [the backend guide](server/README.md) for the endpoint contract, authentication, upload flow, environment settings and integration limitations.

## Try real authentication

Keep both development servers running, then open `http://localhost:5173/login` and use the real account created in Supabase. Members, moderators and admins are sent to their own dashboards based on their database role. Invalid credentials and suspended accounts do not grant dashboard access.

For signup confirmation and password recovery links, configure Supabase **Authentication → URL Configuration**:

- Site URL: `http://localhost:5173`
- Allowed Redirect URLs: `http://localhost:5173/auth/callback` and `http://127.0.0.1:5173/auth/callback`

Use the standard signup email template with `{{ .ConfirmationURL }}`. If you prefer entering a code in the app, include `{{ .Token }}` in that template. The app accepts 6–10 digit signup codes and checks them with Supabase. Email confirmation and delivery still depend on your project's Auth settings and SMTP configuration. For deployment, use your HTTPS frontend URL in both these settings and `CLIENT_ORIGIN`.

To recover an account (including the first admin), click **Forgot password?** on the login page or open `http://localhost:5173/forgot-password`. Enter the account email, open the newest recovery link, choose a new password and log in again. The account's role and history are preserved. Keep the standard Reset Password email template's `{{ .ConfirmationURL }}` link; optionally include `{{ .Token }}` to support entering a recovery code in the app. Recovery uses the same callback URLs listed above. No database migration or admin deletion is needed.

If sending recovery email is rate limited, check your inbox/spam for the latest message and wait before retrying. Supabase defaults to a 60-second recovery cooldown; its built-in email provider allows only two auth emails per hour across the project. An exhausted hourly quota must reset, or the project owner must configure custom SMTP for higher sending limits. Restarting the local API does not reset Supabase's quota. See [Supabase Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits).

Login sessions persist across reloads and browser restarts on browsers with Web Locks and available local storage. The app checks the database profile on restoration, renews access tokens before expiry, and coordinates refresh and sign-out across tabs on the same origin. Use the same address consistently: `localhost:5173` and `127.0.0.1:5173` have separate browser storage.

Without Web Locks, sessions use per-tab session storage and survive reloads within that tab. When storage is blocked, login still works in memory, but a reload requires signing in again. Only the access token, refresh token, and expiry are saved under `tidetrace-session-v1`; passwords and profile/role data are not saved there. These are browser-readable bearer credentials, so production must use HTTPS and protect against script injection.

Expired/revoked refresh tokens or suspended accounts clear the saved session. Temporary network/server errors retain the token pair and offer a retry; expired accounts cannot open protected pages while reconnecting. Logging out clears browser state immediately, then asks Supabase to revoke the session. If the server cannot be reached, local sign-out succeeds but server revocation is not confirmed.

Recovery sessions remain in memory, separate from saved login sessions, and do not automatically open a dashboard. Opening a recovery link clears the existing saved login. If the reset page is reloaded, request a new recovery email. Profile preferences and other dashboard actions remain a clearly labeled demo; Trace reading, draft saving and photo uploads are connected.

To check session management locally:

1. Keep both development servers running and log in at `http://localhost:5173/login`.
2. Open a dashboard subpage, then reload; you should stay on that page after the account check.
3. Open a second tab at the same address; it should restore the same account on supported browsers.
4. Log out in one tab; the other tab should also sign out. Reload to confirm it stays signed out.
5. With a saved session, stop the API and reload a protected page; it should offer a connection retry. Restart the API and retry to restore access.

Automated tests also cover token rotation, revoked sessions, profile changes, concurrent refreshes, and logout during pending requests. Hosted session behavior still needs verification with your development Supabase account.

## Technology and structure

- **Frontend:** React 19, React Router and Vite 8, with existing CSS styling.
- **Backend:** Node.js ES modules, Express 5, Zod validation and the Supabase JavaScript client.
- **Data:** Supabase PostgreSQL, Auth and a private evidence Storage bucket.
- **Tests:** Node's test runner and Supertest for the API; separate PostgreSQL access-control checks in `supabase/tests/`.

```text
TideTrace/
├── client/
│   ├── src/                 React pages, components and demo state
│   ├── public/              Static assets
│   └── vite.config.js       Port 5173 and /api proxy
├── server/
│   ├── src/                 API routes, validation, auth and server startup
│   ├── test/                HTTP tests with a mocked Supabase transport
│   ├── .env.example         Backend configuration template
│   └── README.md            API and setup guide
├── supabase/
│   ├── migrations/          Initial schema and access policies
│   ├── tests/               Database workflow/security checks
│   └── bootstrap-first-admin.sql
├── package.json             npm workspace commands
└── package-lock.json        Reproducible workspace dependencies
```

Frontend and backend dependencies are declared in their workspace manifests. Run installation commands from the repository root. Frontend build output goes to `client/dist/`.

## Available commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the frontend on port 5173. |
| `npm run dev:server` | Start the API with file watching on port 3001. |
| `npm run start:server` | Start the API without file watching. |
| `npm run build` | Build the frontend into `client/dist/`. |
| `npm run preview` | Preview the frontend build; start the API separately for `/api` requests. |
| `npm test` | Run backend HTTP tests and frontend authentication, session, Trace reading, draft and photo-upload tests. |
| `npm run verify:reads` | Check live Trace reads against the configured Supabase project without writing records. |

## Rate limits

The backend enforces these limits per IP address. Each row has a shared request budget across the routes it covers, rather than a separate budget per endpoint or account.

| Scope | Limit | Applies to |
| --- | --- | --- |
| General API | 300 requests per minute | All `/api` routes except `/api/health`, including draft creation and editing. |
| Authentication | 30 requests per 15 minutes | Authentication routes such as login, registration, verification and password recovery; excludes session maintenance below. |
| Session maintenance | 120 requests per 15 minutes | `/api/auth/me`, `/api/auth/refresh` and `/api/auth/logout` combined. |
| File uploads | 20 requests per 15 minutes | Authenticated uploads to `POST /api/traces/:id/media`, from both the initial Trace form and saved draft details. |

The general API limit also applies to requests covered by a more specific limit. Requests exceeding a limit receive HTTP **429 Too Many Requests** with a JSON error and retry guidance. Failed attempts that reach a limiter also count toward its budget. People sharing an IP address share these limits.

Draft saves have no separate limit beyond the general API budget. Retrying attachment of an already uploaded file, removing an attachment, and requesting a photo preview also use the general budget; they do not consume the file-upload budget. Supabase email quotas and other upstream limits are separate from these application limits.

Counters are stored in server memory, reset on restart, and are not shared across server instances. Multi-instance deployment requires a shared rate-limit store. The server currently does not trust forwarded IP headers; deployment behind a proxy requires explicit trusted-proxy configuration so client addresses are identified correctly. These limits protect this API, not requests sent directly to Supabase. See the [backend setup guide](server/README.md) for deployment details.

## Environment and live read checks

Run `npm run verify:reads` to check Trace reading against the Supabase project configured in `server/.env`. The command starts a temporary local API, makes GET requests, and exits. It verifies active categories, the public archive and category filter, available public details, and rejection of unauthenticated contribution requests. It does not create records, send emails, or change the database. Empty datasets and unavailable authenticated checks are explicitly marked `SKIP`.

For authenticated live checks, a project developer can supply an existing short-lived access token using the `TIDETRACE_VERIFY_ACCESS_TOKEN` environment variable; do not paste it into chat, commit it, or put it in a command-line argument. The command checks contribution ownership and available detail records without logging in or refreshing the token. Without this variable, only public reads and unauthenticated access checks run. `npm test` separately exercises frontend behavior and API authorization with mocked Supabase responses.

`server/.env` is ignored by Git. The backend accepts a Supabase publishable or legacy anon key and rejects privileged service-role/secret keys. It uses the caller's verified identity and database permissions. See [server/.env.example](server/.env.example).

## Trace workflow

Trace reading, draft creation/editing, photo uploads, and submission for review are connected to the backend. Keep both development servers running and sign in with a member account. The existing database and private `trace-media` Storage setup must be applied; these frontend changes do not require a new migration. RLS remains enabled, and no service-role key is needed.

### Browse saved Traces

- **Traces** (`/user/traces`) shows approved, visible records and live category filters. Drafts do not appear in this archive.
- **My Contributions** (`/user/contributions`) shows the signed-in member's saved records, including drafts and revision requests. The backend restricts these reads to their owner.
- Detail links fetch saved records directly and work after reload. Lists show 25 records per page. Archive text search and contribution status filters apply to the current page; archive category filtering happens on the server.
- Loading, empty and error states use real API results. Failed reads offer a retry and do not fall back to sample records.

### Create a Trace or save a draft

1. Choose **New Trace** from Traces or My Contributions to open `/user/traces/upload`.
2. Select a category. Title, location and description are optional while the Trace is a draft.
3. Optionally choose one JPEG, PNG or WebP photo, up to 20 MB. The form displays a local preview and lets you remove or replace the selection before saving. Selecting a photo alone does not upload it.
4. Choose the primary **Submit Trace** action when ready, or the secondary **Save draft** action to finish later. Submit Trace requires a title, description, location, active category and photo; Save draft requires only an active category.
5. Missing information appears beside the relevant fields after a submission attempt, with errors clearing as you correct them. The form no longer shows a readiness checklist.
6. **Submit Trace** saves the record, uploads the selected photo, reloads the record and submits its latest version for review. **Save draft** saves only the details, even when a photo is selected. The saved contribution detail opens when the chosen action succeeds. Photo selections are temporary: after saving a draft, select the photo again when you are ready to submit.

**Save draft** keeps the Trace in **Draft** status; it does not publish it or send it to moderators. If draft creation fails, the photo is not uploaded. If the draft saves but its photo upload fails, the page keeps the saved draft and offers photo recovery, so retrying does not create another Trace. If submission fails or its outcome is uncertain after saving, use **Open saved Trace** to check the existing record before trying again; the app does not repeat creation or submission automatically.

### Continue editing a draft

Open a saved draft and choose **Edit draft**. The form loads its saved fields and version, with **Submit Trace** as the primary action and **Save draft** as secondary. Authors can edit their available Draft and Needs revision records; Pending, Approved, Rejected, hidden and deleted records remain locked.

Saving is manual. Unsaved text remains in the form after an error, and closing or reloading the browser warns about unsaved form changes. In-app navigation does not autosave. Location is entered as text; map pinning is not connected. Changing an existing location name clears previously saved coordinates, while other edits preserve them.

If another tab or an attachment change has updated the Trace, a stale save is rejected. Copy any text you want to keep, then choose **Discard local changes and reload saved draft** before editing again. If a save response is lost or cannot be verified, the app does not automatically replay the write; check My Contributions before trying again.

### Address requested revisions

Open a Needs revision Trace in My Contributions to read **Moderator feedback**, with the latest decision first and earlier reviews available through pagination. Choose **Edit requested revision** to update its title, description, category and location. The feedback is also shown beside the edit form. Revision saves require non-empty title, description and location fields, matching the existing database constraints.

Use **Save changes** to persist edits on the same Trace. Its status stays **Needs revision**; saving does not create another Trace or resubmit it. Select a replacement photo or remove saved photos from its detail page as needed; the selected photo uploads when you resubmit. When finished, choose the primary **Resubmit for review** action from the edit form or saved detail (the edit form saves your changes first): the app checks the current record, active category and attached image, submits the latest version, and returns the Trace to **Pending review** with editing and uploads locked again.

Stale edits and uncertain writes require an explicit reload/status check before retrying. Previous decisions and feedback remain in moderation history, and reviewers see **Previous review feedback** alongside a resubmitted Trace. Authors read feedback through an owner-authorized endpoint, not staff routes. No database migration is required; member notifications remain a separate integration task.

### Manage saved photos

On a Draft or Needs revision detail page, use **Photos → Choose a photo**, then **Submit for review** or **Resubmit for review**. That single action uploads the selected photo and submits the Trace. There is no separate Upload photo button. Selecting or clearing a file does not upload it, and leaving or reloading the page discards the selection. Files must be non-empty and at most 20 MB each. The backend validates file signatures and ownership. Both initial-form and detail-page uploads use the same [upload rate limit](#rate-limits).

Uploads go through the authenticated API into private Supabase Storage. A progress indicator remains visible while uploading and attaching; it does not estimate a percentage. Saved previews use short-lived signed URLs. If a preview fails or expires, **Reload photo** requests a fresh link. Approved Trace details display photos without upload or removal controls.

**Remove photo** immediately detaches it from the draft. Adding or removing an attachment increases the Trace version. Physical removal of detached Storage objects remains a maintenance task in the existing backend; the frontend action removes the attachment from the Trace.

If the file uploads but attaching it fails, click **Submit for review** again. It checks saved attachments and reuses the existing upload path before submitting, without uploading the file bytes again. If the outcome of a write is uncertain, use **Reload saved attachments** and check the photos before trying again. This clears the local file selection to prevent accidentally uploading it twice; select it again only if it is missing. Recovery paths and selected files are kept only while the page remains open; they are not restored after a reload.

### Submit a Trace for review

Open your saved draft from My Contributions and use **Submit for review**. Missing title, description, location, category or photo information is shown inline when you try to submit; there is no readiness checklist. A valid selected photo satisfies the local photo requirement. The app checks the saved text and category, uploads the selected photo, reloads the updated Trace version, then submits. If upload fails, the Trace remains editable and is not submitted; resolve the photo error before retrying. If upload succeeds but submission fails, retrying submission reuses the attached photo.

The app reloads the draft and active categories before submitting, then sends only its latest version to `POST /api/traces/:id/submit`. If another tab changed the text, the updated details appear for you to review before trying again. Concurrent attachment changes and duplicate submission clicks are blocked locally; database version checks protect against changes from other tabs.

Successful submission changes the status to **Pending review** and removes editing/upload controls. Pending Traces stay in My Contributions and remain outside the approved archive. Saving a draft still does not submit it automatically. A version conflict or uncertain submission response requires **Reload saved Trace** to check the current status before retrying; submission is never automatically replayed.

### Review submissions as staff

Moderators open **Review Traces** at `/moderator/review`; admins can use `/admin/review`. The queue loads real Pending records, with refresh and pagination. Open a record to inspect its saved title, author, category, location, description and signed photo previews. Detail URLs work directly after reload. The moderator dashboard's oldest pending cards also use this live queue; its count is the number shown (up to four), not a total. Other dashboard statistics remain demos.

Choose **Approve & publish**, **Request revision**, or **Reject**. Feedback is required for revision and rejection. Approval makes the Trace eligible for the public archive; revision changes its status to Needs revision; rejection is final and retains the record in the author's contributions. Authors see the new status when they reopen or refresh their contributions. Reviewers cannot decide their own submissions.

Decisions use the version shown during review. While saving, all decision buttons are disabled. A conflict or uncertain response requires **Reload Trace** before retrying; copy any feedback you want to keep first. Decisions are never automatically replayed. After a saved decision, return to the queue for refreshed results or open **Moderation history** to see the saved action, reviewer, feedback and timestamp. History is paginated and includes report resolutions recorded by the backend.

The database records the decision and creates the author's review notification in the same workflow. Revision editing/resubmission and feedback are connected; member notifications are not connected yet. Staff screens support photo previews; video playback remains deferred.

### Verify against your Supabase project

Automated tests cover Trace reads, draft creation/editing, version conflicts, initial-form photo selection, upload ordering, attachment recovery, removal, invalid files and logout during requests. They mock API/Supabase responses and do not prove live database or Storage persistence. `npm run verify:reads` checks live reads only; it does not test uploads or draft writes.

With a signed-in development account:

1. Save a category-only draft and find it in My Contributions. Reload its detail, edit its text, save and reload again.
2. Choose a photo on the initial form and click **Save draft**. Confirm only the text/category are saved and no photo is attached. Complete the saved draft, choose a photo and click **Submit for review**; verify the photo and Pending status remain after reload.
3. Use **Submit Trace** on a complete initial form with a photo. Verify a single Trace is created, its photo is attached, and its status is Pending. Request revision as a reviewer, then remove or select a replacement photo as the author and resubmit. Confirm the same Trace and updated photo persist.
4. Open the same draft in two tabs and save different text edits. Confirm the second save reports a version conflict instead of overwriting the first.
5. Confirm drafts are absent from the approved archive and another member cannot read or edit your draft.

Also submit a complete draft and confirm that it remains Pending after reload, cannot be edited or receive uploads, and is absent from the approved archive. Test a second tab changing the record during submission to verify the conflict/reload behavior.

Using a separate moderator or admin account, open a Pending Trace, inspect the photo, save a decision, then check history. With the author account, reload the contribution to verify its status; approval should also make the Trace appear in the archive. For a revision request, use the author account to read feedback, save text changes, reload, select a replacement photo if needed, and resubmit the same Trace; the reviewer should see the previous feedback when reopening it. Also test rejection, self-review denial and a second reviewer deciding the same version.

Live draft-write, photo-upload, submission and moderation verification still needs a signed-in account against the configured development project.

## Remaining integration

Follow this order. Steps 2–8 are planned work, not completed integrations.

1. **Verify the complete Trace workflow against live Supabase.** Start `npm run dev:server` and `npm run dev` in separate terminals; open `http://localhost:5173`. Use an author and a separate moderator/admin account. Follow the verification steps above: save details only, submit with a photo, request revision, edit/resubmit, approve, and reload after each stage. Verify ownership restrictions and that only approved records reach the archive. Keep RLS enabled. Automated mocks do not replace this check.

2. **Connect member notifications.** Replace demo data in `Notifications.jsx` with paginated `GET /api/notifications` results. Map persisted `message`, `created_at`, and `read_at` to the UI. Use `POST /api/notifications/read` with `{ "ids": ["notification-uuid"] }` for individual reads or `{ "ids": null }` for all owned notifications; a successful response is 204. Refresh the list and navbar unread indicator after writes. If the badge needs a total across all pages, add an owner-scoped count endpoint rather than counting one page. Add an authorized Trace destination to the API response if needed for links to feedback. Verify that a review decision appears only for its recipient and that read state survives reload.

3. **Connect Tides reading.** Replace the demo `tides` array in `Tides.jsx` and `ViewTide.jsx` with `GET /api/tides` and `GET /api/tides/:id`. Render saved `title` and `body`, plus real loading, empty, not-found and retry states. Start with plain text and preserved line breaks; introduce a safe Markdown renderer only if formatted lessons are required. Use published records only. The current schema has no duration, module, or learner-progress fields, so remove those mock values or explicitly add schema support. Hide Continue learning and Mark as complete until step 5. Verify a published lesson opens by direct URL after reload while drafts and archived lessons remain inaccessible to members.

4. **Connect admin Tides authoring and publication.** Replace demo mutations in `ManageTides.jsx` with `GET /api/admin/tides`, `POST /api/admin/tides`, and `PUT /api/admin/tides/:id`. Build fields for `title`, unique lowercase-hyphenated `slug`, `body`, and `status` (`draft`, `published`, `archived`). Add Save draft, Publish, Return to draft and Archive actions, with inline errors and disabled controls while saving. Publication status must come from `status`, never learner completion. Publishing requires non-empty content. Support direct editor URLs with an admin-authorized detail read if added. Verify that draft content is private, publishing exposes the saved lesson, and returning it to draft or archiving removes member access. Include duplicate-slug and non-admin write tests. Plan version conflict protection before allowing simultaneous editors.

5. **Persist Tides learning progress.** Add a new incremental migration for a progress table keyed by `(user_id, tide_id)`, with completion state and timestamps, foreign keys, and RLS restricting reads/writes to the signed-in learner. Add authenticated read and idempotent update endpoints that also verify the lesson is accessible. Connect Mark as complete and Continue learning to those records. For an MVP, use not-started/in-progress/completed states; do not display invented percentages without defined lesson sections. Verify persistence across reloads/devices, no duplicate completion rows, and isolation between users. Do not rerun or replace the original schema migration.

6. **Connect comments, reports and their moderation.** Connect Trace comments to the existing `GET/POST /api/traces/:id/comments` routes with pagination, inline errors and duplicate-click protection. Connect report forms to `POST /api/reports`, requiring exactly one Trace or comment target and a reason. Then connect staff report queues and decisions to the moderation API; add any missing comment-management endpoints before wiring their buttons. Verify permissions, hidden-content behavior, saved reasons and audit history. Launch community posting together with working reporting/moderation.

7. **Replace remaining dashboard and administration demos.** Connect member contribution totals, reviewer queue totals and admin summaries to authorized aggregate queries/endpoints. Do not calculate totals from a paginated list. Connect profile editing, category management and account/moderator administration to existing APIs, adding missing operations deliberately. Verify role restrictions, reload persistence and session changes after account suspension or role updates. Remove demo notices only from features that actually use saved records.

8. **Prepare the MVP for deployment.** Configure and test email confirmation/recovery for ordinary users, production frontend/API URLs, allowed origins and Auth redirects. Run the full automated suite, production build and signed-in smoke checks for each role against a development/staging project before release. Set up monitoring and a deliberate cleanup process for orphaned/detached Storage files. Map pinning, video playback/uploads, quizzes and MFA can remain later work unless they become release requirements.

## User Flow Diagram ##
<img width="10471" height="5822" alt="Tide Trace_userflow" src="https://github.com/user-attachments/assets/c45946a1-d19d-4206-ac75-3bc93f1c68ca" />

## Moderator Flow Diagram ##
<img width="11642" height="5948" alt="Tide Trace_moderatorflow" src="https://github.com/user-attachments/assets/a7cfc215-6886-4aaa-bd38-b4e0be2e2e6e" />

## Admin Flow Diagram ##
<img width="11592" height="5542" alt="Tide Trace_adminflow" src="https://github.com/user-attachments/assets/91089c27-a687-4e64-b97a-1486f845c59a" />

## Entity-Relationship Diagram ##
<img width="7822" height="5792" alt="Database ERD Diagram" src="https://github.com/user-attachments/assets/984b36d1-d11c-4b57-8865-3d44b24876c1" />

## System Architecture Diagram ##
<img width="15185" height="6833" alt="System Architecture" src="https://github.com/user-attachments/assets/42473242-d54a-4fa4-986a-de661b3f1204" />

## Sitemap Diagram ##
<img width="13563" height="6601" alt="Sitemap" src="https://github.com/user-attachments/assets/bf8a2c03-2189-4f96-baa1-1a01562e0cad" />


## UPDATES ##
## A. Foundation & Architecture ##
## v1.0 — Initial Prototype ##

Built the (User, Moderator, Admin) from the approved flowcharts. It covers the full journey: login, dashboard, traces, tides, contributions, notifications, and settings. All roles share one simulated data layer, so actions in one role visibly affect the others. For example, a user's submitted trace appears instantly in the moderator's review queue. A confirmation modal and toast system gives feedback for every action.

## v1.1 — Homepage & Navigation ##
Added the homepage directly into it so the flow starts from a public landing page. It includes the hero, mission, feature pillars, impact stats, and call-to-action sections. The navigation bar was upgraded with icons next to each link and stays centered at the top. When logged out, visitors see the public nav with Log in and Join buttons. The homepage CTAs are flow-aware, sending users to login or straight into the app depending on their state.

## v1.2 — Complete Role Flows ##
Built out the full Moderator and Admin experiences to match the flowcharts. Moderators get a review queue, decision cards, flagged comments, reports, and analytics. Admins manage users, moderators, Tides content, moderation history, system settings, and platform analytics. Every decision updates the shared data, so the user sees status changes and notifications immediately. Admin actions like publishing content also trigger notifications for users.

## v1.3 — Animations ##
Added smooth fade-in animations across the entire prototype. Every page opens with a gentle fade and a staggered content cascade. Wizard steps, settings tabs, and modals also transition cleanly. The animations are CSS-only, so they replay each time a page opens without extra JavaScript. A reduced-motion setting is respected for accessibility.

## v1.4 — Security Features ##
Added 6-digit email verification (OTP) when logging in or registering. The code appears in a simulated inbox for demo purposes, with a live 5-minute expiry timer and resend option. The input boxes auto-advance, support pasting, and auto-submit when complete. Also added a change-password feature in Settings with a live strength meter and full validation. Every password change is recorded in the Admin's system logs.

## v1.5 — Responsive & Access Control ##
Made the entire prototype responsive across seven breakpoints, from small phones to large desktops. Menus collapse into hamburgers, grids stack, and touch targets grow on mobile. Added logout buttons to all three role navbars in the same top-right position. The Home link was removed from logged-in navs to keep them role-scoped. The logo still returns to the homepage at any time.

## v1.6 — Documentation Alignment ##
Applied all 8 PRD fixes directly into the product. Users can now report comments with a reason, which feeds the moderator's flagged queue and reports page. Rejected traces are now visibly final and cannot be resubmitted. Wording across the app matches the documented rules for moderator-only review and permissions. Docs, prototype, and database policies now all tell the same story.
