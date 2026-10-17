import { Hono } from "hono";
import {
  getPropertyCollection,
  createPropertyEntry,
  getPropertyEntry,
  updatePropertyEntry,
  deletePropertyEntry,
} from "../controllers/propertyController";
import { requireAuth } from "../middleware/auth";
import {
  createPropertySchema,
  propertyIdParamSchema,
  updatePropertySchema,
} from "../validators/propertyValidators";
import { validateJson, validateParams } from "../validators/validate";
import type { AppEnv } from "../types/env";

const app = new Hono<AppEnv>();

app.use("*", requireAuth);

app.get("/", getPropertyCollection);

app.post("/", validateJson(createPropertySchema, "property"), createPropertyEntry);

app.get(
  "/:id",
  validateParams(propertyIdParamSchema, "property"),
  getPropertyEntry,
);

app.patch(
  "/:id",
  validateParams(propertyIdParamSchema, "property"),
  validateJson(updatePropertySchema, "property"),
  updatePropertyEntry,
);

app.delete(
  "/:id",
  validateParams(propertyIdParamSchema, "property"),
  deletePropertyEntry,
);

export default app;

