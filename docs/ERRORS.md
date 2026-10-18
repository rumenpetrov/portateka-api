# Error Codes & Machine Keys (`portateka-api`)

All error responses are formatted by `bad()` in [`src/helpers/responses.ts`](../src/helpers/responses.ts) and follow the `ErrorResponse` shape:

```json
{
  "code": "VALIDATION_ERROR",
  "resource": "user",
  "params": {
    "email": "invalid_email"
  }
}
```

- `code` (required): Top-level `ErrorCode` determining the HTTP status code.
- `resource` (optional): Domain entity (`Resource`) associated with the error.
- `params` (optional): `Record<string, string>` containing either route context (for general errors like `NOT_FOUND`) or field-to-machine-code mappings (for form/validation errors).

---

## 1. General Errors (Top-Level API Errors)

### Error Codes (`ErrorCode`)

Defined in `ERROR_STATUS_MAP` ([`src/helpers/errors.ts`](../src/helpers/errors.ts)):

| `code` | HTTP Status | Error Class / Source | Meaning |
| :--- | :---: | :--- | :--- |
| `UNAUTHORIZED` | `401` | `ApiError("UNAUTHORIZED", "user")` | Missing, malformed, or expired Bearer token, invalid login credentials, or user no longer exists. |
| `FORBIDDEN` | `403` | `ApiError("FORBIDDEN", ...)` | Authenticated user lacks permission for the requested action. |
| `NOT_FOUND` | `404` | `NotFoundApiError` / `app.notFound` | Requested route or resource entry does not exist (or belongs to another user). |
| `ALREADY_EXISTS` | `409` | `DuplicateApiError` | Uniqueness constraint violation (e.g., registering with an existing email). |
| `VALIDATION_ERROR` | `422` / `400`* | `ValidationApiError` / `app.onError` | Request body, parameters, or domain invariant failed validation. (*Note: Malformed JSON body returns `code: "VALIDATION_ERROR"` with HTTP `422` via `bad(c, "VALIDATION_ERROR")`.*) |
| `INTERNAL_SERVER_ERROR` | `500` | `InternalServerApiError` / `app.onError` | Unhandled server or database error. |

### Resources (`Resource`)

Defined in `RESOURCES` ([`src/helpers/errors.ts`](../src/helpers/errors.ts)):

| `resource` | Description |
| :--- | :--- |
| `route` | Unknown URL path / endpoint (`app.notFound`). |
| `user` | Authentication and user account operations (`/api/auth/*`). |
| `property` | Property operations (`/api/properties/*`). |

### Non-Form General Error Responses

These responses do not map form input fields to validation machine codes:

| Scenario | HTTP Status | `code` | `resource` | `params` |
| :--- | :---: | :--- | :--- | :--- |
| Unknown endpoint (`app.notFound`) | `404` | `NOT_FOUND` | `route` | *(omitted)* |
| Property not found or owned by another user | `404` | `NOT_FOUND` | `property` | `{ "id": "<requested-uuid>" }` |
| User from verification token no longer exists | `404` | `NOT_FOUND` | `user` | `{ "id": "<user-uuid>" }` |
| Missing/invalid JWT or bad login credentials | `401` | `UNAUTHORIZED` | `user` | *(omitted)* |
| Malformed JSON request body | `422` | `VALIDATION_ERROR` | *(omitted)* | *(omitted)* |
| Verification email failed to send on sign-up | `500` | `INTERNAL_SERVER_ERROR` | `user` | *(omitted)* |
| Unhandled exception | `500` | `INTERNAL_SERVER_ERROR` | *(omitted)* | *(omitted)* |

---

## 2. Form & Field Errors (`params`)

When `code` is `VALIDATION_ERROR` (`422`), `ALREADY_EXISTS` (`409`), or `FORBIDDEN` (`403`), `params` maps each invalid field name (`string`) to a short machine error code (`string`) that the frontend translates into localized field messages.

### Shared Field Machine Codes

| Machine Code | Meaning |
| :--- | :--- |
| `required` | Field is missing, `null`, not a string, or empty after trimming. |
| `invalid_type` | Field value has the wrong JSON type (e.g., number/object instead of string or boolean). |
| `too_long` | String exceeds the maximum allowed character length for the field. |
| `invalid_uuid` | Route/field value is not a valid UUID. |
| `already_exists` | Field value violates a uniqueness constraint. |

---

### `user` Resource Form Errors (`/api/auth/*`)

Defined in [`src/validators/authValidators.ts`](../src/validators/authValidators.ts) and [`src/controllers/authController.ts`](../src/controllers/authController.ts):

| Field (`params` key) | Machine Code (`params` value) | HTTP Status / `code` | Trigger Rule |
| :--- | :--- | :---: | :--- |
| `email` | `required` | `422 VALIDATION_ERROR` | Missing or not a string (`sign-up/email`, `sign-in/email`, `forgot-password`). |
| `email` | `too_long` | `422 VALIDATION_ERROR` | Exceeds `255` characters (`sign-up/email`). |
| `email` | `invalid_email` | `422 VALIDATION_ERROR` | Fails email format validation (`sign-up/email`, `sign-in/email`, `forgot-password`). |
| `email` | `email_not_verified` | `403 FORBIDDEN` | User credentials are valid, but `emailVerified` is `false` (`sign-in/email`). |
| `firstName` | `required` | `422 VALIDATION_ERROR` | Missing, not a string, or empty after `.trim()` (`sign-up/email`). |
| `firstName` | `too_long` | `422 VALIDATION_ERROR` | Exceeds `50` characters (`sign-up/email`). |
| `lastName` | `invalid_type` | `422 VALIDATION_ERROR` | Provided as a non-string value (`sign-up/email`). |
| `lastName` | `required` | `422 VALIDATION_ERROR` | Provided as an empty/whitespace-only string (`sign-up/email`). |
| `lastName` | `too_long` | `422 VALIDATION_ERROR` | Exceeds `50` characters (`sign-up/email`). |
| `password` | `required` | `422 VALIDATION_ERROR` | Missing or empty (`sign-up/email`, `sign-in/email`, `reset-password`). |
| `password` | `password_too_short` | `422 VALIDATION_ERROR` | Fewer than `8` characters (`sign-up/email`, `reset-password`). |
| `password` | `password_too_long` | `422 VALIDATION_ERROR` | Exceeds `128` characters (`sign-up/email`, `reset-password`). |
| `password` | `password_missing_uppercase` | `422 VALIDATION_ERROR` | Does not contain at least one uppercase letter `[A-Z]` (`sign-up/email`, `reset-password`). |
| `password` | `password_missing_lowercase` | `422 VALIDATION_ERROR` | Does not contain at least one lowercase letter `[a-z]` (`sign-up/email`, `reset-password`). |
| `password` | `password_missing_number` | `422 VALIDATION_ERROR` | Does not contain at least one digit `\d` (`sign-up/email`, `reset-password`). |
| `password` | `password_missing_special` | `422 VALIDATION_ERROR` | Does not contain at least one special character `[^A-Za-z0-9]` (`sign-up/email`, `reset-password`). |
| `token` | `required` | `422 VALIDATION_ERROR` | Missing, not a string, or empty after `.trim()` (`verify-email`, `reset-password`). |
| `token` | `invalid_or_expired_token` | `422 VALIDATION_ERROR` | Token JWT signature is invalid, expired, already used, or wrong `purpose` (`verify-email`, `reset-password`). |

---

### `property` Resource Form & Param Errors (`/api/properties/*`)

Defined in [`src/validators/propertyValidators.ts`](../src/validators/propertyValidators.ts) and [`src/controllers/propertyController.ts`](../src/controllers/propertyController.ts):

| Field (`params` key) | Machine Code (`params` value) | HTTP Status / `code` | Trigger Rule |
| :--- | :--- | :---: | :--- |
| `id` *(route param)* | `invalid_uuid` | `422 VALIDATION_ERROR` | `:id` URL parameter is not a valid UUID (`GET /:id`, `PATCH /:id`, `DELETE /:id`). |
| `name` | `required` | `422 VALIDATION_ERROR` | Missing on `POST`, not a string, or empty after `.trim()` (`POST`, `PATCH`). |
| `name` | `too_long` | `422 VALIDATION_ERROR` | Exceeds `100` characters (`POST`, `PATCH`). |
| `description` | `invalid_type` | `422 VALIDATION_ERROR` | Provided and is neither a string nor `null` (`POST`, `PATCH`). |
| `description` | `too_long` | `422 VALIDATION_ERROR` | Exceeds `1000` characters (`POST`, `PATCH`). |
| `notes` | `invalid_type` | `422 VALIDATION_ERROR` | Provided and is neither a string nor `null` (`POST`, `PATCH`). |
| `notes` | `too_long` | `422 VALIDATION_ERROR` | Exceeds `2000` characters (`POST`, `PATCH`). |
| `preferred` | `invalid_type` | `422 VALIDATION_ERROR` | Provided and is not a boolean (`POST`, `PATCH`). |
| `preferred` | `cannot_unset_only_property` | `422 VALIDATION_ERROR` | Attempting to `PATCH` `preferred: false` when the user has only `1` property in total. |

---

## 3. Edge / WAF Responses (Cloudflare)

Before requests reach the Worker (`portateka-api.rpetrov.dev`), Cloudflare WAF evaluates edge security rules. On the Cloudflare Free plan, blocked requests return Cloudflare's default edge body (HTML/text) rather than the JSON `ErrorResponse` shape. Clients should check `response.status` before attempting to parse JSON on these statuses:

| HTTP Status | WAF Rule | Trigger Condition | Mitigation / Behavior |
| :---: | :--- | :--- | :--- |
| `429 Too Many Requests` | Rate limiting rule | More than `5` `POST` requests per `10 seconds` from the same IP to `/api/auth/*`. | Blocks matching requests from that IP with HTTP `429` for `10 seconds`. |
| `403 Forbidden` | Custom WAF rule | Request path does not start with `/api/` and is not `/health`. | Immediately blocks non-API traffic at the edge with HTTP `403`. |

