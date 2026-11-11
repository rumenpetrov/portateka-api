# ADR 0004: Machine-Code Error Envelope and Portable Zod v4 Schemas

- **Status:** Accepted
- **Date:** 2026-11-11

## Context
`portateka-api` serves multilingual clients (`portateka-web` supports `en-US` and `bg-BG`). Hardcoding English human-readable error strings in API responses or Zod schemas forces clients to parse brittle text or duplicates validation logic across backend and frontend repositories.

## Decision
1. **Uniform Response Envelopes (`src/helpers/responses.ts`, `src/helpers/errors.ts`):**
   - Success responses always use `ok(c, data)` $\rightarrow$ `{ data, ...extra }`.
   - Error responses always throw `ApiError` (or subclasses `NotFoundApiError`, `ValidationApiError`, `DuplicateApiError`, `InternalServerApiError`) caught by `app.onError` and formatted via `bad()` $\rightarrow$ `{ code: ErrorCode, resource?: Resource, params?: Record<string, string> }`.
2. **Short Machine Codes in `params` (`src/validators/validate.ts`):**
   - Validate request JSON and route parameters with `validateJson(schema, resource)` and `validateParams(schema, resource)`.
   - Every Zod validation rule emits a short machine code (`required`, `invalid_type`, `too_long`, `invalid_email`, `invalid_uuid`, `password_too_short`, etc.), and `formatIssues` maps each invalid field to its first machine code (`params[field] ??= issue.message`).
3. **Copy-Pasteable Zod v4 Schemas (`src/validators/*`):**
   Keep `src/validators/authValidators.ts` and `src/validators/propertyValidators.ts` free of backend-only dependencies inside the schema definitions so they can be mirrored verbatim into `portateka-web/src/validators/*`.

## Consequences
- **Positive:** Complete separation of backend validation logic from UI localization; 100% portable Zod v4 schemas between `portateka-api` and `portateka-web`; predictable error contract documented in `docs/ERRORS.md`.
- **Negative / Trade-offs:** Adding a new error code, resource, or field machine code requires updating `docs/ERRORS.md` and adding corresponding translations in the frontend locale dictionaries.
