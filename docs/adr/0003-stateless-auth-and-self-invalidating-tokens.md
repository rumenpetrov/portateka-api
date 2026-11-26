# ADR 0003: WebCrypto PBKDF2, Stateless Self-Invalidating JWTs, and Enumeration Defense

- **Status:** Accepted
- **Date:** 2026-11-11

## Context
Authentication endpoints (`/api/auth/*`) must run within Cloudflare Workers' CPU limits using portable APIs, protect against timing and account-enumeration attacks, and support single-use email verification and password reset tokens without maintaining a stateful tokens table in Postgres.

## Decision
1. **Portable Password Hashing (`src/utils/password.ts`):**
   Hash passwords using standard WebCrypto `crypto.subtle` **PBKDF2-SHA256** with a per-password random salt and versioned hash format (parameters configured in `src/utils/password.ts`), and compare digests in constant time using `timingSafeEqual` from `node:crypto`.
2. **Timing & Account Enumeration Defense (`src/controllers/authController.ts`):**
   - On `POST /api/auth/sign-in/email`, always run `verifyPassword` against a constant `DECOY_HASH` when the email does not exist so response timing is indistinguishable from a wrong password.
   - On `POST /api/auth/sign-up/email` and `POST /api/auth/forgot-password`, always return `200 OK` with an identical success payload regardless of whether the email is new, unverified, or already verified.
3. **Stateless Purpose-Bound & Self-Invalidating JWTs (`src/utils/jwt.ts`):**
   - Sign all tokens with `jose` (`HS256`).
   - Session tokens omit `purpose` (and `verifyToken` rejects any JWT carrying a `purpose` claim so verification/reset tokens cannot be used as Bearer session tokens).
   - Email verification and password reset JWTs are short-lived (expiry configured in `SYSTEM_CONFIG`) and embed both a strict `purpose` claim (`"email_verification"` or `"password_reset"`) and `pwdHashSlice` (a trailing slice of the user's current password hash).

## Consequences
- **Positive:** Zero database tables or cron jobs needed to store or purge expired verification/reset tokens; changing a user's password immediately invalidates all previously issued password reset and verification links because `pwdHashSlice` no longer matches; callers cannot enumerate registered emails via status codes or timing.
- **Negative / Trade-offs:** Stateless session JWTs (expiry configured in `SYSTEM_CONFIG`) cannot be individually revoked before expiration unless the user's account is deleted or `JWT_SECRET` is rotated.
