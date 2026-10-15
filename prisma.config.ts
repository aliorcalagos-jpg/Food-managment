import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrations need a direct connection: poolers (PgBouncer, Neon's pooler) can't run
    // them reliably. DIRECT_URL is optional; without it, DATABASE_URL is used.
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"],
  },
});
