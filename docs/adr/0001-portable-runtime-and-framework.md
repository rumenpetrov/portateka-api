# ADR 0001: Runtime Portability, Hono Framework, and Module Aliases

- **Status:** Accepted
- **Date:** 2026-11-11

## Context
We want to deploy `portateka-api` to **Cloudflare Workers** for fast global edge execution and zero cold-start overhead, while avoiding proprietary vendor lock-in so the application can run on standard **Node.js** or migrate to another hosting provider without rewriting business logic. We also want clean module imports across `src/` and `tests/`.

## Decision
1. **Hono Typed with `AppEnv` (`src/index.ts`, `src/types/env.ts`):**
   Use **Hono** built on Web Standard `Request`/`Response` APIs, typed with `AppEnv` (`Bindings: CloudflareBindings`, `Variables: AppVariables`).
2. **Runtime Portability (`nodejs_compat`):**
   Restrict all application code to standard Web APIs (`fetch`, `Request`, `Response`, `crypto.subtle`) and Node.js built-ins (`node:crypto`). Avoid Cloudflare-specific storage or proprietary runtime APIs in domain logic.
3. **Per-Request Environment Bindings:**
   Read secrets and configuration (`c.env.DATABASE_URL`, `c.env.JWT_SECRET`, `c.env.RESEND_API_KEY`) strictly inside request handlers or middleware rather than at module top-level, satisfying Workers' stateless isolate model.
4. **Path Aliases (`@/*` $\rightarrow$ `./src/*`):**
   Configure `"@/*": ["./src/*"]` in `tsconfig.json` and `vitest.config.ts` for all cross-directory imports in `src/` and `tests/`, while preserving relative `.ts` imports in standalone Node CLI scripts (`src/db/reset.ts`, `src/db/seed.ts`) that run directly via `node` without a bundler.

## Consequences
- **Positive:** Zero vendor lock-in; identical request/response handling in Cloudflare Workers, Vitest (`app.request(path, init, testEnv)`), and Node.js; clean `@/...` imports across routes, controllers, and tests.
- **Negative / Trade-offs:** Environment variables cannot be cached at module evaluation time and must be passed down from `c.env` per request.
