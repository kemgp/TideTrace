TideTrace

TideTrace is an application scaffold with a React frontend, a Node.js backend structure, and SQL placeholders for Supabase. The planned modules cover tides, traces, contributions, notifications, moderation, and administration.

## Current status.

The frontend currently renders a **TideTrace** heading. Most feature files are empty placeholders:

- Authentication, user, moderator, and admin pages are not implemented.
- Frontend API modules and route protection are not connected.
- Backend routes, controllers, middleware, and services are not implemented. The server entry point calls a placeholder function and does not start an HTTP server.
- The Supabase client is `null`; migrations, seed data, and storage policies are empty.
- Shared component, hook, and utility directories are reserved for future implementation.

## Technology

- **Frontend:** React 19 and Vite 8, with React Compiler configured.
- **Linting:** ESLint with React Hooks and React Refresh rules.
- **Backend:** Node.js using ES modules; no backend dependencies are declared yet.
- **Database and storage:** Supabase is planned but not connected.
- **Styling:** Plain CSS is present. A Tailwind configuration exists, but Tailwind dependencies and build integration are not set up.

## Project structure

```text
TideTrace/
├── client/
│   ├── public/                 Static assets
│   ├── src/
│   │   ├── api/                Auth, admin, tides, traces, notifications
│   │   ├── components/
│   │   │   ├── admin/
│   │   │   ├── common/
│   │   │   ├── moderation/
│   │   │   ├── tides/
│   │   │   └── traces/
│   │   ├── hooks/              Shared React hooks
│   │   ├── pages/
│   │   │   ├── admin/
│   │   │   ├── auth/
│   │   │   ├── moderator/
│   │   │   └── user/
│   │   ├── routes/             App routing and protected routes
│   │   ├── utils/              Frontend utilities
│   │   ├── App.jsx             Root component
│   │   ├── main.jsx            React entry point
│   │   └── index.css           Global styles
│   ├── index.html
│   ├── tailwind.config.js
│   └── vite.config.js
├── server/
│   ├── src/
│   │   ├── config/             Supabase client placeholder
│   │   ├── controllers/        Request handling by domain
│   │   ├── middleware/         Auth, roles, errors, uploads
│   │   ├── routes/             API route modules
│   │   ├── services/           Notifications and storage
│   │   ├── utils/              Backend utilities
│   │   ├── app.js              Application factory placeholder
│   │   └── server.js           Backend entry point
│   └── package.json
├── supabase/
│   ├── migrations/             Ten SQL placeholders
│   ├── seed.sql
│   └── storage-policies.sql
├── .env.example
├── .gitignore
├── eslint.config.js
├── package-lock.json
├── package.json                Frontend dependencies and scripts
└── README.md
```

Frontend dependencies are managed from the project root. The backend has a separate package manifest under `server/`. Vite uses `client/` as its root and generates build output in `client/dist/`.

The SQL placeholders cover `profiles`, `tides`, `traces`, `trace_media`, `categories`, `comments`, `reports`, `trace_reviews`, `notifications`, and `settings`. They do not yet define a database schema or migration execution order.

## Getting started

Install Node.js and npm using versions compatible with the dependencies in `package-lock.json`. Run these commands from the project root:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. The current application displays the TideTrace heading.

## Available commands

Run these commands from the project root:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the frontend development server. |
| `npm run build` | Build the frontend into `client/dist/`. |
| `npm run preview` | Preview an existing frontend build locally. |
| `npm run lint` | Run ESLint against `client/`. |
| `npm --prefix server run dev` | Run the backend placeholder in Node.js watch mode. |
| `npm --prefix server start` | Execute the backend placeholder once. |

Backend commands do not currently expose an API. No automated test scripts are configured, and the root lint command does not cover the backend.

## Environment configuration

`.env.example` currently contains only a comment; no required environment variables have been defined. Supabase configuration and environment loading still need implementation.

Before adding credentials, define the required variable names in the environment template and configure ignore rules for local secret files. The current `.gitignore` does not exclude `.env`.

## Next implementation steps

1. Define the database schema, migration order, and access policies.
2. Configure backend dependencies, environment loading, and the Supabase client.
3. Implement API routes, authentication, authorization, and error handling.
4. Connect frontend routing, API modules, and role-specific pages.
5. Build shared components and choose the styling setup.
6. Add backend linting and tests for implemented behavior.

## User flow diagram
<img width="10471" height="5822" alt="Tide Trace_userflow" src="https://github.com/user-attachments/assets/c45946a1-d19d-4206-ac75-3bc93f1c68ca" />

## Moderator flow diagram 
<img width="11642" height="5948" alt="Tide Trace_moderatorflow" src="https://github.com/user-attachments/assets/a7cfc215-6886-4aaa-bd38-b4e0be2e2e6e" />

## Admin flow diagram
<img width="11592" height="5542" alt="Tide Trace_adminflow" src="https://github.com/user-attachments/assets/91089c27-a687-4e64-b97a-1486f845c59a" />

## Entity-Relationship Diagram
<img width="7822" height="5792" alt="Database ERD Diagram" src="https://github.com/user-attachments/assets/984b36d1-d11c-4b57-8865-3d44b24876c1" />

## System Architecture Diagram
<img width="15185" height="6833" alt="System Architecture" src="https://github.com/user-attachments/assets/42473242-d54a-4fa4-986a-de661b3f1204" />


## UPDATES ##
## A. Foundation & Architecture ##
## v1.0 — Initial Prototype ##

Built the (User, Moderator, Admin) from the approved flowcharts. It covers the full journey: login, dashboard, traces, tides, contributions, notifications, and settings. All roles share one simulated data layer, so actions in one role visibly affect the others. For example, a user's submitted trace appears instantly in the moderator's review queue. A confirmation modal and toast system gives feedback for every action.

## v1.1 — Homepage & Navigation ##
Added the homepage directly into it so the flow starts from a public landing page. It includes the hero, mission, feature pillars, impact stats, and call-to-action sections. The navigation bar was upgraded with icons next to each link and stays centered at the top. When logged out, visitors see the public nav with Log in and Join buttons. The homepage CTAs are flow-aware, sending users to login or straight into the app depending on their state.

## v1.2 — Complete Role Flows ##
Built out the full Moderator and Admin experiences to match the flowcharts. Moderators get a review queue, decision cards, flagged comments, reports, and analytics. Admins manage users, moderators, Tides content, moderation history, system settings, and platform analytics. Every decision updates the shared data, so the user sees status changes and notifications immediately. Admin actions like publishing content also trigger notifications for users.

##v1.3 — Animations ##
Added smooth fade-in animations across the entire prototype. Every page opens with a gentle fade and a staggered content cascade. Wizard steps, settings tabs, and modals also transition cleanly. The animations are CSS-only, so they replay each time a page opens without extra JavaScript. A reduced-motion setting is respected for accessibility.

##v1.4 — Security Features ##
Added 6-digit email verification (OTP) when logging in or registering. The code appears in a simulated inbox for demo purposes, with a live 5-minute expiry timer and resend option. The input boxes auto-advance, support pasting, and auto-submit when complete. Also added a change-password feature in Settings with a live strength meter and full validation. Every password change is recorded in the Admin's system logs.
