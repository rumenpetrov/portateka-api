import { z } from "zod";
export { validateJson } from "./validate";

const passwordFieldSchema = z
  .string({ error: "required" })
  .min(8, "password_too_short")
  .max(128, "password_too_long")
  .regex(/[A-Z]/, "password_missing_uppercase")
  .regex(/[a-z]/, "password_missing_lowercase")
  .regex(/\d/, "password_missing_number")
  .regex(/[^A-Za-z0-9]/, "password_missing_special");

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
  password: passwordFieldSchema,
});

export const signInEmailSchema = z.object({
  email: z
    .string({ error: "required" })
    .trim()
    .toLowerCase()
    .max(255, "too_long")
    .pipe(z.email("invalid_email")),
  password: z
    .string({ error: "required" })
    .min(1, "required")
    .max(128, "password_too_long"),
});

export const verifyEmailSchema = z.object({
  token: z.string({ error: "required" }).trim().min(1, "required"),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string({ error: "required" })
    .trim()
    .toLowerCase()
    .max(255, "too_long")
    .pipe(z.email("invalid_email")),
});

export const resetPasswordSchema = z.object({
  token: z.string({ error: "required" }).trim().min(1, "required"),
  password: passwordFieldSchema,
});

export const updateMeSchema = z.object({
  firstName: z
    .string({ error: "invalid_type" })
    .trim()
    .min(1, "required")
    .max(50, "too_long")
    .optional(),
  lastName: z
    .string({ error: "invalid_type" })
    .trim()
    .min(1, "required")
    .max(50, "too_long")
    .nullable()
    .optional(),
  preferredPropertyId: z
    .string({ error: "invalid_type" })
    .pipe(z.uuid("invalid_uuid"))
    .nullable()
    .optional(),
});



