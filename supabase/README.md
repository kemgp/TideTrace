# TideTrace Supabase setup

This is an initial schema for a **new Supabase project**, aligned with the supplied **Tide Trace_erd.png** and frontend inspection. It is not an upgrade migration for an existing database. Existing tables/types with the same names cause the transaction to fail rather than silently change them.

## Run the setup

1. Create/select your Supabase project. Open **SQL Editor → New query**.
2. Paste and run all of `migrations/20260921000100_initial_schema.sql` as the project database owner (`postgres`). Run it once. It includes its own transaction, tables, policies, functions, private Storage bucket, and six initial categories.
3. Create your personal account through Supabase Authentication or a real signup integration. The frontend currently uses demo authentication, so its existing registration form does not yet do this.
4. Open `bootstrap-first-admin.sql`, replace `REPLACE_WITH_YOUR_AUTH_USER_UUID` with your account ID from **Authentication → Users**, and run it as `postgres`. It refuses to bootstrap if an active admin already exists.
5. Configure Auth site URL, allowed redirect URLs, email confirmation and email delivery in the Supabase dashboard. SQL does not configure these or connect the frontend.
6. Run `tests/access-control.sql` in a separate freshly migrated disposable development project, before creating any real Auth users or bootstrapping an admin. The test refuses to run if Auth users already exist. It creates temporary test accounts/data within a transaction and ends with `ROLLBACK`. Successful execution means all assertions passed. If it errors, issue `ROLLBACK` before retrying. Do not run against production.

No password is stored in application tables. Supabase Auth manages credentials. No live Supabase project was modified by generating these files.

## Schema and scope

The ERD’s ten core tables: `profiles`, `categories`, `traces`, `trace_media`, `tides`, `comments`, `reports`, `moderation_actions`, `notifications`, and `settings`. `admin_audit_logs` is an additional table for role/status changes, separate from content moderation. Other additions are `traces.version` for stale-write protection; `profiles.updated_at`; category timestamps; and report resolution actor/reason fields. Coordinates use `numeric` as shown in the ERD. Moderation actions enforce exactly one target; resolving a report with content removal writes separate content and report actions. Notifications link through `action_id` and include `type`. `avatar_path` is reserved until avatar upload support is implemented.

- Roles: `user` (member), `moderator`, `admin`. Never accept role from signup metadata or localStorage.
- Account status: `active`, `suspended`. Suspended accounts retain access to published public content and their own `get_my_profile()` result, but lose protected reads and writes. This does not revoke their Auth session or ban Auth sign-in.
- Trace lifecycle: `draft → pending → approved / rejected / revision_requested`. Only drafts and revision-requested Traces are editable. Rejected Traces are final. Staff cannot review their own submission.
- Approval sets `published_at`; title, description, location, an active category and at least one uploaded image are required for submission. Coordinates are optional but must be a valid pair.
- Tides have explicit `draft/published/archived` status, independent of reading progress. Admins author and publish them.
- Every table has RLS. Workflow tables have no direct client write privileges; use the RPCs below. Profile edits are limited to `display_name`.
- The public profile projection is limited by column grants to `id, display_name`; use `.select('id, display_name')`, not `.select('*')`. Names are visible only for public contributors, yourself, or staff. Roles/status are available through `get_my_profile()` and `admin_list_profiles()`.
- Public feeds MUST filter `status = approved`, `is_hidden = false`, `deleted_at IS NULL`. RLS also allows owners/staff to read private submissions, so an unfiltered query is not a public-feed query. Filter Tides by `status = published` similarly.
- `settings` is admin-only configuration, **not a secrets store**.
- Learning progress, granular moderator capabilities, profile preferences, avatar uploads, direct comment editing/deletion, content restoration and account deletion/anonymization are deferred. Auth account deletion is restricted by profile references to preserve attribution/audit history. Design a retention workflow before offering deletion.

## Frontend contract

Use a browser-safe publishable key and the signed-in Supabase session. Privileged/secret keys never belong in React. The callable `SECURITY DEFINER` functions below are narrowly scoped and check the caller themselves; there is no unrestricted role-edit endpoint. Database functions use an empty `search_path` and explicit execution grants. Keep the `private` schema out of the Data API's exposed schemas.

| RPC | Purpose |
|---|---|
| `get_my_profile()` | Return current account's profile, role and status (set-returning result). |
| `admin_list_profiles()` | Admin-only account list, without Auth email/password data. |
| `admin_set_account(p_user_id, p_role, p_status, p_reason)` | Change an existing account's role/status; audit it; prevent removing the last active admin. |
| `save_trace_draft(p_id, p_version, p_title, p_description, p_category_id, p_location_name, p_latitude, p_longitude)` | Pass null ID/version to create; current ID/version to edit. |
| `attach_trace_media(p_trace_id, p_object_path, p_sort_order)` | Register an uploaded object; MIME/size come from Storage metadata. |
| `detach_trace_media(p_media_id)` | Remove an editable Trace's media association. |
| `submit_trace(p_id, p_version)` | Validate and submit/resubmit an owned Trace. |
| `moderate_trace(p_id, p_version, p_decision, p_reason)` | Staff decision, audit record, and notification in one transaction. |
| `resolve_report(p_id, p_remove_content, p_reason)` | Hide reported content and resolve, or dismiss; log and notify. |
| `mark_notifications_read(p_ids)` | Mark owned notifications read; null marks all owned unread notifications. |

Example from a signed-in admin:

```js
const { error } = await supabase.rpc('admin_set_account', {
  p_user_id: selectedUser.id,
  p_role: 'moderator',
  p_status: 'active',
  p_reason: 'Assigned to the coastal observation review team',
});
```

All new accounts start as active members even if signup metadata contains a role. Account permissions read current database state on each request; a later request does not keep staff rights from an old JWT. The UI should refetch the profile after a role change. Database-owner/service access can bypass policies and must remain trusted.

For basic operations, use direct queries with these writable columns:

- Own profile: update `display_name`.
- Categories (admin): insert/update `name, description, is_active`; deactivate rather than delete.
- Tides (admin): insert/update `title, slug, body, status`.
- Comments: insert `trace_id, body` on an approved visible Trace.
- Reports: insert `reason` and exactly one of `trace_id, comment_id` for visible public content.
- Settings (admin): insert `key, value`; update `value`.

Do not send author/reporter IDs, workflow status, or audit fields for member inserts; the database supplies them. Refresh a Trace after attaching/detaching media to obtain its new `version`. A stale version raises SQLSTATE `40001`; reload before retrying. Do not blindly retry moderation decisions.

## Private evidence storage

Upload to bucket `trace-media` with a unique path:

```text
<authenticated-user-uuid>/<trace-uuid>/<random-uuid>.jpg
```

Select a category and create/save the draft first, then upload using `upsert: false`, call `attach_trace_media`, fetch the latest Trace version, and call `submit_trace`. At least one image is required to submit; video alone is insufficient. Supported types are JPEG, PNG, WebP and MP4, up to 20 MiB per file. File scanning/content validation and rate/quota limits need a separate ingestion layer before broad public deployment.

There are intentionally no client Storage overwrite/delete policies. This keeps submitted evidence immutable and avoids deleting a file during submission. Detach removes its association; a trusted maintenance job should delete old unreferenced files using the **Storage API**, never by deleting `storage.objects` rows directly. Failed/unattached uploads also need eventual cleanup. That maintenance job is not part of this SQL setup.

Use authenticated downloads or short-lived signed URLs. The bucket stays private, but approved visible evidence can be read by visitors under its SELECT policy. Previously issued signed URLs can remain valid until expiry after content is hidden; keep expiry short. Unattached files cannot be downloaded through these policies; use local browser previews while uploading.

## Validation and references

`tests/access-control.sql` covers account defaults, escalation attempts, ownership, evidence registration, submission/revision/approval, stale decisions, public visibility, reporting, notifications, suspension and last-admin protection. The local test harness uses PostgreSQL via PGlite with minimal Auth/Storage schema stubs, so it does not validate the hosted Auth service, Storage API, email delivery, signed URLs or HTTP upload behavior. Repeat the SQL checks in a development Supabase project and exercise real uploads before connecting production clients.

Implementation references:
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Database functions and execution permissions](https://supabase.com/docs/guides/database/functions)
- [Auth profile provisioning](https://supabase.com/docs/guides/auth/managing-user-data)
- [Storage ownership](https://supabase.com/docs/guides/storage/security/ownership)

Run the local PostgreSQL checks without changing frontend dependencies:

```sh
npm install --prefix /tmp/tidetrace-sql-check --no-audit --no-fund @electric-sql/pglite@0.5.8
node supabase/tests/local-check.mjs /tmp/tidetrace-sql-check/node_modules/@electric-sql/pglite/dist/index.js
```

The harness also checks that first-admin bootstrap works once and rejects a repeat. This is single-session validation; concurrent requests and real Supabase service integration still need staging verification.
