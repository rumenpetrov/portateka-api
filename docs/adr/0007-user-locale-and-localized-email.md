# ADR 0007: Stored User Locale as Source of Truth for Localized Emails

- **Status:** Accepted
- **Date:** 2026-11-12

## Context
The API returns machine codes and lets clients translate them (ADR 0004). Transactional emails are the exception: the API must render human-readable text itself, yet all emails were hardcoded in English. Some emails are sent without an active request from the user's browser (e.g. future scheduled notifications), and `forgot-password` is unauthenticated, so per-request `Accept-Language` alone cannot reliably determine the user's language. The web app already lets users choose `en-US` or `bg-BG`.

## Decision
1. **Persist `users.locale`** (`varchar(10) NOT NULL DEFAULT 'en-US'`, typed as `Locale` via Drizzle `$type`). Existing rows are backfilled with `en-US` by the column default.
2. **Validate in the app, not with a `pgEnum`:** `SUPPORTED_LOCALES` in `src/config.ts` drives `z.enum(..., { error: "invalid_locale" })`. Adding a locale requires a template file and a config entry, but no migration.
3. **Locale priority:**
   - **Existing user:** stored `users.locale` is the single source of truth; request headers are ignored.
   - **Sign-up:** body `locale` → `Accept-Language` best match (`src/utils/locale.ts`) → `DEFAULT_LOCALE`.
   - **Web app:** after sign-in, the server's `user.locale` overrides the browser's `localStorage` value; changing the language while signed in calls `PATCH /api/auth/me`.
4. **Typed templates without an i18n library:** `src/emails/<locale>.ts` implement `EmailTemplates`; `EMAIL_TEMPLATES: Record<Locale, EmailTemplates>` turns missing translations into compile errors. Expiry durations come from numeric `SYSTEM_CONFIG.*ExpiresInHours`, shared by JWT expiry and localized copy.
5. **Single Resend transport:** a private `sendEmail({ to, content, resendApiKey, devSummary })` in `src/utils/email.ts` owns the `fetch` call and the dev/test fallback (ADR 0005); public senders only pick the template.
6. **Not in the JWT:** `locale` is omitted from session tokens to avoid stale values for up to `8h` after a change.

## Consequences
- **Positive:** Emails match the user's chosen language on any device and for non-request-triggered sends; no new dependencies; compile-time completeness of translations.
- **Negative / Trade-offs:** Email copy lives in the API and must be kept in sync with the web app's supported locales manually; `en-US` backfill may mismatch the actual preference of existing Bulgarian users until they sign in (the web app then syncs) or change the language.
