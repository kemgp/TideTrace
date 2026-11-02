# Phase 2 Implementation Plan: Trace Detail Continuity

Branch: `trace-detail-phase-2`. One branch, one PR into `main`. Do not touch files not listed here. Do not add co-author trailers to commits (CLAUDE.md).

## Scope

- Delete own comment
- Newer / Older trace navigation
- Related traces
- Archive search, category and page stored in the URL, and "Back to Traces" restores them

## File Structure

New files:
- `supabase/migrations/20261103000100_trace_phase_two.sql`
- `supabase/tests/trace-phase-two.sql`
- `client/src/api/archiveParams.js`
- `client/src/components/DeleteComment.jsx`
- `client/src/components/TraceNeighbors.jsx`
- `client/src/components/RelatedTraces.jsx`
- `client/test/archiveParams.test.js`
- `client/test/deleteComment.test.jsx`
- `client/test/traceNeighbors.test.jsx`
- `client/test/relatedTraces.test.jsx`
- `client/test/archiveUrlState.test.jsx`

Modified files:
- `server/src/routes/content.js`
- `server/test/api.test.js`
- `client/src/components/TraceComments.jsx`
- `client/src/components/LiveTraceDetail.jsx`
- `client/src/components/TraceCard.jsx`
- `client/src/pages/user/traces/ViewTraces.jsx`
- `client/src/components/trace-detail.css`
- `client/src/index.css`
- `handoff.md`

Fixed decisions (do not change):
- Comment deletion sets `comments.status` to `deleted` (enum value already exists). Never hard-delete rows.
- "Newer" and "Older" follow the public feed order: `published_at` descending, then `id` ascending. Newer is the row before the current trace; Older is the row after it.
- Neighbors ignore the archive search and category filters.
- Related traces: same `category_id`, public only, excluding the current trace, newest first, maximum 3.
- Archive URL parameters: `q` (string), `category` (uuid), `page` (integer, 1-based), `view` (`list` or `map`). Omit a parameter when it equals its default.
- Toasts follow CLAUDE.md: success and info as toasts, errors from a submitted form inline with `role="alert"`, no always-mounted `role="status"` or `role="alert"` regions.

## Task 0: Branch

- [ ] Run `git switch main` and `git pull origin main`.
- [ ] Run `git switch -c trace-detail-phase-2`.
- [ ] Confirm `git status` is clean.

## Task 1: Migration `supabase/migrations/20261103000100_trace_phase_two.sql`

- [ ] Wrap the whole file in `begin;` and `commit;`.
- [ ] Define `public.delete_own_comment(p_comment_id uuid) returns void`, `language plpgsql`, `security definer`, `set search_path=''`.
- [ ] In `delete_own_comment`, raise errcode `42501` with message `Active account required` when `private.current_role()` is null.
- [ ] In `delete_own_comment`, select the comment `for update` where `id = p_comment_id`, `author_id = auth.uid()`, `status = 'visible'`, and its trace has `deleted_at is null`.
- [ ] In `delete_own_comment`, raise errcode `PT404` with message `Record not found.` when no row matches (covers: not found, someone else's comment, already deleted, hidden by a moderator, trace deleted).
- [ ] In `delete_own_comment`, set `status = 'deleted'` and `updated_at = now()` on the matched comment.
- [ ] In `delete_own_comment`, resolve open reports on that comment: `status = 'resolved'`, `resolution_reason = 'comment deleted'`, `resolved_at = now()`, `resolved_by = null`.
- [ ] Revoke execute on `delete_own_comment` from `public` and `anon`; grant execute to `authenticated`.
- [ ] Define `public.trace_neighbors(p_trace_id uuid) returns table(direction text, id uuid, title text)`, `language sql`, `stable`, `security definer`, `set search_path=''`.
- [ ] In `trace_neighbors`, return zero rows when the trace is not public (status `approved`, `is_hidden = false`, `deleted_at is null`, `published_at is not null`).
- [ ] In `trace_neighbors`, return at most one row with `direction = 'newer'` (the closest public trace ordered before the current one) and at most one with `direction = 'older'` (the closest after), using order `published_at desc, id asc`.
- [ ] Grant execute on `trace_neighbors` to `anon` and `authenticated`; revoke from `public`.
- [ ] Add a comment above each function stating who may call it.

## Task 2: Database test `supabase/tests/trace-phase-two.sql`

- [ ] Follow the structure of `supabase/tests/delete-own-trace.sql`: `begin;`, a helper schema with `check(ok boolean)` and `denied(statement text, code text)`, fixtures, `rollback;`.
- [ ] Create fixtures: an owner, another member, a moderator, one approved trace with three comments (owner's, other's, a moderator-hidden one of the owner's), and five approved traces in one category with distinct `published_at` plus one in another category.
- [ ] Assert the owner can call `delete_own_comment` on their visible comment and the row becomes `deleted`.
- [ ] Assert an open report on that comment becomes `resolved` with reason `comment deleted`.
- [ ] Assert calling `delete_own_comment` again on the same comment fails with `PT404`.
- [ ] Assert another member calling it on the owner's comment fails with `PT404`.
- [ ] Assert the owner calling it on their moderator-hidden comment fails with `PT404` and the status stays `hidden`.
- [ ] Assert calling it on a comment of a deleted trace fails with `PT404`.
- [ ] Assert an anonymous caller is denied.
- [ ] Assert `trace_neighbors` on the middle trace returns exactly one `newer` and one `older` row with correct ids.
- [ ] Assert `trace_neighbors` on the newest trace returns only `older`, and on the oldest only `newer`.
- [ ] Assert `trace_neighbors` skips hidden, deleted and non-approved traces.
- [ ] Assert `trace_neighbors` on a non-public trace id returns zero rows.
- [ ] Assert `trace_neighbors` on an unknown uuid returns zero rows.

## Task 3: Server `server/src/routes/content.js`

Add routes inside `contentRoutes`, next to the existing comment routes. Use existing helpers `uuid`, `result`, `first`, `HttpError`, `withAuthorPhotos`, `publicTraces`, `traceSelect`.

- [ ] Add `router.delete("/comments/:id", member, handler)`.
- [ ] Handler `deleteComment(req, res)`: parse `req.params.id` with `uuid.parse`; call `result(req.db.rpc("delete_own_comment", { p_comment_id: id }))`; respond `res.sendStatus(204)`.
- [ ] Confirm `PT404` from the RPC already maps to HTTP 404 through `upstreamError`; if it does not, map it exactly as `deleteTrace` does.
- [ ] Invalid uuid must return 400, missing or invalid token 401, inactive account 403 (existing behaviour, verify only).
- [ ] Add `router.get("/traces/:id/neighbors", handler)` with no `member` guard (public like trace detail).
- [ ] Handler `getNeighbors(req, res)`: parse uuid; call `first(await result(publicTraces(req.db).eq("id", id).limit(1)))` first so a non-public trace returns 404; then call `result(req.db.rpc("trace_neighbors", { p_trace_id: id }))`.
- [ ] `getNeighbors` returns `{ data: { newer: { id, title } | null, older: { id, title } | null } }` with status 200.
- [ ] Add `router.get("/traces/:id/related", handler)` with no `member` guard.
- [ ] Handler `getRelated(req, res)`: parse uuid; load the public trace with `first(...)` (404 if missing); read its `category_id`; query `publicTraces(req.db).eq("category_id", categoryId).neq("id", id).order("published_at", { ascending: false }).order("id").limit(3)`; pass rows through `withAuthorPhotos`.
- [ ] `getRelated` returns `{ data: Trace[] }` (empty array when none) with status 200; never include the current trace.
- [ ] `getRelated` must not leak location: confirm `traceSelect` rows are shaped exactly like `GET /traces` rows (same sensitive-location handling).
- [ ] Register `/traces/:id/neighbors` and `/traces/:id/related` so they do not collide with `/traces/:id` or `/traces/map` ordering.

## Task 4: Server tests `server/test/api.test.js`

- [ ] Add test: `DELETE /api/comments/:id` returns 204 and calls rpc `delete_own_comment` with `{ p_comment_id }`.
- [ ] Add test: `DELETE /api/comments/not-a-uuid` returns 400.
- [ ] Add test: `DELETE /api/comments/:id` without a token returns 401.
- [ ] Add test: rpc error code `PT404` returns 404 with the standard error body.
- [ ] Add test: `GET /api/traces/:id/neighbors` returns `{ newer, older }` mapped from rpc rows, with `null` for a missing direction.
- [ ] Add test: neighbors returns 404 for a non-public trace and does not call the rpc.
- [ ] Add test: neighbors returns 400 for an invalid uuid.
- [ ] Add test: `GET /api/traces/:id/related` returns at most 3 rows, filters by the trace's `category_id`, excludes the trace id, and orders newest first.
- [ ] Add test: related returns `[]` with status 200 when the category has no other public traces.
- [ ] Add test: related returns 404 for a non-public trace.
- [ ] Run `(cd server && npm test)`; all tests pass.

## Task 5: `client/src/api/archiveParams.js`

- [ ] Export `ARCHIVE_DEFAULTS` = `{ query: "", category: "All", page: 1, view: "list" }`.
- [ ] Export `readArchiveParams(searchParams: URLSearchParams): { query: string, category: string, page: number, view: "list" | "map" }`.
- [ ] `readArchiveParams`: trim `q` and cap at 200 characters; empty becomes `""`.
- [ ] `readArchiveParams`: accept `category` only if it matches the uuid pattern, otherwise `"All"`.
- [ ] `readArchiveParams`: parse `page` with `Number.parseInt`; non-integer, zero, negative or above 10000 becomes `1`.
- [ ] `readArchiveParams`: accept `view` only when `"map"`, otherwise `"list"`.
- [ ] Export `writeArchiveParams(state: { query, category, page, view }): URLSearchParams`.
- [ ] `writeArchiveParams`: omit `q` when blank after trim, `category` when `"All"`, `page` when `1`, `view` when `"list"`.
- [ ] Export `archiveSearch(state): string` returning `""` or a string starting with `?`.
- [ ] Export `safeArchiveSearch(value: unknown): string` returning `value` only when it is a string starting with `?` and `readArchiveParams` round-trips it, otherwise `""`.
- [ ] Export `pageToOffset(page: number, size: number): number` returning `(page - 1) * size`, and `offsetToPage(offset: number, size: number): number` returning `Math.floor(offset / size) + 1`.

## Task 6: `client/test/archiveParams.test.js`

- [ ] Test defaults for an empty `URLSearchParams`.
- [ ] Test invalid `page` values (`0`, `-2`, `abc`, `1.5`, `99999`) all become `1`.
- [ ] Test invalid `category` becomes `"All"`.
- [ ] Test `q` is trimmed and truncated at 200 characters.
- [ ] Test `writeArchiveParams` omits every default value.
- [ ] Test round trip: `readArchiveParams(writeArchiveParams(state))` equals `state`.
- [ ] Test `safeArchiveSearch` rejects `undefined`, a full URL, and a string without a leading `?`.
- [ ] Test `pageToOffset` and `offsetToPage` are inverse for page sizes of 6.

## Task 7: `client/src/components/DeleteComment.jsx`

- [ ] Default export `DeleteComment({ comment, onDeleted })`; `comment: { id: string, author_id: string }`; `onDeleted: (id: string) => void`; returns a React element or `null`.
- [ ] Return `null` when `profile?.id` is missing or `comment.author_id !== profile.id`.
- [ ] Render a trigger `<button type="button" className="btn ghost sm comment-delete">` with visible text `Delete` and `aria-label="Delete comment"` and `aria-haspopup="dialog"`.
- [ ] Internal function component `DeleteCommentDialog({ comment, onCancel, onDeleted })` rendering `<dialog className="leave-dialog">` with `aria-labelledby` and `aria-describedby`.
- [ ] Dialog content: heading `Delete this comment?`, text `This can't be undone.`, buttons `Cancel` and `Delete` (danger variant, `loading` while busy).
- [ ] Open with `showModal()` in `useLayoutEffect`; close in cleanup; capture the trigger as the initiator and restore focus to it if still connected.
- [ ] Initial focus on `Cancel`.
- [ ] `onCancel` event handler: `preventDefault()`, ignore while busy, otherwise call the cancel callback. Do not wire the native `close` event to state (StrictMode).
- [ ] Function `remove()`: guard against double submit with an `AbortController` ref; call `writeData("comments/" + encodeURIComponent(comment.id), { method: "DELETE", signal })`.
- [ ] On success: call `onDeleted(comment.id)` and `toast.success("Comment deleted.")`.
- [ ] On HTTP 404: call `onDeleted(comment.id)` and `toast.info("This comment no longer exists.")`.
- [ ] On aborted request or `failure.code === "CANCELLED"`: return silently.
- [ ] On any other failure: keep the dialog open, show `failure.message` in `<p role="alert">` inside the dialog, re-enable buttons.
- [ ] Abort any pending request on unmount.

## Task 8: `client/src/components/TraceComments.jsx`

- [ ] Import `DeleteComment`.
- [ ] Add function `removeComment(id: string): void` that removes the comment from every page in `pages` state (map each page array through `filter`).
- [ ] Render `<DeleteComment comment={comment} onDeleted={removeComment} />` in each comment's body only for the member's own comments (the component enforces this).
- [ ] After a deletion, move focus to the comments `<h3>` (add `tabIndex={-1}` and a ref); do this in `removeComment`.
- [ ] After a deletion, if the removed comment leaves the loaded count below one full page and `hasMore` was true, keep "Show more comments" working (offset stays; do not refetch).
- [ ] When the last remaining comment is removed, show the existing empty state.
- [ ] Do not change the comment counter text beyond using the new `comments.length`.

## Task 9: `client/test/deleteComment.test.jsx`

- [ ] Follow the setup pattern of `client/test/traceDetailActions.test.jsx` (StrictMode, stubbed `fetch`, jsdom `HTMLDialogElement` stubs).
- [ ] Test: own comment shows a `Delete comment` button; another member's comment does not.
- [ ] Test: clicking opens the dialog `Delete this comment?`; Cancel closes it and sends no DELETE request.
- [ ] Test: Escape closes it with no request and focus returns to the trigger.
- [ ] Test: confirming sends exactly one `DELETE /api/comments/:id`, removes the comment from the thread, shows exactly one `Comment deleted.` toast.
- [ ] Test: double-clicking Delete sends one request.
- [ ] Test: a 404 response removes the comment and shows `This comment no longer exists.`
- [ ] Test: a 502 response keeps the dialog open with an inline `role="alert"` message and the comment stays.
- [ ] Test: after deletion, focus is on the Comments heading.
- [ ] Test: deleting the only comment shows the empty state.

## Task 10: `client/src/components/TraceNeighbors.jsx`

- [ ] Default export `TraceNeighbors({ traceId, archiveSearch })`; `traceId: string`; `archiveSearch: string` (already passed through `safeArchiveSearch`); returns a React element or `null`.
- [ ] Fetch with `useRemoteData("traces/" + encodeURIComponent(traceId) + "/neighbors")`.
- [ ] While loading or on error: render `null` (this block is optional content; never block the page or show an error panel).
- [ ] When both `newer` and `older` are null: render `null`.
- [ ] Render `<nav aria-label="More traces">` with up to two `Link`s to `/user/traces/{id}`, passing `state={{ archiveSearch }}`.
- [ ] Link labels: visible text `Newer trace` and `Older trace` as a small label, with the neighbor's title below it (truncated with CSS, full title in `title` attribute).
- [ ] Keep the older link on the right and the newer on the left; when only one exists it keeps its side.
- [ ] Use a key of `traceId` where the component is mounted so state resets on navigation between traces.

## Task 11: `client/src/components/RelatedTraces.jsx`

- [ ] Default export `RelatedTraces({ traceId, archiveSearch })`; returns a React element or `null`.
- [ ] Fetch with `useRemoteData("traces/" + encodeURIComponent(traceId) + "/related", { collection: true })`.
- [ ] While loading, render a section with the heading and three skeleton cards using the existing skeleton classes (no layout jump).
- [ ] On error or empty array: render `null`.
- [ ] On data: render `<section aria-labelledby>` with `<h3>` text `More from this category`, and `TraceCard` for each of up to 3 traces via `displayTrace`, linking to `/user/traces/{id}` with `linkState={{ archiveSearch }}`.
- [ ] Never render the current trace.

## Task 12: `client/src/components/TraceCard.jsx`

- [ ] Add optional prop `linkState?: object` and pass it to the existing `Link` as `state`.
- [ ] Do not change any other prop, class or output.

## Task 13: `client/src/components/LiveTraceDetail.jsx`

- [ ] Import `useLocation`, `safeArchiveSearch`, `TraceNeighbors`, `RelatedTraces`.
- [ ] In `LiveTraceDetail`, compute `archiveSearch = safeArchiveSearch(useLocation().state?.archiveSearch)`.
- [ ] Change the Back link target from `/user/traces` to `` `/user/traces${archiveSearch}` `` for the public view only; the contribution view keeps `/user/contributions`.
- [ ] Pass `archiveSearch` down to `TraceContent` as a prop.
- [ ] In the public layout, render `<TraceNeighbors key={current.id} traceId={current.id} archiveSearch={archiveSearch} />` after `TraceComments` in the main column.
- [ ] In the public layout, render `<RelatedTraces key={current.id} traceId={current.id} archiveSearch={archiveSearch} />` below the two-column layout, full width.
- [ ] Do not render either component in the contribution view.
- [ ] When the visitor lands on a trace with no router state (direct link), the Back link goes to plain `/user/traces`.

## Task 14: `client/src/pages/user/traces/ViewTraces.jsx`

- [ ] Replace local `useState` for `query`, `cat`, `offset`, `view` with `useSearchParams` from `react-router-dom` and `readArchiveParams`.
- [ ] Derive `offset = pageToOffset(page, PAGE_SIZE)`; keep the existing request path format unchanged.
- [ ] Function `update(next: Partial<state>, { replace }: { replace?: boolean })`: merge into current state, reset `page` to 1 whenever `query` or `category` changes, write with `writeArchiveParams`, call `setSearchParams(params, { replace })`.
- [ ] Typing in the search box uses `replace: true` so each keystroke does not add a history entry; category, view and page changes push entries.
- [ ] Keep the search input controlled with local draft state initialised from the URL, and sync the draft when the URL changes through browser back/forward.
- [ ] `clearFilters` clears `q` and `category` and sets `page` to 1.
- [ ] `Pagination.onChange` receives an offset; convert with `offsetToPage` before calling `update`.
- [ ] If the URL `category` is a uuid that is not in the loaded categories, treat it as `"All"` for display and do not send it.
- [ ] If the URL `page` is beyond the last page (empty result with `page > 1`), call `update({ page: 1 }, { replace: true })`.
- [ ] Pass `linkState={{ archiveSearch: archiveSearch(state) }}` to every `TraceCard`.
- [ ] Pass the URL-derived `query` and `category` to `CommunityMap` as before.

## Task 15: `client/test/archiveUrlState.test.jsx`

- [ ] Test: opening `/user/traces?q=reef&category=<uuid>&page=2&view=list` requests `traces?limit=6&offset=6&q=reef&category_id=<uuid>`.
- [ ] Test: typing in search updates the URL `q` and resets `page`.
- [ ] Test: choosing a category updates the URL and resets `page`.
- [ ] Test: clicking Next page updates the URL to `page=2`.
- [ ] Test: invalid URL values (`page=abc`, `category=zzz`) fall back to defaults without a crash.
- [ ] Test: opening a trace from page 2 and clicking `Back to Traces` returns to the same `?page=2` URL.
- [ ] Test: opening a trace with no router state and clicking Back goes to `/user/traces`.
- [ ] Test: `Clear filters` removes `q` and `category` from the URL.

## Task 16: `client/test/traceNeighbors.test.jsx` and `client/test/relatedTraces.test.jsx`

- [ ] Neighbors test: both links render with correct hrefs and titles.
- [ ] Neighbors test: only `older` present renders one link and no `Newer trace`.
- [ ] Neighbors test: both null renders no `More traces` navigation.
- [ ] Neighbors test: a 500 response renders nothing and the page still works.
- [ ] Neighbors test: following a link changes the trace and refetches neighbors for the new id.
- [ ] Related test: renders up to 3 cards under `More from this category`.
- [ ] Related test: empty array renders no section.
- [ ] Related test: error renders no section and no alert.
- [ ] Related test: cards link to `/user/traces/{id}` and never include the current trace.

## Task 17: Styles `client/src/components/trace-detail.css` and `client/src/index.css`

- [ ] Add `.comment-delete`: ghost button, danger text colour using `--danger`, minimum height 44px inside `.app-shell`, prefixed with `.app-shell` to beat the responsive button rule.
- [ ] Add `.trace-neighbors`: two-column grid with `gap: 12px`, one column below 540px.
- [ ] Add `.trace-neighbors__link`: bordered card using `--line`, `--r-md`, padding 12px, label in muted small caps, title truncated to one line with ellipsis, hover and `:focus-visible` states (3px focus ring), minimum height 56px.
- [ ] Add `.trace-related`: full-width section with heading margin and a three-column grid (`repeat(auto-fill, minmax(240px, 1fr))`).
- [ ] Add dark-mode counterparts in `client/src/index.css` using `--d-surface`, `--d-border`, `--d-text`, `--d-muted` and the existing danger dark colours.
- [ ] Verify no horizontal scroll at 320px width.

## Task 18: Documentation `handoff.md`

- [ ] Append a section `Trace detail phase 2` listing the migration filename, the three new routes, the new components, the URL parameter contract, and the manual check list.
- [ ] Note that the migration must be applied to Supabase before deploying.

## Task 19: Verification

- [ ] Run `(cd server && npm test)`; all pass.
- [ ] Run `(cd client && npm test)`; all pass.
- [ ] Run `psql -f supabase/tests/trace-phase-two.sql` against a disposable database; no assertion failures.
- [ ] Manual: delete own comment (dialog, toast, focus, removal), try with network off (inline error).
- [ ] Manual: Newer/Older links on newest, middle and oldest traces.
- [ ] Manual: related traces on a category with 0, 1 and 4+ other traces.
- [ ] Manual: archive page 2 + filter, open a trace, Back restores the exact state; browser Back/Forward also work; reload keeps state.
- [ ] Manual: light and dark mode, 320px and desktop widths, keyboard-only pass.
- [ ] Commit with a message that has no co-author trailer, push, open one PR, merge, then `git switch main` and `git pull origin main`.
