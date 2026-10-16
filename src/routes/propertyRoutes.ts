import { Hono } from "hono";
import {
  getPropertyCollection,
  createPropertyEntry,
  getPropertyEntry,
  updatePropertyEntry,
  deletePropertyEntry,
} from "../controllers/propertyController";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types/env";

const app = new Hono<AppEnv>();

app.use("*", requireAuth);

app.get("/", getPropertyCollection);

app.post("/", createPropertyEntry);

app.get("/:id", getPropertyEntry);

app.patch("/:id", updatePropertyEntry);

app.delete("/:id", deletePropertyEntry);

export default app;
