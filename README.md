# Food-managment

Household meal planning and shopping lists. Plan the week's meals from saved recipes, then generate a merged shopping list.

Stack: Next.js (App Router) + TypeScript + Tailwind, Prisma 7 + Postgres.

## Local setup

```bash
cp .env.example .env
docker compose up -d db      # or any local Postgres matching DATABASE_URL
npm install                  # also runs `prisma generate`
npx prisma migrate dev
npm run dev
```

## Checks

```bash
npm run lint && npm run typecheck && npm test
```

`lib/ingredients.ts` holds the unit-normalizing ingredient merge used for shopping lists.
