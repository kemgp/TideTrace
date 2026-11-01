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
- Helper-note rule: keep a note only if it prevents a mistake, protects privacy, or helps recovery.
