import { Hono } from "hono";
import {
  forgotPassword,
  me,
  resetPassword,
  signInEmail,
  signUpEmail,
  verifyEmail,
} from "../controllers/authController";
import { requireAuth } from "../middleware/auth";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInEmailSchema,
  signUpEmailSchema,
  validateJson,
  verifyEmailSchema,
} from "../validators/authValidators";
import type { AppEnv } from "../types/env";

const app = new Hono<AppEnv>();

app.post(
  "/sign-up/email",
  validateJson(signUpEmailSchema, "user"),
  signUpEmail,
);
app.post(
  "/sign-in/email",
  validateJson(signInEmailSchema, "user"),
  signInEmail,
);
app.post(
  "/verify-email",
  validateJson(verifyEmailSchema, "user"),
  verifyEmail,
);
app.post(
  "/forgot-password",
  validateJson(forgotPasswordSchema, "user"),
  forgotPassword,
);
app.post(
  "/reset-password",
  validateJson(resetPasswordSchema, "user"),
  resetPassword,
);
app.get("/me", requireAuth, me);

export default app;
