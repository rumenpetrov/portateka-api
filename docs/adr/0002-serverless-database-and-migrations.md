# ADR 0002: Stateless Serverless Postgres, Drizzle ORM, and Schema Design

- **Status:** Accepted
- **Date:** 2026-11-11

## Context
Serverless edge isolates (Cloudflare Workers) are ephemeral and cannot maintain long-lived TCP connection pools across requests. Additionally, our domain requires each user to have at most one "preferred property" (`users.preferredPropertyId`) that automatically sets on first property creation and cleans up if that property is deleted.

## Decision
1. **Stateless Neon HTTP Driver (`src/db/index.ts`):**
   Use `@neondatabase/serverless` (`neon(databaseUrl)`) wrapped with **Drizzle ORM** (`drizzle-orm/neon-http`), calling `getDb(c.env.DATABASE_URL)` per request to execute stateless one-shot HTTPS queries.
2. **Single-Column Preferred Property (`src/db/schema.ts`):**
   Model the user's preferred property as a nullable foreign key `users.preferred_property_id` referencing `properties.id` with `ON DELETE SET NULL` (typed via Drizzle's `AnyPgColumn` to resolve the circular table reference between `users` and `properties`).
3. **Two-Phase Migration Discipline (`drizzle-kit`):**
   - Allow `npm run db:push` only for rapid local schema prototyping.
   - Lock in final schema changes via `db:generate` $\rightarrow$ `db:reset` $\rightarrow$ `db:migrate` $\rightarrow$ `db:seed` locally, and treat `migrations/` as read-only outputs of `drizzle-kit generate`.
   - Never mix `db:push` and `db:migrate` on the same database state because `db:push` mutates tables without recording entries in `drizzle.__drizzle_migrations`.

## Consequences
- **Positive:** No connection pool exhaustion on serverless isolates; `users.preferred_property_id` guarantees at most one preferred property per user at the database level without multi-row updates or partial unique indexes, and Postgres clears it automatically via `ON DELETE SET NULL` when a property is deleted.
- **Negative / Trade-offs:** Interactive multi-statement TCP transactions are not available over the stateless `neon-http` driver, so multi-step writes must be designed as idempotent or compensating queries.
