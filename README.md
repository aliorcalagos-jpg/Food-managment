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
```

## Auth

Email + password. Passwords are hashed with bcrypt; sessions are signed JWTs in an HttpOnly cookie
(`jose`), following the Next.js authentication guide. `proxy.ts` only does optimistic redirects:
every page and Server Action re-checks the session and household membership via `lib/dal.ts`.

Known gaps: no login rate limiting or email verification / password reset yet.

`lib/ingredients.ts` holds the unit-normalizing ingredient merge used for shopping lists.
