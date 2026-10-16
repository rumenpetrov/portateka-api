# Agent Guidelines (`portateka-api`)

## Agent Persona & Workflow
- **Style:** Direct, concise, zero conversational filler. Explain the "why" and trade-offs behind non-obvious technical decisions in 1–3 short bullets.
- **Design philosophy:** Prefer simple, explicit, readable code over clever abstractions (KISS, YAGNI). Reuse existing project helpers (`ok`, `bad`, `ApiError`, `validateJson`) before introducing new ones, and extract new shared utilities only when a pattern genuinely repeats.
- **Step-by-step execution:** Break work into small, independently verifiable steps:
  1. **Inspect (read-only):** Read relevant files first so the plan fits the existing codebase.
  2. **Plan & teach:** Present a short plan for the current step, explain the key concepts/trade-offs, highlight any decisions for the user, and **stop for explicit confirmation before creating or modifying any files, installing packages, or resetting/destroying local database state (`db:reset`, `db:seed`)**.
  3. **Execute & verify:** After confirmation, apply the changes and verify them (`npm run typecheck` and a quick runtime/endpoint check) before moving to the next step.

## Runtime & Stack
- **Platform:** Cloudflare Workers (`wrangler.jsonc`, entry `src/index.ts`).
- **Framework:** Hono typed with `AppEnv` (`src/types/env.ts` — binds `CloudflareBindings` and context `Variables`).
- **Database:** Neon Serverless Postgres (`@neondatabase/serverless` HTTP driver) + Drizzle ORM (`src/db/index.ts`, `src/db/schema.ts`).
- **Validation:** Zod v4 + `@hono/zod-validator`.

## Cloudflare Workers Rules
- **Per-request bindings:** Read environment secrets from `c.env` inside handlers or middleware (`getDb(c.env.DATABASE_URL)`, `c.env.JWT_SECRET`). Module top-level has no access to bindings.
- **Stateless DB client:** Call `getDb(c.env.DATABASE_URL)` per request. The `neon-http` driver executes stateless HTTPS queries.
- **Web-standard crypto:** Use WebCrypto (`crypto.subtle` PBKDF2-SHA256 at `100,000` iterations in `src/utils/password.ts`, constant-time comparison via `crypto.subtle.timingSafeEqual`) and `jose` (`src/utils/jwt.ts`) for HS256 JWTs.
- **Generated types:** Runtime and binding types live in `worker-configuration.d.ts`. Run `npm run cf-typegen` after changing bindings in `.env` or `wrangler.jsonc`, then verify with `npm run typecheck`.

## API, Validation & Error Conventions
- **Success responses:** Return data with `ok(c, data)` or `ok({ c, status: 201 }, data)` from `src/helpers/responses.ts` (produces `{ data, ...extra }`).
- **Errors:** Throw `ApiError` or its subclasses (`NotFoundApiError`, `ValidationApiError`, `DuplicateApiError`) from `src/helpers/errors.ts`. `app.onError` in `src/index.ts` catches them and formats `{ code, resource?, params? }` via `bad()`.
- **Resources:** Register every new domain resource name in the `RESOURCES` tuple in `src/helpers/errors.ts`.
- **Validation & machine codes:** Validate JSON bodies with `validateJson(schema, resource)` (`src/validators/authValidators.ts`) and read validated output with `c.req.valid("json")`. All field error values in `params` (`Record<string, string>`) must be short machine codes (e.g., `required`, `invalid_email`, `password_too_short`, `already_exists`) so the client handles translations.
- **Authentication:** Protect routes or routers with `requireAuth` (`src/middleware/auth.ts`) and read the authenticated user payload (`{ sub, email, username }`) via `c.get("user")`.

## Database & Environment Workflow
- **Local secrets:** Keep local secrets in `.env` (copied from `.env.example`, loaded by both Wrangler and `drizzle.config.ts` via `dotenv/config`). Keep `.env` as the sole local env file (creating `.dev.vars` would cause Wrangler to ignore `.env`).
- **Schema conventions:** Always define timestamps with `timestamp("...", { withTimezone: true })`.
- **Migrations & Seeding:**
  - Rapid prototyping: `npm run db:push` syncs `src/db/schema.ts` directly to the dev database without generating migration files.
  - Committing schema changes: `npm run db:generate` writes SQL migrations to `migrations/`, followed by `npm run db:reset` $\rightarrow$ `npm run db:migrate` $\rightarrow$ `npm run db:seed` to verify the full migration chain locally.
  - **Destructive DB confirmation:** Always ask for explicit user confirmation before running `npm run db:reset`, `npm run db:seed`, or any command that drops tables or deletes data.
- **CI/CD & Production secrets:** `.github/workflows/deploy.yml` is the single source of truth for production secrets. On push to `main`, GitHub Actions runs `npm run db:migrate` and syncs secrets (`DATABASE_URL`, `JWT_SECRET`) to Cloudflare Workers. When adding a new secret binding, add the key to `.env.example`, set its value in `.env`, run `npm run cf-typegen`, and add it to the `secrets` list in `.github/workflows/deploy.yml`.
