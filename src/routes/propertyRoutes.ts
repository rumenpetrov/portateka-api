import { Hono } from "hono";
import {
  getPropertyCollection,
  createPropertyEntry,
  getPropertyEntry,
  updatePropertyEntry,
  deletePropertyEntry,
} from "../controllers/propertyController";

const app = new Hono();

app.get("/", getPropertyCollection);

app.post("/", createPropertyEntry);

app.get("/:id", getPropertyEntry);

app.patch("/:id", updatePropertyEntry);

app.delete("/:id", deletePropertyEntry);

export default app;
