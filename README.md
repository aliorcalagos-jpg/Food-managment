# Food-managment

Household meal planning and shopping lists. Plan the week's meals from saved recipes, then generate a merged shopping list.

Stack: Next.js (App Router) + TypeScript + Tailwind, Prisma 7 + Postgres.

## Local setup

```bash
cp .env.example .env         # then set SESSION_SECRET (openssl rand -base64 32)
docker compose up -d db      # or any local Postgres matching DATABASE_URL
npm install                  # also runs `prisma generate`
npx prisma migrate dev
npm run dev
```

## Checks

```bash
npm run lint && npm run typecheck && npm test   # needs the database running
npm run test:e2e                                 # Playwright; starts/reuses `npm run dev`
npm run build && E2E_PROD=1 npm run test:e2e     # the same tests against a production build
```

## Auth

Email + password. Passwords are hashed with bcrypt; sessions are signed JWTs in an HttpOnly cookie
(`jose`), following the Next.js authentication guide. `proxy.ts` only does optimistic redirects:
every page and Server Action re-checks the session and household membership via `lib/dal.ts`.

Login and signup are rate limited (stored in Postgres, so it holds across serverless instances):
10 login attempts per 15 minutes per IP and account, 50 per IP, and 10 signups per hour per IP.
The IP comes from `X-Forwarded-For`, which is only trustworthy behind a proxy that overwrites it
(Vercel does). Behind your own proxy, make sure it does too.

Known gaps: no email verification or password reset yet.

`lib/ingredients.ts` holds the unit-normalizing ingredient merge used for shopping lists.

## Deploying (Vercel + managed Postgres)

The app is a standard Next.js app with a Postgres database, so any host that runs Next.js works.
These steps use Vercel.

1. **Database.** Create a Postgres database with any provider (Neon, Supabase, Vercel Marketplace, ...).
   Note two connection strings: the *pooled* one for the app and the *direct* one for migrations
   (if your provider only gives one, use it for `DATABASE_URL` and skip `DIRECT_URL`).
2. **Project.** Import the repo into Vercel. Node 22 is picked up from `package.json`. Defaults are fine:
   `npm install` runs `prisma generate`, and `next build` builds the app.
3. **Environment variables** (Project Settings, Environment Variables):

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | pooled connection string, `sslmode=require` |
   | `DIRECT_URL` | direct connection string (optional, used only for migrations) |
   | `SESSION_SECRET` | output of `openssl rand -base64 32`, unique per environment |
   | `DATABASE_POOL_MAX` | optional, default 5 |

4. **Migrate before the first deploy, and before any deploy that adds a migration.** Either run
   `DATABASE_URL=... npx prisma migrate deploy` from your machine, or use the manual GitHub Action
   *Migrate production database* (needs repository secrets `DATABASE_URL` and optionally `DIRECT_URL`, under an
   environment named `production`). Migrations are not run during the Vercel build on purpose: preview
   deployments would otherwise migrate the production database.
5. **Previews.** Give Preview deployments their own database; don't reuse production's variables there.
6. **Check it.** `GET /api/health` returns `{"status":"ok"}` (HTTP 200), or 503 if the database is unreachable.
   Point an uptime monitor at it. Place the Vercel function region near the database.
7. **Backups.** Turn on point-in-time recovery or scheduled backups in your database provider.

Security notes: responses carry `X-Frame-Options`, `Referrer-Policy`, `nosniff`, HSTS and a CSP limited to
framing / `<base>` / forms / plugins. A script-src CSP with nonces needs every page rendered per request, which
conflicts with the prerendered pages used here, so it is not enabled.

Self-hosting: `npm ci && npx prisma migrate deploy && npm run build && npm start` behind an HTTPS proxy.
