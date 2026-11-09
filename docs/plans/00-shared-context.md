# Adopt-a-Barangay and Tide Energy: shared context

Each phase brief (`phase-a-energy-brief.md`, `phase-b-adoption-brief.md`, `phase-c-donations-brief.md`) starts its own planning session. Read this file first, then the phase brief.

## Ground rules (all phases)

- Planning only. Do not edit application code, apply migrations, or install dependencies. Writing the plan file under `docs/plans/` is the only allowed write.
- Read `CLAUDE.md` and `handoff.md` first. Inspect the repository and ground every recommendation in existing code: Trace approval (`moderate_trace`), Tide completion and progress persistence, the `settings` table, notifications, the admin Tide editor, the API route modules (`auth`, `content`, `media`, `staff`), and the SQL tests in `supabase/tests/`.
- Reuse existing components, authentication, authorization, moderation, notifications, API conventions, and test tools. Add no dependencies and no new account roles.
- Before writing the plan, list every consequential ambiguity you found in the brief or the code and ask about them (AskUserQuestion). Wait for answers. Do not guess. Then write the plan file and stop for review. Do not start the next phase.
- Branches: work branches from `staging`, never `main`. Flow and environments are in `DEPLOYMENT.md` ("Staging environment").
- Migrations are additive and preserve existing data. Frontend and API deploy independently, so the schema must be safe if it goes live before the code that uses it.
- Every feature ships behind a flag that defaults to off: a client flag (`VITE_` variable) and a server flag. When the server flag is off, the new routes return 404. Hiding navigation alone is not enough.
- Demo data lives in staging-only seed scripts under `supabase/` (like `staging-seed-accounts.sql`), never in `supabase/migrations/`.
- Copy rule from `CLAUDE.md`: no em-dashes in interface text, including examples in the plan. Use a colon, a full stop, or restructure the sentence.
- Separate automated tests (client, server, SQL) from hosted or manual validation on staging in every plan.
- Do not remove or relabel existing application features as deferred.

## Project context (verify against the repository)

TideTrace uses React, Express, and Supabase. Existing features: Traces (community observations submitted for moderation), Tides (educational lessons), lesson completion and reading progress, member/moderator/admin roles, dashboards, notifications, contribution history.

## Confirmed decisions

- Purpose: a capstone demonstration. Partner identities, verification results, projects, and donations are demonstrations.
- Geography: Guimaras and Iloilo, primarily Guimaras. No confirmed barangay, LGU, NGO, or merchant partners.
- Each member can adopt one barangay at a time. Adopting means following and supporting. It creates no ownership, exclusivity, residency requirement, or financial obligation.
- Tide Energy belongs to the individual. It comes from approved Traces, Tide completion, and passing short quizzes.
- Energy is earned once per source:
  - Trace: the first time that Trace is approved. Once per Trace. Re-approval after a hold or revision never pays again.
  - Tide completion: once per Tide.
  - Quiz pass: the first pass of that Tide's quiz. Once per Tide.
- Completion and quiz passing are separate awards. A quiz pass earns more than completion.
- Quizzes are admin-written. Vouchers and redemption are placeholders.
- Moderators review content and flag questionable awards. Admins handle partnerships, projects, simulated receipts, quizzes, and energy investigations.
- For this staging and capstone stage, real barangay names with demonstration content are acceptable. Revisit before any public release.

## Defaults (proposed, not confirmed)

Label these as defaults in the plan.

- Initial catalog: three Guimaras demonstration communities and one Iloilo demonstration community. Iloilo City deferred.
- Amounts: Tide completion 5, quiz first pass 15 additional, Trace first approval 20.
- Quiz: five questions, four options each, one correct answer per question. Passing score: four correct. (This replaces the earlier three-question default.)
- Fixed earning rates for v1. No historical energy backfill.

## Activation boundary (proposed rule)

- Store `energy_activated_at` in the existing `settings` table. While it is null, no awards are issued. It doubles as a kill switch.
- An award requires the source event to happen after `energy_activated_at`.
- A Trace pending at activation earns when approved, because approval is a new event.
- A Tide completed before activation never earns the completion award, and re-completing it creates no new event. It can still earn the first quiz pass.
- Retries or replays on historical records never award points.

## Staff and self-review

- Staff earn normally from their own member activity.
- Existing self-review restrictions stay. Staff previews and administrative actions never earn energy.

## Energy ledger rules

- Append-only ledger: owner, award type, source, amount, timestamp, and a reversal link where applicable.
- The balance is derived from the ledger. There is no editable balance column and no balance editor.
- A unique database constraint on owner, award type, and source guarantees one award per source, even after a reversal. A reversed award cannot be earned again.
- A reversal is a compensating entry. The original award stays. One award can be reversed once.
- Normal deletion or removal of content does not revoke energy.
- Energy is personal, nontransferable, non-purchasable, and has no cash equivalent. Do not reward adoption, simulated donations, comments, sign-ins, drafts, rejected submissions, repeat completions, or repeat passes.
- Eligibility, amounts, and recipients are decided on the server and in the database. Clients never send scores, balances, or amounts. Direct Supabase requests cannot bypass the rules.

## Quiz rules

- Lessons may exist without a quiz. Completion earns its own award and unlocks the quiz.
- Grading is on the server. The answer key is never exposed through quiz-fetch responses or member database access.
- A failed attempt shows only "Not passed yet", with no score and no indication of which answers were wrong.
- Explanations are shown only after a pass.
- A server-enforced cooldown of 30 seconds applies between attempts. Retries are otherwise unlimited.
- Only the first pass earns energy.
- Publishing requires exactly five questions, four options each, one correct option, and an explanation per question.
- Published quiz edits bump a quiz version and require outstanding attempts to reload. Edits never reset award eligibility.
- Admin previews do not earn points.
- Accepted risk: Trace awards have no daily caps, so only moderator review and flags limit abuse.

## Permissions

Members:
- Browse demonstration communities and projects. Adopt, switch, or leave one community.
- Submit simulated monetary or in-kind pledges. Cancel their own pending pledges. View their own contribution status.
- Complete Tides and answer quizzes. View their own energy balance and history. Browse disabled reward previews.

Moderators:
- Keep approving, rejecting, and requesting revisions on Traces. See the award status of a reviewed Trace.
- Flag an already-issued Trace award for admin investigation, with a reason. See the resolution of their flags.
- Cannot: approve partners or verification results, publish communities, projects or updates, confirm simulated receipts, read private partner notes, browse unrelated members' energy histories, edit rates, grant, deduct, reverse or edit energy, or author quizzes unless an existing capability already allows it.

Admins:
- Keep existing moderation oversight. Manage demonstration partners, communities, projects, and updates.
- Review partner checklists. Approve for demonstration, request changes, decline, or suspend partners.
- Confirm or decline simulated receipts. Author and publish quizzes.
- Investigate energy flags. Reverse invalid awards of any type with a reason. Inspect relevant audit history.
- Cannot overwrite an energy balance or turn demonstration records into real financial transactions.

## Privacy, retention, and rollback

- Update `docs/legal/` (privacy policy and terms) for adoption, pledges, and energy before any public release.
- The `profiles` table references auth users with `on delete restrict`. Document how account removal works today and propose what happens to adoption, pledge, and ledger rows. Suggested default: keep ledger and confirmed pledge rows for audit, remove the adoption, and show "Former member".
- Rollback uses the feature flags and the null `energy_activated_at` switch. Never drop tables to roll back. Awards already issued stay and can be reversed by an admin.

## Complete deferred register (with v1 substitutes)

Deferred means not in v1. It is not a promise to build later. For each row, the plan must repeat the substitute.

| Area | Deferred | v1 substitute |
| --- | --- | --- |
| Partnerships | Real onboarding and verification badges | Fictional partners. "Demonstration" label and "Demo verification completed". Never an unqualified "Verified partner" badge |
| Partnerships | Real agreements and sensitive evidence uploads | Sample evidence notes as text. No IDs, signatures, banking details, or documents |
| Partnerships | Automated registry checks | Admin-filled checklist with fictional results |
| Partnerships | Partner self-registration, accounts, dashboards, self-service updates | Admin-managed onboarding. Admins publish updates on behalf of partners |
| Geography | Iloilo City and areas outside the catalog | Fixed catalog enforced on the server |
| Geography | Nationwide or imported directories | Seeded demonstration catalog |
| Adoption | Multiple adoptions, group, school or company adoption, sponsorship tiers | One individual adoption at a time. No tiers |
| Donations | Real money or goods, payment providers, links, bank or e-wallet details, QR payments | Simulated pledges. Every screen says no money or goods are transferred |
| Donations | Payment verification and reconciliation | Admin confirms or declines a simulated receipt |
| Donations | Refunds, payouts, escrow, platform fees, recurring donations | None. Members cancel their own pending pledges |
| Donations | Financial or tax receipts, proof-of-payment uploads | "Simulated receipt confirmed" status only |
| Operations | Logistics, inventory, pickup, shipping, distribution tracking | In-kind pledges list items and quantities only |
| Coordination | Messaging, scheduling, e-signatures | Coordination checklist recorded by an admin |
| Coordination | Automated partner reminders | Next review date is recorded. No automation |
| Coordination | Disputes or appeals portal | Admin decision with a reason. Complaints are a checklist item |
| Coordination | Partner-managed receipt confirmation | Admin confirms |
| Moderator authority | Partner decisions, project publishing, donation confirmation, private partner documents, reversals, balance editing | Admin only |
| Rewards | Merchant integration, real vouchers, inventory, codes, redemption, fulfillment, expiry | Static previews labeled "Preview: redemption unavailable" with a disabled control. No codes, no deductions, no endpoint |
| Energy economy | Purchased or transferred energy, cash-out, conversion | None. Energy is personal and nontransferable |
| Energy economy | Spending on projects, sponsor matching, community energy totals | None |
| Energy economy | Admin-editable rates, campaigns, arbitrary grants, reversal undo | Fixed rates. Reversals are final |
| Energy economy | Historical backfill | None. Activation boundary applies |
| Gamification | Streaks, badges, leaderboards, referral rewards | None |
| Gamification | Adoption or donation bonuses, daily caps, energy expiry | None. Accepted abuse risk is stated above |
| Learning | AI or RAG quiz generation, question banks, randomized, adaptive or timed exams, certificates, score tiers | Admin-written fixed quizzes. Pass or not passed |
| Oversight | Duplicate-image detection, fraud scoring, device or identity analysis | Moderator flags and admin reversals |
| Oversight | New impact analytics, predictive reporting, donor exports | Existing Insights plus Energy Activity |
| Oversight | Automated outcome verification, live community rankings | Admin-published updates. Receipt totals are not proof of environmental outcomes |

## Real-world prerequisites (explain separately in the plan, do not build)

Independently contact the organization or barangay through an official channel. Confirm the representative's authority. Distinguish organization registration, project authorization, and fundraising permission. Update legal documents. Replace demonstration data and labels.
