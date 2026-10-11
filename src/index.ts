import { Hono } from "hono";
import { SYSTEM_CONFIG } from "./config";
import { logger } from "hono/logger";
import propertyRoutes from "./routes/propertyRoutes";
import { ApiError } from "./helpers/errors";
import { bad } from "./helpers/responses";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use(logger());

app.get("/health", (c) => {
  return c.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: `${SYSTEM_CONFIG.projectName} ${SYSTEM_CONFIG.apiVersion}`,
  });
});

app.route("/api/properties", propertyRoutes);

app.notFound((c) => bad(c, "NOT_FOUND", "route"));

app.onError((err, c) => {
  console.error("onError: ", err);

  if (err instanceof ApiError) {
    return bad(c, err.code, err.resource, err.params);
  }

  return bad(c, "INTERNAL_SERVER_ERROR");
});

export default app;
