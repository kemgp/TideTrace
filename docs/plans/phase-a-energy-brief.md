# Phase A brief: Tide Energy, quizzes, moderator flags, admin investigations

Read `docs/plans/00-shared-context.md` first and follow its ground rules. This is a planning task. Write the plan to `docs/plans/phase-a-plan.md`, then stop for review.

## Goal

Add Tide Energy end to end, because it is the only phase that changes existing Trace approval and Tide completion. Phases B and C depend on nothing here and can be planned in parallel, but Phase A must be solid first.

## Scope

1. Energy ledger and awards: Trace approval (20), Tide completion (5), first quiz pass (15), per the shared rules, activation boundary, and unique awards.
2. Admin-written quizzes inside the existing Tide editor, with server grading, cooldown, versioning, and a private answer key.
3. Member experience: quiz after completion on the Tide page, energy balance on the dashboard, a dedicated energy history page, and static reward previews.
4. Moderator flags on already-issued Trace awards, with status and outcome visible to the moderator.
5. Admin investigations: Energy Activity and open flags under Insights, dismiss or reverse with a reason, reversal of any award type, audit history, and notifying the affected member through existing notifications.
6. Dashboard attention item for open energy flags.

## Reward previews

Static screen with no table, no endpoint, and no codes. Three or four generic cards with no merchant names and no prices, shown next to the member's balance. Each card has a disabled control and the label "Preview: redemption unavailable". Place it with the energy history page.

## Things to verify in the code before planning

- How completion is recorded today and whether the client can assert it. Say how the 5-energy award can be made safe.
- How `moderate_trace` handles approve, reject, request revision, holds, and self-review, and where to commit an award atomically in the same transaction.
- Whether Tides can be unpublished, edited, or deleted after completions exist, and what that means for quizzes and awards.
- How the existing Tide editor stores content and where quiz authoring fits.
- How notifications are created and which kinds exist.
- Which existing SQL tests cover access control, and which new ones this phase needs.

## Ambiguities to ask about

After inspecting the code, ask the person about anything consequential. Likely areas: where completion becomes trustworthy, what happens when a Tide with a quiz is unpublished or deleted, who is notified when a flag is resolved, and whether moderators can see the flagged member's name or only the Trace.

## Required plan sections

1. Summary, with confirmed decisions separated from defaults.
2. Permission matrix for member, moderator, and admin (Phase A scope only).
3. User and staff workflows.
4. Included features.
5. Deferred items relevant to this phase, each with its v1 substitute.
6. Data model, API capabilities, and security boundaries: atomic award issuance, idempotent writes, answer-key privacy, direct Supabase access rules, additive migrations, and the activation and rollback sequence.
7. Implementation steps and dependencies, small enough for separate pull requests into `staging`.
8. Testing and acceptance criteria in three groups: automated client and server tests, SQL tests following the `supabase/tests/` pattern (direct-database authorization and exactly-once awards under concurrency and retries), and hosted checks on staging.
9. Assumptions, open questions, and prerequisites for real-world operation.

## Acceptance criteria to cover

Exactly-once awards under concurrency and retries. Historical record behavior at the activation boundary. Self-review restrictions and existing holds. Quiz grading, cooldown, retries, version changes, and answer privacy. Flagging of hidden or deleted source Traces. One open flag per award. Restricted and non-repeatable reversals. Disabled redemption. Mobile, keyboard, loading, empty, error, and uncertain-write states.
