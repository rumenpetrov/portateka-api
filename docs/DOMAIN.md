# Domain & Business Rules (`portateka-api`)

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
