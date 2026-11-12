import { Hono } from "hono";
import {
  changePassword,
  forgotPassword,
  me,
  resetPassword,
  signInEmail,
  signUpEmail,
  updateMe,
  verifyEmail,
} from "@/controllers/authController";
import { requireAuth } from "@/middleware/auth";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  signInEmailSchema,
  signUpEmailSchema,
  updateMeSchema,
  validateJson,
  verifyEmailSchema,
} from "@/validators/authValidators";
import type { AppEnv } from "@/types/env";

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
app.post(
  "/change-password",
  requireAuth,
  validateJson(changePasswordSchema, "user"),
  changePassword,
);
app.get("/me", requireAuth, me);
app.patch("/me", requireAuth, validateJson(updateMeSchema, "user"), updateMe);

export default app;
