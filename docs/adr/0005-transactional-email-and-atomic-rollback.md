# ADR 0005: Transactional Email via Resend HTTP API, Dev Fallback, and Sign-Up Rollback

- **Status:** Accepted
- **Date:** 2026-11-11

## Context
Account registration and password reset require sending transactional emails containing verification and reset links pointing to `WEB_APP_BASE_URL`. We need a lightweight email integration that works in Cloudflare Workers, avoids burning email quotas during local development and automated tests, and never leaves a newly created user stranded if email delivery fails.

## Decision
1. **Direct Resend REST API via `fetch` (`src/utils/email.ts`):**
   Send emails via standard `fetch("https://api.resend.com/emails", ...)` with HTML-escaped user interpolations (`escapeHtml(firstName)`) instead of pulling in a third-party SDK.
2. **Zero-Quota Local & Test Fallback:**
   When `RESEND_API_KEY` is empty or omitted (in local `.env` or `testEnv`), skip the external HTTP call and log `[email:dev] To: ... | URL: ...` to the console.
3. **Compensating Rollback on Sign-Up Email Failure (`src/controllers/authController.ts`):**
   If sending the verification email fails during `POST /api/auth/sign-up/email`:
   - For a newly inserted user (`isNewUser === true`), immediately delete the newly created row from `users` before throwing `InternalServerApiError("user")`.
   - For an existing unverified user, allow them to retry sign-up at any time to update their details and trigger a fresh verification email.

## Consequences
- **Positive:** Zero SDK bundle overhead; local development and CI tests run offline without consuming Resend quota; failed email delivery on initial sign-up cleans up the user record cleanly.
- **Negative / Trade-offs:** Synchronous email sending during sign-up/forgot-password adds the latency of one external HTTPS call to Resend in production.
