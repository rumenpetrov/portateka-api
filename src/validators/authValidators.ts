import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { ValidationApiError, type Resource } from "../helpers/errors";

// Messages are short machine codes; the client translates them.
export const registerSchema = z.object({
  email: z
    .string({ error: "required" })
    .trim()
    .toLowerCase()
    .max(255, "too_long")
    .pipe(z.email("invalid_email")),
  firstName: z
    .string({ error: "required" })
    .trim()
    .min(1, "required")
    .max(50, "too_long"),
  lastName: z
    .string({ error: "invalid_type" })
    .trim()
    .min(1, "required")
    .max(50, "too_long")
    .optional(),
  password: z
    .string({ error: "required" })
    .min(8, "password_too_short")
    .max(128, "password_too_long")
    .regex(/[A-Z]/, "password_missing_uppercase")
    .regex(/[a-z]/, "password_missing_lowercase")
    .regex(/\d/, "password_missing_number")
    .regex(/[^A-Za-z0-9]/, "password_missing_special"),
});

export const loginSchema = z.object({
  email: z
    .string({ error: "required" })
    .trim()
    .toLowerCase()
    .pipe(z.email("invalid_email")),
  password: z.string({ error: "required" }).min(1, "required"),
});

// Validates the JSON body and throws a ValidationApiError whose params
// map each invalid field to its first error code.
export const validateJson = <T extends z.ZodType>(
  schema: T,
  resource: Resource,
) =>
  zValidator("json", schema, (result) => {
    if (!result.success) {
      const params: Record<string, string> = {};

      for (const issue of result.error.issues) {
        const field = String(issue.path[0] ?? "body");
        params[field] ??= issue.message;
      }

      throw new ValidationApiError(resource, params);
    }
  });
