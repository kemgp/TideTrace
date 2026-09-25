# TideTrace API

Node.js/Express API for the existing Supabase schema. Supabase provides persistent PostgreSQL data, Auth and private evidence Storage. The API validates inputs, checks the current user's database role, and runs queries under that user's JWT so row-level security still applies. It never uses a service-role key.

The React authentication screens call this API through the Vite `/api` proxy. They support password login, signup, email link/code confirmation, password recovery, current-profile role checks and logout. Login sessions persist in browser storage and renew through `/api/auth/refresh`. Restoration and periodic session checks fetch the current profile through `/api/auth/me`. Recovery sessions remain memory-only. Dashboard data/actions still use mock state in `client/src/context/AppContext.jsx` and are labeled as a demo.

## Local setup

Use Node.js 22.12+ (or a newer supported Node release). From the repository root:

```sh
npm ci
cp server/.env.example server/.env
```

Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in `server/.env`. Use the project's publishable key or legacy `anon` key. Secret/service-role keys are rejected. Never put a database password or privileged key in React.

Install the schema and create the first admin following [the Supabase setup](../supabase/README.md). The initial migration is intended for a new project; don't rerun it over existing tables. Configure Supabase email confirmation and SMTP delivery. The API does not run migrations or send emails during startup.

Start the API and frontend in separate terminals:

```sh
npm run dev:server
```

```sh
npm run dev
```

The API listens at `http://127.0.0.1:3001/api`. The frontend stays on port **5173** and proxies `/api` to port 3001. `npm run start:server` runs without the file watcher. Neither command automatically starts the other server. If you change `PORT`, also update the Vite proxy target.

`GET /api/health` checks the process and returns a `configured` boolean. Without credentials, the server can still start, but data endpoints return `503 NOT_CONFIGURED`. `GET /api/ready` checks that Supabase can read the categories table; it is not a full migration or Auth/Storage diagnostic.

## API conventions

The frontend's archive and contribution pages now consume `GET /api/categories`, `GET /api/traces`, `GET /api/traces/:id`, `GET /api/contributions`, and `GET /api/contributions/:id`. Requests use the current access token, renew an expiring session, and discard results after navigation or account changes. Category filters use category UUIDs. Public detail and private owner-scoped detail remain separate. Member draft creation/editing, photo uploads/removal, signed previews and submission for review are connected. The form offers primary Submit Trace and secondary Save draft actions with inline validation; the submit action saves first, uploads selected evidence, then submits, while draft saving permits unfinished details. Submission reloads the owner-scoped record and active categories, validates required text and an attached image, and sends the current version without replaying failed writes. Authors can save edits and change photos on Draft and Needs revision records; saving preserves the current status. Resubmission returns Needs revision to Pending. Authors and staff can read per-Trace review feedback through separate authorized routes. Staff queue/detail pages, decisions and moderation history now consume the moderation API; report/comment moderation screens remain demos.

- Successful JSON responses use `{ "data": ... }`. Deletes, logout, password changes and void workflow operations return HTTP 204.
- Failures use `{ "error": { "code", "message", "request_id", "details"? } }`. Validation details identify invalid fields. Internal Supabase payloads and credentials are not returned.
- Protected requests use `Authorization: Bearer <access_token>`. Roles come from the database, never request metadata or localStorage. The frontend maps the database role `moderator` to its internal `mod` route value.
- Send JSON with `Content-Type: application/json`, except media uploads. Unknown body fields are rejected. UUIDs, lengths, statuses and numeric ranges are checked.
- List routes accept `limit` (1–100, default 25) and `offset` (0–100000, default 0). Categories are returned as one active list. Lists return arrays rather than total counts.
- `409 STALE_VERSION` means reload the Trace before retrying. Do not automatically replay edits or moderation decisions. Database-owned workflows also enforce ownership, status transitions, no self-review and last-admin protection.
- Public feed/detail routes explicitly filter published/approved visible content, including when a staff token is provided. Private submissions have separate endpoints.

## Authentication

| Method and path | Body / purpose |
| --- | --- |
| `POST /api/auth/register` | `email, password, display_name`; creates a member account. Password minimum: 8 characters, plus your Supabase password policy. |
| `POST /api/auth/login` | `email, password`; actual Supabase password authentication. |
| `POST /api/auth/refresh` | `refresh_token`; exchange for a new session. |
| `POST /api/auth/verify` | `email, token, type` (`signup` or `recovery`); verify the code sent by Supabase. |
| `POST /api/auth/resend` | `email`; resend signup confirmation. |
| `POST /api/auth/forgot-password` | `email`; send Supabase recovery instructions. |
| `GET /api/auth/me` | Bearer token; current profile, role, status and email. |
| `PUT /api/auth/password` | Bearer token; `password` and optional `nonce` for Supabase reauthentication. |
| `POST /api/auth/logout` | Bearer token; revoke the current session's refresh token. |

Register/login/verify/refresh return `{ user, session }` inside `data`. When confirmation is required, registration returns `session: null`. Sessions contain `access_token`, `refresh_token`, `expires_in`, `expires_at`, and `token_type`. Keep token values out of URLs and logs; replace both tokens after refreshing. Clear the client session on logout. Existing access JWTs may remain valid until their expiry after logout; suspension is enforced from the database on protected operations.

The frontend stores only access/refresh tokens and expiry. Web Locks serialize refresh-token rotation across tabs; browsers without Web Locks use tab-scoped storage, and blocked storage falls back to memory. The app checks sessions every 30 seconds, refreshes when within 60 seconds of expiry, and revalidates the profile about once a minute or on restoration. Focus/online events also trigger checks when due. Rotated tokens are saved before profile loading so a transient profile failure does not discard the new refresh token. Temporary failures allow retry without deleting credentials; invalid sessions and unsupported/suspended profiles clear them. Stale requests cannot restore an account after logout. Browser role checks remain UX only: backend permissions and RLS apply to every protected operation.

For email signup and recovery links, configure Supabase's Site URL as your frontend origin and allow `/auth/callback` on that origin. Locally, allow both `http://localhost:5173/auth/callback` and `http://127.0.0.1:5173/auth/callback`. Registration, resend and recovery use the CORS-validated request origin (or the first configured origin for requests without an Origin header) to choose that callback. Arbitrary redirect URLs in request bodies are rejected.

The frontend handles Supabase's standard implicit-flow confirmation link, removes its tokens from the URL, validates the access token through `/api/auth/me`, then opens the account's dashboard. It also handles fallback redirects to the site root. For code-based signup confirmation, include `{{ .Token }}` in the Confirm signup email template; codes are verified by the backend, never compared against a browser-generated value.

Password recovery starts at `/forgot-password` with a generic response that does not confirm account existence. Keep `{{ .ConfirmationURL }}` in Supabase's Reset Password email template; optionally add `{{ .Token }}` for code entry. Recovery links (`type=recovery`) and verified recovery codes open a separate password form after checking the JWT through `/api/auth/me`. They do not establish a dashboard session. Password updates call `PUT /api/auth/password`, preserve the profile/role/history, then clear local state and attempt to revoke the recovery session before returning the user to login. Invalid/expired sessions require a fresh recovery email. No additional migration or privileged key is needed. CAPTCHA, MFA and OAuth UI flows remain unimplemented.

Example login from a connected frontend:

```js
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const payload = await response.json();
if (!response.ok) throw new Error(payload.error.message);
const { session } = payload.data;

const profileResponse = await fetch('/api/auth/me', {
  headers: { Authorization: `Bearer ${session.access_token}` },
});
const { data: profile } = await profileResponse.json();
// Route by profile.role; do not allow a role picker to grant privileges.
```

## Public content and member operations

| Method and path | Body / purpose |
| --- | --- |
| `GET /api/categories` | Active categories. |
| `GET /api/traces` | Approved, visible feed; optional `category_id`. |
| `GET /api/traces/:id` | Public Trace with category, author name and media metadata. |
| `GET /api/traces/:id/comments` | Visible comments on a public Trace. |
| `GET /api/tides` / `GET /api/tides/:id` | Published learning content. |
| `PATCH /api/profile` | Member: `display_name`. |
| `GET /api/contributions` / `GET /api/contributions/:id` | Member: own submissions, including drafts/rejected items. |
| `GET /api/contributions/:id/reviews` | Member: paginated review decisions and feedback for an owned Trace, newest first. |
| `POST /api/traces` | Member: create a draft. |
| `PUT /api/traces/:id` | Member: replace editable draft fields, including current `version`. |
| `POST /api/traces/:id/submit` | Member: `version`; submit a draft or requested revision. |
| `POST /api/traces/:id/comments` | Member: `body`; comment on a public Trace. |
| `POST /api/reports` | Member: `reason` and exactly one `trace_id` or `comment_id`. |
| `GET /api/reports` | Member: own reports. |
| `GET /api/notifications` | Member: own notifications. |
| `GET /api/notifications/unread-count` | Member: exact count of own unread notifications across all pages. |
| `POST /api/notifications/read` | Member: `ids` array, or explicit `ids: null` to mark all owned notifications read. |

Draft fields: `title`, `description`, `category_id`, `location_name`, optional paired `latitude`/`longitude` (numbers or both null). `PUT` requires all those fields plus `version`. Do not supply author IDs, statuses, timestamps or audit fields. The database supplies these. A rejected Trace is final; it cannot be edited or resubmitted.

## Evidence upload flow

1. Create a draft with `POST /api/traces`; retain its UUID.
2. `POST /api/traces/:id/media` with the file as the **raw request body**, its MIME type in `Content-Type`, and your Bearer token. Optional query parameter: `sort_order`. This uploads and attaches the evidence.
3. Reload `GET /api/contributions/:id` to obtain the latest `version` after attachment.
4. Submit with `POST /api/traces/:id/submit` and that version.

```js
await fetch(`/api/traces/${traceId}/media`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': file.type,
  },
  body: file,
});
```

JPEG, PNG, WebP and MP4 are accepted up to 20 MiB, with basic file-signature checks. At least one image is required before submission. Names are generated by the API under `<owner>/<trace>/<random-id>.<extension>` and are never overwritten. Signature checks are not virus scanning or full image/video decoding.

`GET /api/media/:id/url` returns a 60-second signed URL under the caller's visibility permissions. Public approved evidence is also available to visitors. `DELETE /api/media/:id` detaches owned evidence only while the Trace remains editable. Physical files are not deleted.

If Storage upload succeeds but attachment fails, `MEDIA_ATTACH_FAILED` includes `details.object_path`. Reload the draft, check if the media is already attached, then use `POST /api/traces/:id/media/attach` with `object_path` and optional `sort_order` if still appropriate. Upload and attachment cannot be one transaction. A trusted maintenance job should eventually remove orphaned/unreferenced files through the Storage API; that job is not implemented here.

## Moderation and administration

The existing database permits both moderators and admins to review content. Members cannot use these routes.

| Method and path | Body / purpose |
| --- | --- |
| `GET /api/moderation/traces` | Filter by `status` (default `pending`). Includes private review data. |
| `GET /api/moderation/traces/:id` | Staff: saved Trace detail with category, author and media; excludes hidden/deleted records. |
| `GET /api/moderation/traces/:id/reviews` | Staff: paginated previous review decisions and feedback for the visible Trace. |
| `POST /api/moderation/traces/:id/decision` | `version, decision, reason`; decision is `approved`, `rejected` or `revision_requested`. Non-approval needs feedback. |
| `GET /api/moderation/reports` | Filter by `status` (default `open`). Includes reported comment/Trace details. |
| `POST /api/moderation/reports/:id/resolve` | `remove_content` boolean and `reason`; hide content and resolve, or dismiss. |
| `GET /api/moderation/history` | Moderation audit history, including available Trace titles and reviewer display names. |
| `GET /api/admin/users` | Admin: current profiles, roles and statuses; no Auth credentials. |
| `PATCH /api/admin/users/:id` | Admin: `role, status, reason`; promote existing accounts or suspend/reactivate them. |
| `GET /api/admin/audit-logs` | Admin: account role/status audit trail. |
| `GET /api/admin/categories` | Admin: includes inactive categories. |
| `POST /api/admin/categories` / `PUT /api/admin/categories/:id` | Admin: `name`, optional `description, is_active`; deactivate rather than delete. |
| `GET /api/admin/tides` | Admin: includes drafts and archived learning content. |
| `GET /api/admin/tides/:id` | Admin-only lesson detail, including draft and archived content. |
| `POST /api/admin/tides` | Admin: `title, slug, body, status` (`draft`, `published`, `archived`). |
| `PUT /api/admin/tides/:id` | Same fields plus required `updated_at` from the last saved read. Atomic timestamp filtering rejects stale/missing records with 409 `STALE_VERSION`. |
| `GET /api/admin/settings` | Admin: settings. |
| `POST /api/admin/settings` | Admin: `key, value`; create configuration. |
| `PUT /api/admin/settings/:key` | Admin: `value`; update configuration. |

Settings are not a secrets store. Bootstrap the first admin through the supplied SQL; subsequent role changes use the audited API. Creating moderators means promoting registered accounts, not assigning a privileged role from registration input.

The existing schema does not persist lesson progress, barangay/profile preferences, avatar uploads, direct comment edits, deleted-account handling or granular moderator capabilities. Those demo features need additional schema and UI work.

## Testing and deployment notes

For the Vercel + Render setup using the existing Supabase project, follow
[DEPLOYMENT.md](../DEPLOYMENT.md). Set `TRUST_PROXY_HOPS=1` behind Render's
immediate reverse proxy and keep the default `0` for local direct connections.
Reassess and verify the hop count if the network topology changes.

```sh
npm test
npm run build
```

API tests exercise real HTTP routing with a mocked Supabase transport. They verify role checks, suspended accounts, session isolation, validation, public filters, workflow calls, stale writes, upload rules and errors without modifying a live project. The SQL checks under `supabase/tests` separately test actual PostgreSQL policies with Auth/Storage stubs. Neither test suite verifies hosted email delivery or real Storage uploads. Exercise signup, recovery, upload/attachment, submission and moderation against a disposable Supabase project before deployment.

The server defaults to loopback. Set `HOST` explicitly for your deployment and expose the API through HTTPS. `CLIENT_ORIGIN` accepts comma-separated exact frontend origins. Requests use Bearer tokens rather than cookies; tokens are not logged. API JSON bodies are limited to 256 KiB, with 15-second upstream timeouts.

Limits per IP: 300 API requests/minute, 30 authentication attempts/15 minutes, 120 session-maintenance requests (`/me`, `/refresh`, `/logout`)/15 minutes, and 20 uploads/15 minutes. Session maintenance has a separate budget so routine checks do not exhaust login/email attempts. Counters are in memory and reset on restart. Configure an external rate-limit store for multiple instances and explicit trusted proxy hops for your deployment; arbitrary `X-Forwarded-For` headers are not trusted. Supabase's direct endpoints also need their own Auth/Storage abuse controls because clients can contact them independently.

Implementation references: [Supabase Auth REST endpoints](https://github.com/supabase/auth#endpoints), [client initialization and session settings](https://supabase.com/docs/reference/javascript/initializing), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), [private Storage access](https://supabase.com/docs/guides/storage/serving/downloads).

### Tides integration verification

`npm run verify:tides` checks the configured project's published lesson reads and anonymous admin-route restrictions without writing records. Set an existing short-lived `TIDETRACE_VERIFY_ACCESS_TOKEN` only in the environment to additionally verify admin/non-admin reads. No new migration is required for the lesson editor: existing RLS, publication and `updated_at` triggers are used. Tides creation/update still uses the caller JWT, never a service-role key. Duplicate slugs return 409 `ALREADY_EXISTS`; publication requires non-empty content. Learning progress, lesson images and rich formatting are not implemented.
