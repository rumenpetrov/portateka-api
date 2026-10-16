import { createMiddleware } from "hono/factory";
import { ApiError } from "../helpers/errors";
import { verifyToken } from "../utils/jwt";
import type { AppEnv } from "../types/env";

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new ApiError("UNAUTHORIZED", "user");
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    throw new ApiError("UNAUTHORIZED", "user");
  }

  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    c.set("user", payload);
  } catch {
    throw new ApiError("UNAUTHORIZED", "user");
  }

  await next();
});
