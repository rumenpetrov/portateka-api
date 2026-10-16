import { Hono } from "hono";
import { login, me, register } from "../controllers/authController";
import { requireAuth } from "../middleware/auth";
import {
  loginSchema,
  registerSchema,
  validateJson,
} from "../validators/authValidators";
import type { AppEnv } from "../types/env";

const app = new Hono<AppEnv>();

app.post("/register", validateJson(registerSchema, "user"), register);
app.post("/login", validateJson(loginSchema, "user"), login);
app.get("/me", requireAuth, me);

export default app;
