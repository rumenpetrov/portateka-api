# Domain & Business Rules (`portateka-api`)

## Users & Authentication (`users`)

### Registration & Email Verification

- **Default verification state:** Every newly registered user (`POST /api/auth/sign-up/email`) starts with `emailVerified = false`.
- **Enumeration-safe sign-up response:** `POST /api/auth/sign-up/email` always returns `200 OK` with `{ data: { message: "verification_email_sent" } }` so callers cannot determine whether an email is already registered:
  - **New email:** Inserts the user (`emailVerified = false`) and sends the verification email.
  - **Existing unverified email (`emailVerified = false`):** Updates the user's name/password and resends a fresh verification email.
  - **Existing verified email (`emailVerified = true`):** Performs password hashing for constant-time protection, sends **no email** (avoiding spam and preserving Resend quota), and returns the same `{ data: { message: "verification_email_sent" } }` response.
- **Verification email delivery & atomic rollback:** Upon sign-up, the API generates a signed HS256 JWT verification token (`purpose: "email_verification"`, valid for `24h`, embedding a 16-character `pwdHashSlice` of the password hash created during that sign-up) and sends a link (`${WEB_APP_BASE_URL}${WEB_APP_VERIFY_EMAIL_PREFIX}?token=...`) to the user's email address via Resend (`RESEND_API_KEY`). If sending the verification email fails for a newly created user, that user row is immediately deleted from `users` and the endpoint returns `500 INTERNAL_SERVER_ERROR` (`resource: "user"`).
- **Local/Test fallback:** When `RESEND_API_KEY` is empty or omitted (local development and automated tests), the API skips the external HTTP request and logs the verification link to the console so no Resend quota is consumed.
- **Email verification (`POST /api/auth/verify-email`):** Accepts `{ token }` from the frontend, verifies the JWT signature, expiration, `purpose: "email_verification"` claim, and that `pwdHashSlice` matches the user's current password hash (preventing an older verification link from verifying an account whose unverified password was overwritten), and sets `emailVerified = true` on the matching user.
- **Sign-in guard (`POST /api/auth/sign-in/email`):** After verifying email and password credentials, if `user.emailVerified === false`, sign-in is rejected with `403 FORBIDDEN` (`resource: "user"`, `params: { email: "email_not_verified" }`). Session JWTs expire in `8h`.

### Password Reset & Change

- **Enumeration-safe forgot-password (`POST /api/auth/forgot-password`):** Always returns `200 OK` with `{ data: { message: "password_reset_email_sent" } }`. If the email exists, sends a reset link (`${WEB_APP_BASE_URL}${WEB_APP_RESET_PASSWORD_PREFIX}?token=...`) with a signed JWT (`purpose: "password_reset"`, valid for `1h`). If the email does not exist, no email is sent and the same response is returned.
- **Single-use stateless reset token (`POST /api/auth/reset-password`):** The reset JWT embeds a 16-character slice of the user's current password hash (`pwdHashSlice`). When `POST /api/auth/reset-password` updates the user's password hash (and sets `emailVerified = true`), the embedded `pwdHashSlice` no longer matches the new password hash, automatically invalidating the token against reuse without requiring database token storage.
- **Authenticated password change (`POST /api/auth/change-password`):** Authenticated users can change their password by providing `{ currentPassword, newPassword }`. `newPassword` must satisfy the standard password strength rules and differ from `currentPassword` (otherwise `422 VALIDATION_ERROR` with `params: { newPassword: "password_same_as_current" }`). If `currentPassword` does not match the stored hash, returns `422 VALIDATION_ERROR` with `params: { currentPassword: "invalid_password" }`. Updating the password hash also automatically invalidates any outstanding `password_reset` tokens via `pwdHashSlice`.

### Profile Updates & Account Deletion (`PATCH /api/auth/me`, `DELETE /api/auth/me`)

- Authenticated users can partially update their profile (`firstName`, `lastName`, `preferredPropertyId`, `locale`) via `PATCH /api/auth/me`. `lastName` and `preferredPropertyId` can also be set to `null`.
- Authenticated users can permanently delete their account via `DELETE /api/auth/me`:
  - Deletes the row from `users` (which automatically deletes all of the user's `properties` via `ON DELETE CASCADE`) and returns `204 No Content`.
  - Sends a best-effort confirmation email (`sendAccountDeletedEmail`) notifying the user that their account and associated data have been deleted. If the email provider fails after the database deletion succeeds, the error is logged and the endpoint still returns `204 No Content`.

### Preferred Language (`users.locale`) & Localized Emails

- **Supported locales:** `SUPPORTED_LOCALES = ["en-US", "bg-BG"]` and `DEFAULT_LOCALE = "en-US"` in `src/config.ts` (BCP 47 tags, identical to the web app's `SupportedLocale`). Any other value is rejected with `422 VALIDATION_ERROR` (`params: { locale: "invalid_locale" }`).
- **Storage:** Every user has a non-null `users.locale` (`varchar(10)`, `DEFAULT 'en-US'`). Users that existed before the column was introduced were backfilled with `en-US`.
- **Source of truth (highest priority):** Once a user exists, the stored **`users.locale` is the single source of truth** for all server-generated content (verification, password reset, and account-deleted emails, and any future notifications). Request headers (`Accept-Language`) are **never** consulted for existing users — e.g. `POST /api/auth/forgot-password` always emails in the stored locale.
- **Initial value at sign-up (`POST /api/auth/sign-up/email`)**, in priority order:
  1. `locale` in the JSON body (the web app always sends it from a required, pre-filled language field).
  2. Best match from the `Accept-Language` header (exact tag, then primary language, e.g. `bg` → `bg-BG`; q-values respected).
  3. `DEFAULT_LOCALE` (`en-US`).
  - Re-signing up with an existing **unverified** email overwrites the stored locale with the newly resolved value (same as name/password).
- **Changing the preference:** Authenticated users update it via `PATCH /api/auth/me` with `{ locale }`. The new value applies to every email sent afterwards.
- **Exposure:** `locale` is returned in the user object of `POST /api/auth/sign-in/email`, `POST /api/auth/verify-email`, `GET /api/auth/me`, and `PATCH /api/auth/me` so clients can align their UI language with the stored preference. It is **not** embedded in session JWTs (it would go stale after a change).
- **Templates:** Each locale implements the `EmailTemplates` interface in `src/emails/<locale>.ts`; `EMAIL_TEMPLATES: Record<Locale, EmailTemplates>` makes a missing translation a compile-time error.

---

## Properties (`properties`) & Preferred Property (`users.preferredPropertyId`)

### Ownership & Isolation

- Every property belongs to a single user (`userId` references `users.id` with `ON DELETE CASCADE`).
- A user can only list, view, create, update, or delete their own properties. Accessing or mutating another user's property returns `404 NOT_FOUND` (`resource: "property"`).
- `GET /api/properties` returns the authenticated user's properties ordered by `createdAt` descending (newest first).

### Preferred Property Rules

- **Single source of truth on `users`:** Each user has a nullable `preferredPropertyId` column (`users.preferred_property_id`) referencing `properties.id` with `ON DELETE SET NULL`.
- **At most 1 preferred property:** Because `preferredPropertyId` is a single column on `users`, a user can have at most 1 preferred property at any time without requiring multi-row updates or partial unique indexes on `properties`.
- **Automatically set when `preferredPropertyId` is `null`:** When a user creates a property (`POST /api/properties`) and their `preferredPropertyId` is currently `null` (e.g., their first property, or after deleting/clearing a previous preferred property), `users.preferredPropertyId` is automatically set to the newly created property's `id`. If the user already has a `preferredPropertyId`, creating additional properties leaves it unchanged.
- **Setting, switching, or clearing:** Authenticated users update `preferredPropertyId` via `PATCH /api/auth/me` with `{ preferredPropertyId: "<uuid>" | null }`:
  - Passing a UUID verifies that the property exists and belongs to the authenticated user (returns `404 NOT_FOUND` on `property` if not) and sets `users.preferred_property_id`.
  - Passing `null` clears the user's preferred property.
- **Automatic cleanup on property deletion:** If the user deletes the property referenced by `preferredPropertyId` (`DELETE /api/properties/:id`), Postgres automatically sets `users.preferred_property_id` to `NULL` via `ON DELETE SET NULL`.
