# Vercel + Render, shared Supabase

Local and deployed backends use the existing Supabase project. Database writes
and migrations affect both environments. Do not rerun the initial schema.

## Render backend

Connect the GitHub repository, branch `main`, Node runtime, repository root
(leave Root Directory blank). Build: `npm ci`. Start: `npm run start:server`.
Health check: `/api/health`. Set:

```dotenv
NODE_VERSION=22
NODE_ENV=production
HOST=0.0.0.0
TRUST_PROXY_HOPS=1
CLIENT_ORIGIN=https://YOUR-FRONTEND.vercel.app
SUPABASE_URL=https://YOUR-EXISTING-PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR-EXISTING-PUBLISHABLE-OR-ANON-KEY
```

Render supplies `PORT`. Use the actual stable frontend origin once Vercel is
deployed, then redeploy Render. Never use a privileged Supabase secret/service-role
key. Verify `/api/health` and `/api/ready` at the generated backend URL.

`TRUST_PROXY_HOPS=1` trusts the immediate reverse proxy. Keep `0` locally.
Verify client IP handling on the hosted service before sharing it; reconsider
the hop count if adding a CDN/proxy or another path to the server. Do not enable
unconditional proxy trust. Rate-limit counters are per instance, so start with
one backend instance; multiple instances require a shared rate-limit store.

## Vercel frontend

Import the same repository. Use repository root `./`, Vite preset, Node 22.x,
and production branch `main`. The root `vercel.json` sets install `npm ci`,
build `npm run build`, output `client/dist`, and the SPA fallback.

Set this variable in the Production environment before building:

```dotenv
VITE_API_URL=https://YOUR-ACTUAL-BACKEND.onrender.com
```

Use an origin only, without `/api`, credentials, or query parameters. Changing it
requires rebuilding/redeploying the frontend. All `VITE_` values are public;
do not put secrets in them. Previews need their own API variable and explicitly
allowed frontend origin before authentication works.

## Supabase Auth and verification

In the existing project's Authentication URL Configuration, set Site URL to
the stable Vercel origin and allow:

```text
https://YOUR-FRONTEND.vercel.app/auth/callback
http://localhost:5173/auth/callback
http://127.0.0.1:5173/auth/callback
```

Keep existing accounts/admins. Verify email delivery, login, page refresh,
password recovery, a draft with a photo, submission, and review by another
staff account. The build and mocked tests do not verify these hosted services.

## Continued development

Leave `VITE_API_URL` unset locally (see `client/.env.example`) and retain the
localhost `CLIENT_ORIGIN` in `server/.env`. Run `npm run dev` and
`npm run dev:server` in separate terminals. Test with `npm test` and
`npm run build`, then commit/push ready changes to `main` to trigger configured
automatic deployments. Frontend and backend deploy independently; preserve API
compatibility during releases. Back up important shared data before destructive
database changes.
