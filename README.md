# TideTrace

TideTrace is a community conservation application with a React frontend and a Node.js API backed by Supabase PostgreSQL, Auth and Storage.

## Current status

- The frontend includes public, member, moderator and admin screens. Login, registration, email confirmation and logout use the backend. Dashboard data and actions still use in-memory mock data in `client/src/context/AppContext.jsx`.
- Community archive categories and approved Traces, My Contributions, and their detail pages now read saved records through the API. Contributions are scoped to the authenticated account by the backend. Lists have loading/error/empty states, retry controls, and pagination; they do not fall back to mock records.
- Members can create and edit their own Trace drafts through the API. The initial form supports optional photo selection and a local preview; saving creates the draft before uploading the photo. Saved draft details support additional uploads, signed previews, and attachment removal. Only a category is required; saving does not submit or publish the Trace. Version checks prevent stale edits.
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

Trace reading, draft creation/editing, and photo uploads are connected to the backend. Keep both development servers running and sign in with a member account. The existing database and private `trace-media` Storage setup must be applied; these frontend changes do not require a new migration. RLS remains enabled, and no service-role key is needed.

### Browse saved Traces

- **Traces** (`/user/traces`) shows approved, visible records and live category filters. Drafts do not appear in this archive.
- **My Contributions** (`/user/contributions`) shows the signed-in member's saved records, including drafts and revision requests. The backend restricts these reads to their owner.
- Detail links fetch saved records directly and work after reload. Lists show 25 records per page. Archive text search and contribution status filters apply to the current page; archive category filtering happens on the server.
- Loading, empty and error states use real API results. Failed reads offer a retry and do not fall back to sample records.

### Create a draft with an optional photo

1. Choose **New draft** from Traces or My Contributions to open `/user/traces/upload`.
2. Select a category. Title, location and description are optional while the Trace is a draft.
3. Optionally choose one JPEG, PNG or WebP photo, up to 20 MB. The form displays a local preview and lets you remove or replace the selection before saving. Selecting a photo alone does not upload it.
4. Click **Save draft**. The API creates the draft under your account, then uploads and attaches the selected photo. A progress indicator appears during the upload.
5. When saving and any selected upload succeed, the saved contribution detail opens. You can return to it later through My Contributions.

Saving keeps the Trace in **Draft** status; it does not publish it or send it to moderators. If draft creation fails, the photo is not uploaded. If the draft saves but its photo upload fails, the page keeps the saved draft and offers photo recovery, so retrying does not create another Trace.

### Continue editing a draft

Open a saved draft and choose **Edit draft**. The form loads its saved fields and version. Only the owner's available draft-status records can be edited through this form; pending, approved, rejected, hidden and deleted records are not editable here. Revision-request editing and resubmission remain deferred.

Saving is manual. Unsaved text remains in the form after an error, and closing or reloading the browser warns about unsaved form changes. In-app navigation does not autosave. Location is entered as text; map pinning is not connected. Changing an existing location name clears previously saved coordinates, while other edits preserve them.

If another tab or an attachment change has updated the Trace, a stale save is rejected. Copy any text you want to keep, then choose **Discard local changes and reload saved draft** before editing again. If a save response is lost or cannot be verified, the app does not automatically replay the write; check My Contributions before trying again.

### Manage saved photos

On a draft's detail page, use **Photos → Choose a photo → Upload photo** to add more JPEG, PNG or WebP images, one at a time. Files must be non-empty and at most 20 MB each. The backend validates file signatures and ownership. Both initial-form and detail-page uploads use the same [upload rate limit](#rate-limits).

Uploads go through the authenticated API into private Supabase Storage. A progress indicator remains visible while uploading and attaching; it does not estimate a percentage. Saved previews use short-lived signed URLs. If a preview fails or expires, **Reload photo** requests a fresh link. Approved Trace details display photos without upload or removal controls.

**Remove photo** immediately detaches it from the draft. Adding or removing an attachment increases the Trace version. Physical removal of detached Storage objects remains a maintenance task in the existing backend; the frontend action removes the attachment from the Trace.

If the file uploads but attaching it fails, **Retry attachment** checks saved attachments and reuses the existing upload path. If the outcome of a write is uncertain, use **Reload saved attachments** and check the photos before uploading again. Recovery paths and selected files are kept only while the page remains open; they are not restored after a reload.

### Verify against your Supabase project

Automated tests cover Trace reads, draft creation/editing, version conflicts, initial-form photo selection, upload ordering, attachment recovery, removal, invalid files and logout during requests. They mock API/Supabase responses and do not prove live database or Storage persistence. `npm run verify:reads` checks live reads only; it does not test uploads or draft writes.

With a signed-in development account:

1. Save a category-only draft and find it in My Contributions. Reload its detail, edit its text, save and reload again.
2. Create another draft with a selected photo. Verify that its detail shows the saved photo after reloading.
3. Add another photo from the saved detail, edit/save the text afterward, then remove an attachment and reload to confirm the change.
4. Open the same draft in two tabs and save different text edits. Confirm the second save reports a version conflict instead of overwriting the first.
5. Confirm drafts are absent from the approved archive and another member cannot read or edit your draft.

Live draft-write and photo-upload verification still needs a signed-in account against the configured development project.

## Remaining integration

The next Trace feature is **Submit for review**. Its backend workflow already exists, but the frontend action is not connected. It must require the necessary text fields, an active category and at least one attached image before changing a Trace from Draft to Pending.

Revision-request editing/resubmission, video uploads/playback, comments, map pinning, dashboard statistics, moderation and other actions still need frontend integration. Dashboard demo state does not reflect saved Trace activity yet. Hosted email delivery also needs validation against the configured Supabase project. Lesson progress, expanded profile preferences and other features absent from the current schema remain deferred; see the [backend guide](server/README.md) for details.

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
