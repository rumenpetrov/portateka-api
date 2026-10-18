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

### Password Reset
- **Enumeration-safe forgot-password (`POST /api/auth/forgot-password`):** Always returns `200 OK` with `{ data: { message: "password_reset_email_sent" } }`. If the email exists, sends a reset link (`${WEB_APP_BASE_URL}${WEB_APP_RESET_PASSWORD_PREFIX}?token=...`) with a signed JWT (`purpose: "password_reset"`, valid for `1h`). If the email does not exist, no email is sent and the same response is returned.
- **Single-use stateless reset token (`POST /api/auth/reset-password`):** The reset JWT embeds a 16-character slice of the user's current password hash (`pwdHashSlice`). When `POST /api/auth/reset-password` updates the user's password hash (and sets `emailVerified = true`), the embedded `pwdHashSlice` no longer matches the new password hash, automatically invalidating the token against reuse without requiring database token storage.

---

## Properties (`properties`)

### Ownership & Isolation
- Every property belongs to a single user (`userId` references `users.id` with `ON DELETE CASCADE`).
- A user can only list, view, create, update, or delete their own properties. Accessing or mutating another user's property returns `404 NOT_FOUND` (`resource: "property"`).

### Preferred Property Rules
- **Single preferred property:** A user can have **at most 1** property with `preferred = true` at any time. Enforced at the database level via the partial unique index `properties_user_preferred_idx` on `(user_id) WHERE preferred = true`.
- **0 preferred properties:** Allowed when the user has 0 properties, when they delete their preferred property, or when they have more than 1 property and explicitly unset `preferred` (`preferred: false`).
- **First property is always preferred:** When a user has `0` existing properties and creates a new property, `preferred` is automatically set to `true` (regardless of whether `preferred` was omitted or passed as `false`).
- **Switching preferred property:** When a user creates or updates (`PATCH`) a property with `preferred: true`, any previously preferred property belonging to that user is automatically updated to `preferred: false`.
- **Unsetting preferred on a single property is disallowed:** If a user has only `1` property in total, they cannot `PATCH` it with `preferred: false` (returns `422 VALIDATION_ERROR` on `property` with `{ preferred: "cannot_unset_only_property" }`). Unsetting `preferred: false` is only allowed when the user has more than 1 property.

