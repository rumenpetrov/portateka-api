import { Hono } from "hono";
import { SYSTEM_CONFIG } from "./config";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { HTTPException } from "hono/http-exception";
import propertyRoutes from "./routes/propertyRoutes";
import authRoutes from "./routes/authRoutes";
import { ApiError } from "./helpers/errors";
import { bad } from "./helpers/responses";
import type { AppEnv } from "./types/env";

const app = new Hono<AppEnv>();

app.use(logger());

app.use(
  "/api/*",
  cors({
    origin: (origin, c) => {
      const allowedOrigin = c.env.WEB_APP_BASE_URL.replace(/\/+$/, "");
      return origin === allowedOrigin ? origin : null;
    },
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

app.get("/health", (c) => {
  return c.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: `${SYSTEM_CONFIG.projectName} ${SYSTEM_CONFIG.apiVersion}`,
  });
});

app.route("/api/auth", authRoutes);

app.route("/api/properties", propertyRoutes);

app.notFound((c) => bad(c, "NOT_FOUND", "route"));

app.onError((err, c) => {
  console.error("onError: ", err);

  if (err instanceof ApiError) {
    return bad(c, err.code, err.resource, err.params);
  }

  // Hono throws a 400 HTTPException for malformed JSON bodies.
  if (err instanceof HTTPException && err.status === 400) {
    return bad(c, "VALIDATION_ERROR");
  }

  return bad(c, "INTERNAL_SERVER_ERROR");
});

export default app;
