 TideTrace

TideTrace is an application scaffold with a React frontend, a Node.js backend structure, and SQL placeholders for Supabase. The planned modules cover tides, traces, contributions, notifications, moderation, and administration.

## Current status

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

## UPDATES ##
A. Foundation & Architecture
v1.0 — The core build

Shared simulated data layer — TRACES, CONTRIBS, QUEUE, FLAGGED, REPORTS, USERS, MODS, TIDES, CATS, MODLOG, LOGS, NOTIFS all in one state; actions in one role visibly ripple into others (the signature feature)
Hash-free client-side router — go(view) with NAVPARENT mapping so detail pages highlight the right nav item
Modal + toast system — reusable confirmBox() promise-style confirmation, global toast feedback on every meaningful action
Role-based view access — user/mod/admin each see only their sections
