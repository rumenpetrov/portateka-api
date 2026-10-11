import { Hono } from "hono";

const app = new Hono();

app.get("/api/health", (c) => {
  return c.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "Portateka API",
  });
});

export default app;
