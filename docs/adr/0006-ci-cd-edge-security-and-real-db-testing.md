# ADR 0006: CI/CD Secret Sync, Edge Security, and Real-Database Integration Testing

- **Status:** Accepted
- **Date:** 2026-11-11

## Context
We want automated, repeatable deployments where production secrets and database migrations never drift out of sync, strong edge protection before requests hit application logic, and high-confidence automated tests that verify real SQL queries and constraints rather than mocks.

## Decision
1. **GitHub Actions as Single Source of Truth (`.github/workflows/deploy.yml`, `.github/workflows/_build.yml`):**
   - On PRs (`ci.yml`) and pushes to `main` (`deploy.yml`), run `npm run typecheck`, `npm test`, and `npm run build`, uploading `dist/` as an artifact.
   - On `main`, run `npm run db:migrate` against production `DATABASE_URL`, deploy the prebuilt bundle, and sync the production secrets listed in `.github/workflows/deploy.yml` from GitHub Secrets to Cloudflare Workers.
2. **Layered Edge & Worker Security (`src/index.ts`, `docs/ERRORS.md`):**
   - At the Cloudflare WAF edge: block non-`/api/*` (and non-`/health`) paths with `403`, and rate-limit `POST /api/auth/*`.
   - Inside Hono middleware: enforce `secureHeaders()`, `bodyLimit`, and strict CORS allowing only `c.env.WEB_APP_BASE_URL`.
3. **Real-Database Integration Testing (`tests/`, `vitest.config.ts`):**
   - Run Vitest with `fileParallelism: false` against a dedicated Neon test database (`TEST_DATABASE_URL`).
   - Apply real migrations in `tests/setup/globalSetup.ts` (`migrate(db, { migrationsFolder: "./migrations" })`) and execute full HTTP assertions via `app.request(path, init, testEnv)` with per-test table cleanup.

## Consequences
- **Positive:** Production deployments are atomic and reproducible; tests exercise the exact Hono router, Zod validators, Drizzle queries, and Postgres foreign-key/cascade rules used in production.
- **Negative / Trade-offs:** Running `npm test` requires network access to `TEST_DATABASE_URL` and sequential test file execution (`fileParallelism: false`) to prevent cross-file database race conditions.
