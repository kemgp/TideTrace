# Publication notes — internal only

Prepared on 15 October 2026 from the application source and repository documentation. These are review drafts, not published policies or a certification of legal compliance. The user specified TideTrace as the operator, the Philippines as its base, and no contact email. Both drafts respect those choices.

## Complete before publication

- Replace bracketed fields and set the actual effective date. If TideTrace is only a brand, identify the accountable person or legal entity. Add a working contact form or postal address; do not add an email address. The NPC identifies controller identity and contact details as privacy-notice information.
- Confirm production providers, email delivery arrangements, regions, safeguards, and any hosting analytics or commercial data sharing. Vercel and Render appear in deployment instructions, which alone do not prove the active deployment configuration.
- Approve specific retention criteria or periods and implement the corresponding deletion process. Detaching Trace media currently does not physically erase the stored file; do not promise immediate or automatic erasure. Verify backups and provider logs separately.
- Decide and implement the age/guardian workflow. The under-18 wording is a proposed operating rule; the reviewed app does not establish a verified parental-authorization process. If minors will not be supported, revise both documents consistently and enforce that decision before launch.
- Verify consent and notices for optional public disclosures and third-party resources. Maps load when the map component mounts, coordinates go to Google during pin selection, and Google Fonts loads from the page. The reviewed flow does not establish a prior-consent gate for these requests.
- Make the documents accessible from registration and the public footer when ready. These changes create document drafts only; they do not add routes, acceptance records, contact forms, or privacy-request workflows.
- Have Philippine counsel or a qualified privacy reviewer confirm that the final text matches the operator's actual practices and intended users, particularly children's access, lawful bases, retention, and liability provisions.

## Evidence reviewed

- `README.md`, `server/README.md`, `DEPLOYMENT.md`: service features, session persistence, deployment configuration, and media removal limits.
- `client/src/api/maps.js`, `client/src/components/TraceMap.jsx`: optional map pins, Google scripts, and coordinate lookup before submission.
- `client/index.html`: Google Fonts requests.
- `client/src/api/session.js`, `client/src/context/AppContext.jsx`: browser session and theme storage.
- `supabase/migrations/`: profiles, contributions, comments, reports, moderation/audit records, lesson completions, profile photos, and notification preferences.

## Legal and provider references

- [Philippine Data Privacy Act of 2012](https://privacy.gov.ph/Data-Privacy-Act/): lawful processing, security, retention principles, and data-subject rights.
- [NPC: The right to be informed](https://privacy.gov.ph/the-right-to-be-informed/): information to include in a privacy notice, including controller contact details.
- [NPC: Data subject rights](https://privacy.gov.ph/data-subject-rights/): overview of rights and how they apply.
- [Google Privacy Policy](https://policies.google.com/privacy): provider handling of technical information and embedded services.

These references informed the drafts; they do not establish that TideTrace has implemented every required operational measure.
