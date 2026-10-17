import { Hono } from "hono";
import { me, signInEmail, signUpEmail } from "../controllers/authController";
import { requireAuth } from "../middleware/auth";
import {
  signInEmailSchema,
  signUpEmailSchema,
  validateJson,
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
app.get("/me", requireAuth, me);

export default app;
