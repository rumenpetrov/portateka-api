import { Hono } from "hono";
import { SYSTEM_CONFIG } from "./config";
import { logger } from "hono/logger";
import propertyRoutes from "./routes/propertyRoutes";

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

export default app;
