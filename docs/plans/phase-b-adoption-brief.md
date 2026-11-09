# Phase B brief: Adopt-a-Barangay, partner reviews, projects, administration

Read `docs/plans/00-shared-context.md` first and follow its ground rules. This is a planning task. Write the plan to `docs/plans/phase-b-plan.md`, then stop for review. Phase A does not need to be built first, because this phase earns no energy.

## Goal

Let members adopt one demonstration community, and let admins manage the demonstration partners, communities, and projects behind it.

## Scope

1. Member experience: an Adopt-a-Barangay navigation destination, Guimaras first and the default filter, server-restricted catalog, community pages with location, conservation priorities, demonstration partners, projects, and updates, and one persisted current adoption per member.
2. Switching or leaving needs a confirmation. Previous contributions stay linked to their original projects. Adoption changes never move energy or contribution history.
3. If a community becomes unavailable: explain why, disable new support, and allow switching or leaving.
4. Anyone can participate regardless of residence. Adopt means follow and support. Show a clear difference between geographic communities, organizations, and projects. A real place name must not imply official endorsement.
5. Admin-managed partner onboarding with no self-registration or portal. Review records capture: organization name and type, associated community, representative and claimed authority, barangay acknowledgment, identity or registration checks, independent-contact verification, coordination agreement checklist, reviewer, review date, findings, next review date, decision, and reason.
6. Partner flow: Draft, Under review, then Changes requested, Approved for demo, or Declined. An approved partner may be suspended and needs a recorded review before reinstatement.
7. Projects: states Draft, active, paused, completed, cancelled. Each project names a barangay focal person, an accountable implementing organization or LGU office, an authorized recipient representative, and the TideTrace admin who publishes reviewed information. Partner approval never publishes a project automatically.
8. Coordination checklist covering needs, beneficiaries, receiving support, delivery, reporting, publication permissions, complaints, and withdrawal.
9. Admin navigation: a Communities group with Partners, Barangays and Projects. Internal notes stay private and are never exposed to members or moderators.

## Demonstration rules

- Fictional partner identities and sample evidence notes. Collect no real IDs, signatures, banking details, or sensitive documents.
- Show "Demonstration" and "Demo verification completed". Never an unqualified "Verified partner" badge. Demo approval cannot be relabeled as real approval.
- The plan must propose a thin implementation of partner review. The brief values a believable demonstration over a heavy workflow, since real verification will be designed later.
- Explain the future real-world verification process separately, as prerequisites.

## Things to verify in the code before planning

- Existing admin navigation, list and detail patterns, and how admin routes are authorized.
- How the `settings` table and feature flags work today, to gate the whole feature.
- Existing notification and audit-log conventions for admin decisions.
- How profile or account removal works, for adoption retention.

## Ambiguities to ask about

After inspecting the code, ask about anything consequential. Likely areas: whether the demonstration communities use real barangay names, what "unavailable" means in data terms, whether a suspended partner hides its projects, and what a member sees for a community with no active projects.

## Required plan sections

Use the nine sections from the Phase A brief: summary, permission matrix, workflows, included features, deferred items with substitutes, data model with API and security boundaries, implementation steps and dependencies, testing and acceptance criteria (automated, SQL, hosted), and assumptions with real-world prerequisites.

## Acceptance criteria to cover

Adoption switching, leaving, and unavailable listings. Server-side catalog restriction. Unauthorized partner and project actions by members and moderators. Private notes never reaching members or moderators. Partner state transitions and suspension review. Demo labels present everywhere a partner or community appears. Direct database authorization. Mobile, keyboard, loading, empty, error, and uncertain-write states.
