# TideTrace

Community ecological awareness app for Iloilo. **Traces** are member photo observations (category, location, description). **Tides** are short lessons published by admins. Flow: contribute → review → discover → learn. Roles: member, moderator, admin.

Current status, what changed last session, and what is left: @handoff.md (read it at the start of every session, and update it at the end).

## Layout

- `client/`: React 19, React Router, Vite 8, Tailwind config, plain CSS. Shared components in `client/src/`, tests alongside.
- `server/`: Node ES modules, Express 5, Zod, Supabase JS client. Routes: `auth`, `content`, `media`, `staff`.
- `supabase/`: migrations, SQL security tests, email templates, first-admin bootstrap.
- `docs/legal/`: privacy policy, terms, publication notes.
- `DEPLOYMENT.md`: Vercel (frontend) + Render (API).
- Planning docs (PRD, ERD, flows, backlog) live one level up in `../TideTrace-Phase-2-Raw-Files/`. Only read them when asked.

## Commands (run from this folder, Node 22.12+)

- `npm run dev` frontend on 5173
- `npm run dev:server` API on 3001
- `npm test`, `npm run build`, `npm run verify:reads`

`node_modules` are macOS builds. Tests and builds must be run on the user's Mac, not in a cloud session.

## Conventions

- Never open or print `server/.env` or `client/.env.local`.
- Do not add a Claude co-author trailer or "Generated with Claude" line to commit messages or PR descriptions on this project.
- Work on a branch, not `main`. Do not commit or push unless asked.
- Buttons: blue = primary, clay = "contribute" accent (one per screen), danger red = destructive. Never use clay for errors or destructive actions.
- Color tokens: text and button colors must pass WCAG AA. Use `--soft`, `--clay-strong`, `--teal-strong`, `--danger` for text; `--clay` and `--teal` are decoration only. `client/src/pages/Home/home.css` redefines tokens under `.tt-home`, so change tokens in both places.
- Tests find elements by role and name and check wording. Update them when changing copy.
- Copy: no em-dashes in interface text (labels, buttons, placeholders, tooltips, headings, empty states). Use a full stop, a colon, or restructure the sentence. A lone "—" as an empty-value placeholder stays visible but must be `aria-hidden` with `<span className="sr-only">Not available</span>` beside it. Marketing prose and page titles may use them sparingly.
- Helper-note rule: keep a note only if it prevents a mistake, protects privacy, or helps recovery.
- Toasts (`useToast()` in `client/src/hooks/useToast.js`; `showToast("text")` still works and means success): one action gets one confirmation, so never add a toast next to an equivalent message that is already visible on the page. Use a toast when the user ends up somewhere else or nothing on screen shows the result. Past tense, short ("Profile saved"). Errors from a form the user just submitted stay inline next to that form (`role="alert"`); error toasts are only for background failures and stay until dismissed. Staff decisions that keep the person on the same page (review, report) keep their inline outcome.
