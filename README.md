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

## Hosted version (claude.ai Artifact)

A single-user version of the app runs as a private page on claude.ai, with no server or database to run:
https://claude.ai/artifact/7Y6W3zydkv5T6bH1vcgyZ9 (readable only by its owner).

- Source is in `artifact/`: React 18 (pinned UMD from cdnjs) bundled with esbuild into one HTML fragment.
  It reuses the tested logic from `lib/` (ingredient merging, fractions, dates, aisle categories, list building).
- Data lives in the artifact's own `db` (collections `recipes`, `week` per Monday, `lists`, `meta`), under a rule that only the
  owner can read or write. Sign-in is your claude.ai account, so there is no signup, household or rate limiting here.
- `npm run build:artifact` writes `artifact/dist/meal-planner.html`; publish that file with the Artifact tool.
- `npm run test:artifact` runs the built page in Playwright against an in-memory fake of the `db` runtime
  (`artifact/e2e/harness.ts`), including slow and failing saves. The pinned React copies in
  `artifact/test/vendor/` exist only to answer the page's cdnjs requests offline.
- Arabic and English: a switch in the header (default Arabic, right-to-left; the choice is saved in the artifact `db`
  as `meta/settings`, so every device agrees). UI text lives in `artifact/src/i18n.ts` (a test keeps both tables in
  step). Stored data keeps English keys (`DINNER`, `Produce`, `kg`), so nothing depends on the language.
- Arabic matching (shared with the Next app, in `lib/arabic.ts`): أرز / ارز / رز / الأرز are one ingredient on a list
  (the first spelling written is shown), Arabic unit words (كيلو، جم، كوب، ملعقة كبيرة ...) merge with their English
  equivalents, Arabic digits (٢) and the comma (،) are accepted, and aisles are guessed from Arabic names. Matching is
  deliberately simple: no plurals or word roots, so two different spellings of the same word (e.g. بامية / بامياء)
  stay separate lines.
- Food spending (Expenses tab, shown first): prices live on shopping-list items and everything is computed from the
  lists, so there is no separate expense log. A price is the cost of the whole line, typed in naira or US dollars at a
  fixed rate (default 1380 NGN per USD; amounts are stored as whole naira kobo, so USD is only a display and entry
  convenience). Ticked priced items count as *spent*, unticked priced items as *planned*. A list counts towards the
  Monday-to-Sunday week of its "shopped on" date. The tab shows the week's total against a weekly budget (on track
  below 80%, close to the limit from 80% or when planned items would go over, over budget above 100%), spending by
  aisle, the last 8 weeks with the budget line, and the week's trips. Settings (`meta/settings`) hold the language,
  currency, rate and budget and are always merged, never replaced. Logic: `lib/money.ts`, `artifact/src/spending.ts`.
- This week tab (second, after Expenses): every saved food is a tap row; tap the ones you will cook, set servings with
  the stepper (it defaults to what the recipe makes), and the *What to buy* panel updates at once, merged across foods
  and grouped by aisle. Each week has its own selection (`week/<Monday>`: `{ picks, listId }`). *Start shopping* saves a
  snapshot list ("Shopping <date>", with the week as its range) and remembers it on the week; later changes to the
  selection do not alter that list, and pressing the button again makes a fresh one. Nothing is subtracted for what you
  already have at home. Logic: `buildBuyList` in `artifact/src/model.ts` (on top of `lib/list-build.ts`).
- Adding ingredients: type a line in the quick-add box ("2 كوب أرز", "500g flour", "1 1/2 cups of milk") and press Enter to
  get a filled, editable row; paste a whole list to add every line. Parsing lives in `lib/ingredient-line.ts` (shared):
  Arabic digits, `½`, decimal commas, attached units and two-word units are understood, an unknown unit word stays in the
  name, and a line without a number leaves the quantity empty (nothing is guessed). Enter in a row's name box starts the
  next row, and the name boxes suggest ingredient names already used in other foods (a quick-added name takes the existing
  spelling).
- A food can be saved with just a name and given ingredients later; the buy panel names the chosen foods it left out
  because they have no ingredients yet, with a jump to add them. The Servings field means how many servings the entered
  quantities make (default 1, one person).
- Limits: one person, data is separate from the Postgres app, no export yet, and the 25,000-document /
  256 KiB-per-document caps of artifact storage apply.

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
