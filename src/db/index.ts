import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.ts";

// Stateless HTTP client: nothing stays open, so it's safe to create per request.
export const getDb = (databaseUrl: string) =>
  drizzle(neon(databaseUrl), { schema });

