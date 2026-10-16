/// <reference types="node" />
import "dotenv/config";
import { sql } from "drizzle-orm";
import { getDb } from "./index.ts";

async function reset() {
  try {
    console.log("🗑️  Resetting database schemas...");

    const db = getDb(process.env.DATABASE_URL!);

    await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
    await db.execute(sql`CREATE SCHEMA public`);
    await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);

    console.log(
      "✅ Database reset complete. Run `npm run db:migrate` or `npm run db:push` next.",
    );
  } catch (err) {
    console.error("❌ Database reset failed:", err);
    process.exit(1);
  }
}

reset();
