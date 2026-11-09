# Phase C brief: simulated donations, updates, dashboards

Read `docs/plans/00-shared-context.md` first and follow its ground rules. This is a planning task. Write the plan to `docs/plans/phase-c-plan.md`, then stop for review. This phase builds on Phase B (communities, partners, projects). If Phase B is not built yet, plan against its approved plan file.

## Goal

Let members make simulated pledges to active projects, let admins confirm them and publish updates, and surface adoption on the dashboards.

## Scope

1. Pledges: simulated monetary pledges in pesos, and simulated in-kind pledges for requested items and quantities. Flow: view project, choose support, review demo pledge, submit, track status.
2. Contribution states: Pledged, Simulated receipt confirmed, Cancelled, Declined.
3. Rules: only active projects under approved and available demo partners accept pledges. Members cancel only their own pending pledges. Admins confirm or decline with an auditable action. No silent rewriting of amounts and no erasing of confirmed history. Duplicate submissions create one pledge. Validate amounts and quantities. Reject stale or conflicting state changes.
4. Totals: pending pledges and confirmed simulated receipts shown separately, money separate from goods, different goods distinguishable. Receipt totals are never presented as proof of completed environmental outcomes.
5. Every relevant screen states that no money or goods are transferred. No payments, QR codes, bank details, proof uploads, real receipts, or payment credentials.
6. Updates: admins publish demonstration updates on behalf of partners.
7. Dashboards: the member dashboard shows the adopted community and one useful project or update, and an invitation to explore (not a forced onboarding step) when there is no adoption. The admin dashboard attention items include partner reviews and pending simulated receipts. Show active projects with their latest update date, with no invented reporting schedule.
8. Moderators cannot confirm receipts or publish updates.
9. Pledges, adoption, and confirmations never earn energy.

## Things to verify in the code before planning

- Existing idempotency or double-submit patterns in the upload and review flows, and how conflicting state changes are rejected today (for example version checks).
- How dashboard cards and admin attention items are built, so new items reuse them.
- Currency formatting and number validation helpers, if any.

## Ambiguities to ask about

After inspecting the code, ask about anything consequential. Likely areas: allowed pledge amount limits and in-kind quantity limits, whether a member can have several pending pledges to one project, what happens to pending pledges when a project is paused, cancelled, or its partner is suspended, and how members see cancelled or declined pledges.

## Required plan sections

Use the nine sections from the Phase A brief: summary, permission matrix, workflows, included features, deferred items with substitutes, data model with API and security boundaries, implementation steps and dependencies, testing and acceptance criteria (automated, SQL, hosted), and assumptions with real-world prerequisites.

## Acceptance criteria to cover

Duplicate pledges and double-submit. Conflicting decisions and stale state. Correct separate simulated totals for money and goods. Unauthorized pledge, cancel, confirm, and publish actions. Cancellation limited to own pending pledges. Demo disclaimer on every relevant screen. Direct database authorization. Mobile, keyboard, loading, empty, error, and uncertain-write states.
