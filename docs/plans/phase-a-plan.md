# Phase A plan: Tide Energy, quizzes, moderator flags, admin investigations

Status: for review. Planning only; no application code, migrations or dependencies have been changed.
Written 9 Nov 2026 against `staging` at `4252a71`. Follows `00-shared-context.md` and `phase-a-energy-brief.md`.

Companion artifacts:
- Design system: https://claude.ai/artifact/KsxeXYSUEuZ8e6YeDvGNPH (tokens, components, Phase A patterns, decided rules).
- Clickable mockups (desktop and mobile, light and dark): https://claude.ai/artifact/XEkyRXiy48EFiV1EZvqC59.

---

## 1. Summary

Tide Energy is a personal, append-only ledger of awards. A member earns 20 the first time a Trace is approved, 5 the first time they complete a Tide, and 15 the first time they pass that Tide's quiz. Admins write a five-question quiz inside the existing Tide editor; the server grades it and never reveals the key. Moderators can flag an issued Trace award; admins investigate, dismiss or reverse, and can reverse any award. Everything ships behind client and server flags that default to off, and no award is issued until an admin activates energy.

### What the code says (verified)

- **Trace approval** happens only in `public.moderate_trace` (latest in `20261107000100_moderator_workflow.sql`). It locks the Trace row (`for update`), rejects self-review (`42501`) and non-admin decisions on held Traces, checks the version, writes `moderation_actions`, writes one `trace_review` notification, deletes any hold and sets `status`. Only `pending` Traces can be decided, and nothing moves an approved Trace back to `pending`, so a Trace is approved at most once. This is where the Trace award goes, in the same transaction.
- **Tide completion is self-asserted.** `tide_completions` grants `insert(user_id,tide_id)` to `authenticated` with a policy that only checks the owner and that the Tide is published. `PUT /api/tides/:id/completion` inserts through the member's own Supabase client, and a member can insert the same row directly. There is no proof of reading; `tide_progress` is also client-saved.
- **The server never bypasses row-level security.** `server/src/supabase.js` creates a per-request client with the caller's token and a publishable key; `config.js` refuses service-role keys. Every award therefore has to be issued by a `security definer` database function or trigger, which also makes direct Supabase calls safe.
- **Tides cannot be deleted** (no delete grant). They move between `draft`, `published` and `archived`. Children of `tides` use `on delete cascade`.
- **Settings** is a key/value table writable by admins (`settings_insert`, `settings_update`), with a validation trigger that only checks the `workflow` key and an audit row in `admin_audit_logs`. The generic `POST/PUT /api/admin/settings` can write any key, so the new `energy` key needs its own validation.
- **Notifications** have a free-text `type`, an optional `action_id`, and can only be inserted by definer functions (members cannot forge them; `access-control.sql` tests this). `private.filter_optional_notification` drops `trace_review`, `trace_comment` and `new_tide` for members who turned them off.
- **The admin "Needs you" counts** come from `public.get_dashboard_summary` (`20261108000100_admin_needs_you.sql`).
- **Accounts are never deleted**; `admin_set_account` suspends them, and `private.current_role()` returns null for non-active accounts.
- **SQL tests** (`supabase/tests/*.sql`) run in one rolled-back transaction against a disposable database, switching identity with `request.jwt.claim.sub`, using `tidetrace_test.assert_ok` and `tidetrace_test.reject`. `local-check.mjs` replays all migrations on PGlite. Relevant existing files: `access-control.sql` (roles, notifications, settings), `moderator-workflow.sql` (holds, self-review, resolve), `tide-lessons.sql`, `tide-progress.sql`.

### Confirmed decisions (from the shared context and this session)

1. Energy is individual, earned once per source, never transferable or purchasable, with no cash value.
2. Amounts: Trace first approval 20, Tide completion 5, first quiz pass 15.
3. Quiz: exactly 5 questions, 4 options, 1 correct, an explanation each; pass with 4 correct; 30-second server cooldown; unlimited retries; only the first pass earns; a failed attempt shows only "Not passed yet."; explanations only after a pass.
4. Completion becomes trustworthy only as far as "the member said so": it moves to one server-side database function that also issues the award, and direct inserts close. Accepted risk: at most 5 energy per published Tide without reading it.
5. Flag outcomes: the flagging moderator is always notified; the member is notified only when an award is reversed. A dismissed flag is never revealed to the member.
6. Moderators see the Trace author's name in their decisions and flag outcomes (they already see it when reviewing).
7. No separate award notifications. When an approval issues an award, the existing approval notification says so ("Your Trace "Reef survey": approved. You earned 20 Tide Energy."). Completion and quiz awards confirm on screen. Reversals notify the member.
8. Unpublishing a Tide hides its quiz; earned energy stays; republishing restores the quiz and earlier passes still count.
9. An admin turns energy on and off in Settings (Activate, Pause), audited. `energy_activated_at` doubles as the kill switch.
10. Members reach energy through the balance pill in the nav and the dashboard card. The member nav keeps four links.
11. Design rules (9 Nov): one `h1` per page, "New Trace" always clay, one clay per screen (landing page exempt), dates as "24 Oct 2026", form fields use `--field-line`.

### Defaults (proposed, not confirmed)

- Moderators can flag any issued Trace award, not only Traces they reviewed; entry points are My decisions and the staff Trace detail.
- A reversed award's source can never earn again (unique constraint survives reversal), and reversals are final (no undo), as the shared context says.
- Pausing and re-activating sets a new activation time; events while paused never earn (no backfill).
- Award history is visible only to its owner and admins.

---

## 2. Permission matrix (Phase A only)

| Capability | Member | Moderator | Admin |
| --- | --- | --- | --- |
| Earn energy from own approved Traces, completions, first quiz pass | Yes | Yes, from own member activity | Yes, from own member activity |
| Earn from reviewing, previewing or administering | No | No | No (admin quiz preview earns nothing) |
| See own balance and history | Yes | Yes | Yes |
| See another member's balance or history | No | No | Yes (Energy activity, case pages) |
| Take a quiz | After completing the Tide | Same as member | Same as member |
| Read questions before completing, or the answer key ever | No | No | Key only in the editor (admin) |
| Author, edit, publish, unpublish quizzes | No | No | Yes |
| See award status of a reviewed Trace | No | Yes | Yes |
| Flag an issued Trace award, with a reason | No | Yes | Yes |
| See own flags and their outcome | No | Yes | Yes (all flags) |
| Dismiss a flag | No | No | Yes, with a reason |
| Reverse an award of any type | No | No | Yes, with a reason, once |
| Grant, deduct, edit a balance, edit rates | No | No | No (no such feature) |
| Activate or pause energy | No | No | Yes (Settings) |
| Browse disabled reward previews | Yes | Yes | Yes |
| Redeem anything | No | No | No |

Self-review stays as it is: `moderate_trace` rejects a staff member deciding their own Trace, so nobody can approve their own award. Holds stay: only an admin can decide a held Trace, and the award follows the approval.

---

## 3. Workflows

### Member

1. **Approved Trace.** A moderator approves; if energy is active and this Trace never earned, the ledger gains +20 and the approval notification ends with "You earned 20 Tide Energy." The balance pill updates on the next load.
2. **Complete a Tide.** On the last chapter, "Mark as complete" calls the completion endpoint. The button becomes "Completed. You earned 5 Tide Energy." (or "Completed" when nothing was earned: before activation, or energy paused).
3. **Quiz.** A quiz card offers "Start quiz" (only after completion, only if the Tide's quiz is published). Five fieldsets, four radios each; submit stays disabled until all are answered. Fail: "Not passed yet. Read the lesson again if you need to, then try again.", answers clear, the button counts down 30 seconds. Pass: "Quiz passed. You earned 15 Tide Energy." (amount only on the first pass), then "Why these answers" with every explanation. If the quiz changed while open: "This quiz was updated. Reload to see the new questions."
4. **Energy page** (`/user/energy`, reached from the pill and the dashboard card): balance, how energy is earned, reward previews, and history filtered by Traces, Tides, Quizzes. A reversed award stays struck through with a "Reversed" badge; the reversal is its own negative row with the admin's reason.
5. **Reversal notice.** "An admin reversed 20 Tide Energy for your Trace "Reef survey". Reason: …"

### Moderator

1. On **My decisions**, approved rows show "Award issued: 20 Tide Energy" (or "No award yet" / "No award: before activation"). "Flag award" opens a dialog: "Why should an admin look?" (required), "Send flag". The row then shows "Flag open"; later "Flag dismissed" or "Flag resolved" with the admin's reason. One open flag per award.
2. The same flag action is on the staff Trace detail for an approved Trace, including Traces the author deleted ("Deleted by the author.").
3. Notification when an admin decides: "Your flag on "Reef survey" was reviewed: award reversed. Reason: …" or "…: dismissed. Reason: …".

### Admin

1. **Activate** in Settings › Energy: "Activate Tide Energy" (confirm), later "Pause awards" (confirm). Shows when it was activated and by whom.
2. **Author a quiz** in the Tide editor's Quiz card: question selector, prompt, four options with a "Correct" radio, explanation, a publishing checklist. Publishing a quiz requires a valid set; editing a published quiz shows "Saving changes publishes version 3. Members with the quiz open are asked to reload. Energy already earned stays." "Preview quiz" grades locally against the editor state and earns nothing.
3. **Dashboard**: "Needs you" gains "Open energy flags" with a count, linking to Insights › Energy activity.
4. **Energy activity** (third Insights view): totals, open flags first, then recent awards filterable by type.
5. **Case page** (`/admin/energy/awards/:id`): award facts, flag and reason, audit history, decision. "Dismiss flag" (blue "Save decision") keeps the award. "Reverse award" opens a danger confirmation ("Reverse 20 Tide Energy?") that states it is final. Afterwards an inline outcome: "Decision saved: award reversed. The member and the moderator were notified." A reversed award is locked.

---

## 4. Included features

- Energy ledger, balance, history, activation setting with audit.
- Awards: Trace first approval (inside `moderate_trace`), Tide completion (inside a new completion function), first quiz pass (inside the grading function).
- Approval notification mentions the award; reversal notification to the member; flag outcome notification to the flagging moderator.
- Quiz authoring in the Tide editor with versioning, private answer key, private explanations, publish checks, admin preview.
- Member quiz on the Tide page with server grading, 30-second cooldown, version check.
- Energy pill in the member nav, dashboard energy card and "Quiz ready" card, energy page with history and static reward previews.
- Moderator award status and flagging on My decisions and the staff Trace detail.
- Admin Energy activity under Insights, case page with dismiss and reverse, "Needs you" item, Settings › Energy.
- Loading, empty, error and uncertain-write states on every new view; keyboard and 390px layouts.

UI follows the design system's Phase A components: EnergyPill, EnergyBalance, LedgerRow, RewardPreview, QuizQuestion, QuizOutcome, AwardFlag, ReverseAward, EnergyAttention, plus existing PageHeader, StatTile, Card, Dialog, DecisionOutcome, EmptyState, RemoteState, Badge, Chip. New pages use PageHeader with `as="h1"`.

---

## 5. Deferred items for this phase (each with its v1 substitute)

| Area | Deferred | v1 substitute |
| --- | --- | --- |
| Rewards | Merchant integration, real vouchers, inventory, codes, redemption, fulfillment, expiry | Static previews labelled "Preview: redemption unavailable" with a disabled control. No codes, no deductions, no endpoint |
| Energy economy | Purchased or transferred energy, cash-out, conversion | None. Energy is personal and nontransferable |
| Energy economy | Spending on projects, sponsor matching, community energy totals | None |
| Energy economy | Admin-editable rates, campaigns, arbitrary grants, reversal undo | Fixed rates. Reversals are final |
| Energy economy | Historical backfill | None. Activation boundary applies |
| Gamification | Streaks, badges, leaderboards, referral rewards | None |
| Gamification | Adoption or donation bonuses, daily caps, energy expiry | None. Accepted abuse risk: no daily caps on Trace awards; moderator review and flags limit abuse |
| Learning | AI or RAG quiz generation, question banks, randomized, adaptive or timed exams, certificates, score tiers | Admin-written fixed quizzes. Pass or not passed |
| Oversight | Duplicate-image detection, fraud scoring, device or identity analysis | Moderator flags and admin reversals |
| Oversight | New impact analytics, predictive reporting, donor exports | Existing Insights plus Energy activity |
| Moderator authority | Reversals, balance editing | Admin only |
| Completion trust (this session) | Proof of reading (time on page, scroll, chapter checks) | Server-only completion function; accepted risk of 5 energy per published Tide |

---

## 6. Data model, API and security

### 6.1 Tables (all new, additive)

- `public.energy_ledger`
  `id uuid pk`, `owner_id uuid not null references profiles(id) on delete restrict`, `award_type energy_award_type not null` (`trace_approval`, `tide_completion`, `quiz_pass`, `reversal`), `source_id uuid not null` (Trace id, Tide id, or for a reversal the reversed entry's id), `amount integer not null`, `reverses_id uuid references energy_ledger(id)`, `reason text`, `created_by uuid references profiles(id)` (null for system awards), `created_at timestamptz default now()`.
  Constraints: `unique(owner_id, award_type, source_id)` (one award per source, surviving reversal); partial `unique(reverses_id) where reverses_id is not null` (one reversal per award); `check` that amounts are 20/5/15 for their types and that a reversal's amount is negative and set by trigger to minus the original; `check((award_type='reversal') = (reverses_id is not null))`.
  No `source_id` foreign key on purpose: deleting or hiding a Trace never revokes energy and never blocks deletion.
  RLS: select where `owner_id = auth.uid()` or `private.is_admin()`. No insert, update or delete grants to anyone; rows are written only by definer functions. A trigger rejects `update` and `delete` for every role (append-only).
- `public.tide_quizzes`: `tide_id uuid pk references tides(id) on delete cascade`, `status quiz_status` (`draft`, `published`), `version integer not null default 1`, `published_at`, `updated_at`, `updated_by`.
- `public.tide_quiz_questions`: `id uuid pk`, `tide_id`, `position smallint check between 1 and 5`, `prompt text`, `options text[] check (cardinality = 4)`, `unique(tide_id, position)`. No member select grant; members read questions only through `get_tide_quiz`.
- `private.tide_quiz_keys`: `question_id pk references tide_quiz_questions on delete cascade`, `correct_index smallint check between 0 and 3`, `explanation text not null`. In the `private` schema, no grants to `authenticated` or `anon`.
- `private.tide_quiz_attempts`: `id`, `user_id`, `tide_id`, `version`, `passed boolean`, `attempted_at`. Used for the cooldown and for audit; members never read it directly.
- `public.tide_quiz_passes`: `user_id`, `tide_id`, `first_passed_at`, `version`, `primary key(user_id, tide_id)`. Owner-readable.
- `public.energy_flags`: `id`, `ledger_id references energy_ledger(id)`, `flagged_by`, `reason text not null`, `status flag_status` (`open`, `dismissed`, `upheld`), `resolved_by`, `resolved_at`, `resolution_reason`, `created_at`. Partial `unique(ledger_id) where status='open'`. A check allows flags only on `trace_approval` entries (enforced in the function). RLS: select own flags (`flagged_by = auth.uid()`) for staff, all for admins.
- `settings` key `energy`: `{"activated_at": "<timestamptz>" | null}`. A validation trigger accepts only that shape, only a value within one minute of `now()` when switching on, and writes `admin_audit_logs`.

### 6.2 Functions (definer, `search_path = ''`, revoked from `public, anon`, granted to `authenticated`)

- `private.energy_active()` returns true when `activated_at` is set and `<= now()`.
- `private.issue_award(owner, type, source)`: no-op unless active, owner account active, and not the reviewer/administrator acting on their own content; `insert … on conflict (owner_id, award_type, source_id) do nothing returning *`. Returns the row or null, so callers know whether anything was issued. Not granted to anyone.
- `public.moderate_trace` (replaced): unchanged checks and order; after the status update, when `p_decision='approved'`, calls `issue_award(t.author_id,'trace_approval',t.id)` and, if a row came back, appends " You earned 20 Tide Energy." to the notification message (written after the award call). Same transaction, same row lock, so an approval and its award commit or fail together.
- `public.complete_tide(p_tide_id)`: requires an active account and a published Tide; inserts into `tide_completions` with `on conflict do nothing`; only a newly inserted completion calls `issue_award(...,'tide_completion',...)`. Returns `{completed_at, awarded}`. A completion recorded before activation can never earn, because re-completing inserts nothing.
- `public.get_tide_quiz(p_tide_id)`: only for a published Tide with a published quiz and a completion by the caller; returns version, prompts and options (never the key or explanations), whether the caller has passed, and `retry_after` seconds. After a pass it also returns explanations and correct answers.
- `public.submit_tide_quiz(p_tide_id, p_version, p_answers smallint[])`: checks completion, published state, version (`40001` "Quiz changed" on mismatch), exactly five answers, and the cooldown (last attempt for this user and Tide older than 30 seconds, else `P0001` with `retry_after`). Locks the caller's attempt rows (`for update` on a per-user, per-Tide advisory lock) so parallel submits serialise. Records the attempt. If 4 or more are correct and no pass exists, inserts `tide_quiz_passes` and calls `issue_award(...,'quiz_pass',...)`. Returns only `{passed, awarded, retry_after}`; never a score.
- `public.admin_save_tide_quiz(p_tide_id, p_expected_version, p_questions jsonb, p_publish boolean)`: admin only; validates five questions, four non-empty options, one correct index, an explanation each before publishing; bumps `version` when a published quiz changes; never touches passes or awards. `public.admin_get_tide_quiz` returns the full quiz with keys for the editor. `public.admin_unpublish_tide_quiz`.
- `public.flag_energy_award(p_ledger_id, p_reason)`: staff only; the entry must be a `trace_approval` and not reversed; one open flag per award (unique violation becomes a clear error). Notifies admins (`energy_flag`), like `notify_staff_report`.
- `public.dismiss_energy_flag(p_flag_id, p_reason)` and `public.reverse_energy_award(p_ledger_id, p_reason)`: admin only, reason required, `for update` on the entry and its open flag. Reversal inserts the compensating row (unique `reverses_id` makes a second reversal fail), resolves any open flag as `upheld`, writes `admin_audit_logs`, notifies the member (`energy_reversal`) and each flagging moderator (`energy_flag_outcome`). Dismissal notifies only the moderator.
- `public.get_my_energy(p_limit, p_offset, p_type)`: balance (sum of the owner's rows) and paged history with source titles resolved server-side (deleted Traces keep their title; hidden ones show "Hidden Trace").
- `public.admin_energy_activity(...)`, `public.admin_energy_award(p_id)`: admin lists and case detail with audit.
- `public.set_energy_active(p_active boolean)`: admin only; writes the `energy` setting through the validation trigger.
- `public.get_dashboard_summary` (replaced): adds `open_energy_flags` for admins. Existing fields unchanged.

### 6.3 API (Express, behind `ENERGY_ENABLED`)

All new routes return 404 when the server flag is off (a router-level guard, not just hidden links). Inputs validated with Zod like the existing routes; amounts, scores and owners are never accepted from the client.

| Method and path | Who | Calls |
| --- | --- | --- |
| `PUT /api/tides/:id/completion` (existing route, changed) | member | `complete_tide` (works with the flag off; reports `awarded:false`) |
| `GET /api/energy?limit&offset&type` | member | `get_my_energy` |
| `GET /api/tides/:id/quiz` | member | `get_tide_quiz` |
| `POST /api/tides/:id/quiz/attempts` | member | `submit_tide_quiz` |
| `GET /api/moderation/energy/awards?trace_ids=` | staff | award status for reviewed Traces |
| `POST /api/moderation/energy/awards/:id/flags` | staff | `flag_energy_award` |
| `GET /api/moderation/energy/flags` | staff | own flags (admin: all) |
| `GET/PUT /api/admin/tides/:id/quiz` | admin | `admin_get_tide_quiz`, `admin_save_tide_quiz` |
| `GET /api/admin/energy/activity`, `GET /api/admin/energy/awards/:id` | admin | activity and case |
| `POST /api/admin/energy/flags/:id/dismiss`, `POST /api/admin/energy/awards/:id/reverse` | admin | decisions |
| `GET/PUT /api/admin/energy/settings` | admin | read and `set_energy_active` |

Client flag `VITE_ENERGY_ENABLED` hides the pill, cards, quiz card, Quiz editor card, Insights view, Settings section and moderator controls, and the routes `/user/energy`, `/admin/energy/*` render the not-found page.

### 6.4 Security boundaries

- **Atomic issuance**: every award is written inside the function that records its event (approval, completion, first pass), in one transaction.
- **Exactly once**: the ledger's unique constraint is the guarantee; `on conflict do nothing` makes retries and races return "not awarded" instead of failing; reversals cannot be repeated (`unique(reverses_id)`).
- **Idempotent writes**: completion and first pass are naturally idempotent (`on conflict`); flags rely on the partial unique index; quiz saves use `p_expected_version` (stale saves return `409 STALE_VERSION`, matching the editor's existing pattern).
- **Answer-key privacy**: keys and explanations live in `private`, with no grants; `get_tide_quiz` returns them only after a pass; failed attempts return no score; the admin editor is the only other reader.
- **Direct Supabase access**: no insert, update or delete grants on ledger, passes, flags or quiz tables; the `tide_completions` insert grant is revoked once the server uses `complete_tide` (step 7 below); member select is limited to own rows; SQL tests attempt every forbidden path as member, moderator and admin.
- **Activation boundary**: awards check `energy_active()` at the moment of the event. No backfill, no replay. A Trace pending at activation earns when approved; a Tide completed before activation never earns completion but can still earn its first quiz pass.
- **Additive migrations**: new types, tables, functions; `create or replace` for `moderate_trace` and `get_dashboard_summary` with unchanged signatures and unchanged behaviour while energy is inactive. Safe to run before any code deploys.

### 6.5 Activation and rollback sequence

1. Staging: run the migration; deploy API and client with flags off; verify nothing changed.
2. Staging: turn on `ENERGY_ENABLED` and `VITE_ENERGY_ENABLED`; author a quiz; activate energy in Settings; run the hosted checks (section 8).
3. Production: run the migration first; deploy with flags off; then flags on; then activate in Settings.
4. Rollback: pause energy in Settings (no more awards), then turn flags off (routes 404, UI hidden). Never drop tables. Issued awards stay and can be reversed by an admin.

Account removal today: none (suspension only). Suspended accounts stop earning because `issue_award` requires an active owner. Proposal if deletion is added later: keep ledger and pass rows for audit, show "Former member".

---

## 7. Implementation steps (pull requests into `staging`)

Each step is one branch from `staging`, one pull request, tests run on the Mac, checked on staging. Steps 3 to 7 depend on 1 and 2; 3 to 7 can otherwise go in any order, but this order lets each screen be tested end to end.

1. **Schema and functions** (`supabase/migrations/2026111x000100_tide_energy.sql`, regenerate `staging-setup.sql`): types, tables, RLS, ledger append-only trigger, `energy` setting validation, every function in 6.2 (award calls included, inert until activated), `get_dashboard_summary` field. New SQL tests (section 8). No app code.
2. **Server foundation**: `ENERGY_ENABLED` in `config.js`, 404 guard, `complete_tide` behind the existing completion route (returns `awarded`), `GET /api/energy`, admin energy settings routes. Client: `VITE_ENERGY_ENABLED`, Settings › Energy section. Server and client tests.
3. **Quiz authoring**: admin quiz routes; Quiz card in `EditTide.jsx` (chips for questions, correct-option radios, explanation, checklist, preview, version warning); tests for validation and stale saves.
4. **Taking the quiz**: member quiz routes; quiz card, attempts, cooldown countdown, pass explanations and reload-on-version on `ViewTide`; completion button shows the award; tests.
5. **Member energy**: nav pill, dashboard energy and "Quiz ready" cards, `/user/energy` with history, filters, reward previews, all states; tests.
6. **Moderator flags**: award status and "Flag award" on My decisions and the staff Trace detail; flag routes; tests.
7. **Admin investigations**: Energy activity view in `InsightsSwitch`, case page, dismiss and reverse with confirmation and DecisionOutcome, "Needs you" item, notifications; follow-up migration revoking the direct `tide_completions` insert grant (safe once step 2 is live everywhere); tests.
8. **Release**: staging hosted checks, then `staging` to `main` with migrations run on production first.

Copy in every step follows the design system's content guide; tests find elements by role and name, so copy changes update tests in the same pull request.

---

## 8. Testing and acceptance criteria

### 8.1 Automated client and server tests (Vitest, run on the Mac)

- Server: 404 for every new route with `ENERGY_ENABLED` off; Zod rejects client-sent amounts, scores, owners and extra fields; role checks (member, moderator, admin) per route; completion returns `awarded` correctly and is idempotent; quiz submit maps `40001` to a reload response and cooldown errors to `retry_after`.
- Client: pill, cards and pages hidden with the flag off; quiz: submit disabled until five answers, failure shows only "Not passed yet.", countdown, pass shows explanations, version reload; energy page loading, empty ("No Tide Energy yet."), error ("Try again"), filters, reversal rendering; reward previews disabled with the exact label; moderator flag dialog requires a reason and shows "Flag open"; admin reverse requires a reason and a confirmation, and the case locks afterwards; uncertain writes (network failure after submit) re-read state instead of resubmitting; keyboard order and accessible names for all new controls.

### 8.2 SQL tests (`supabase/tests/tide-energy.sql`, `tide-quiz.sql`, `energy-flags.sql`, same pattern as `moderator-workflow.sql`)

- **Direct-database authorization**: as member, moderator and admin: cannot insert, update or delete ledger, passes, flags or quiz tables; cannot read `private` tables; cannot read another member's ledger; cannot call `issue_award`; cannot call admin functions; moderator cannot reverse or dismiss; member cannot flag; after the step 7 migration, member cannot insert `tide_completions` directly.
- **Exactly once, retries**: approve, then re-run approval paths: one award; complete twice: one award; pass twice: one award; reverse twice: second fails; a reversed source cannot earn again.
- **Activation boundary**: nothing issued while `activated_at` is null; Trace pending at activation earns on approval; completion before activation never earns, later quiz pass does; pausing stops awards; setting the key with a bad shape or a back-dated time fails.
- **Self-review and holds**: self-approval still fails and issues nothing; a held Trace approved by an admin earns once; a moderator cannot approve it.
- **Quiz**: grading needs 4 of 5; cooldown under 30 seconds fails; version mismatch fails; key and explanations are never returned before a pass; publish fails without five complete questions; editing a published quiz bumps the version and keeps passes.
- **Flags**: only `trace_approval` entries; one open flag per award; flagging works on hidden and deleted source Traces; dismissal notifies only the moderator; reversal notifies member and moderator; notification texts match.
- **Concurrency**: one transaction cannot prove this, so add `supabase/tests/energy-concurrency.sh` (no new dependencies): runs two `psql` sessions in parallel against a disposable database, approving and completing the same source and submitting two passing attempts at once, then asserts exactly one ledger row per source. Document it beside `local-check.mjs`.
- Wire the new files into `local-check.mjs`.

### 8.3 Hosted checks on staging

- Flags off: no visible change; new API routes return 404.
- Activate in Settings; approve a Trace by a second account: notification includes the amount, balance +20.
- Complete a Tide: +5 once; re-click and refresh: nothing more.
- Quiz: fail (no score, countdown), pass (+15, explanations), retake (no more energy); admin edits the published quiz mid-attempt: reload prompt.
- Moderator flags an award, including on a deleted Trace; second flag refused; admin dismisses (moderator notified, member not); flag again and reverse (both notified, history shows the reversal, case locked).
- Pause: approvals and completions earn nothing. Unpublish a Tide: quiz gone, energy kept; republish: quiz back, pass still counted.
- Mobile at 390px and desktop at 1440px, keyboard only, dark mode, slow network (loading), offline submit (uncertain write).

### 8.4 Acceptance criteria (from the brief)

All of the following must pass before release: exactly-once awards under concurrency and retries; historical records respect the activation boundary; self-review restrictions and holds unchanged; quiz grading, cooldown, retries, version changes and answer privacy; flagging of hidden or deleted source Traces; one open flag per award; reversals admin-only and non-repeatable; redemption disabled with the exact label; mobile, keyboard, loading, empty, error and uncertain-write states on every new screen.

---

## 9. Assumptions, open questions and prerequisites

### Assumptions

- The existing `trace_review` preference ("Submission updates") also covers the award sentence inside the approval notification; reversal and flag-outcome notifications are not optional (they are about account integrity).
- Award titles in history come from the database at read time; a later Trace title edit changes the history label (the source id is the record).
- Concurrency testing uses the local Supabase CLI or a disposable staging-like project the developer controls.
- Phases B and C do not change these tables.

### Open questions (not blocking step 1)

- Should a moderator also see award status on the review queue cards, or only on My decisions and Trace detail? Plan assumes only the latter.
- Should Energy activity offer CSV export for the capstone report? Not planned (deferred register: no new exports).

### Prerequisites for real-world operation (not built)

- Update `docs/legal/` privacy policy and terms for the ledger, quiz attempts and flags before any public release.
- Rewards stay previews: real vouchers need merchant agreements, fulfillment and tax review.
- Replace demonstration data and labels, and confirm moderation staffing can review flags promptly.
