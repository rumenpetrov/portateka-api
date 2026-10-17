/// <reference types="node" />
import "dotenv/config";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { getDb } from "../../src/db/index.ts";
import { users } from "../../src/db/schema.ts";

export default async function setup() {
  const testDbUrl = process.env.TEST_DATABASE_URL;

  if (!testDbUrl) {
    throw new Error("TEST_DATABASE_URL is not set in .env");
  }

  console.log("🗄️  Migrating test database...");
  const db = getDb(testDbUrl);

  await migrate(db, { migrationsFolder: "./migrations" });
  await db.delete(users);
  console.log("✅ Test database ready");

  return async () => {
    console.log("🧹 Cleaning up test database...");
    await db.delete(users);
    console.log("✅ Test database cleanup complete");
  };
}
