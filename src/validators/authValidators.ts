import { z } from "zod";
export { validateJson } from "./validate";

// Messages are short machine codes; the client translates them.
export const signUpEmailSchema = z.object({
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

export const signInEmailSchema = z.object({
  email: z
    .string({ error: "required" })
    .trim()
    .toLowerCase()
    .pipe(z.email("invalid_email")),
  password: z.string({ error: "required" }).min(1, "required"),
});

