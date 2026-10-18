import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.ts";

// Stateless HTTP client: nothing stays open, so it's safe to create per request.
export const getDb = (databaseUrl: string) =>
  drizzle(neon(databaseUrl), { schema });

export const confirmDestructiveDatabaseAction = async (
  actionName: string,
  databaseUrl: string | undefined,
): Promise<string> => {
  if (process.env.NODE_ENV === "production" || process.env.CI === "true") {
    throw new Error(
      `Refusing to run ${actionName} when NODE_ENV=production or CI=true.`,
    );
  }

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set.");
  }

  const parsedUrl = new URL(databaseUrl);
  const target = `${parsedUrl.host}${parsedUrl.pathname}`;

  if (process.argv.includes("--force")) {
    return databaseUrl;
  }

  if (!process.stdin.isTTY) {
    throw new Error(
      `Refusing to run ${actionName} on ${target} in a non-interactive shell without --force.`,
    );
  }

  const { createInterface } = await import("node:readline/promises");
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await rl.question(
      `⚠️  About to run ${actionName} against "${target}". Continue? (y/N): `,
    );
    if (answer.trim().toLowerCase() !== "y") {
      console.log("Aborted.");
      process.exit(0);
    }
  } finally {
    rl.close();
  }

  return databaseUrl;
};

