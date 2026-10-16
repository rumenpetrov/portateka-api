/// <reference types="node" />
import "dotenv/config";
import { getDb } from "./index.ts";
import { users } from "./schema.ts";
import { hashPassword } from "../utils/password.ts";

async function seed() {
  try {
    console.log("🌱 Starting database seed...");

    const db = getDb(process.env.DATABASE_URL!);

    console.log("Clearing existing data...");
    await db.delete(users);

    console.log("Creating demo users...");
    const password = await hashPassword("Demo123!");

    await db.insert(users).values([
      {
        email: "john@example.com",
        username: "johndoe",
        password,
      },
      {
        email: "jane@example.com",
        username: "janedoe",
        password,
      },
    ]);

    console.log("✅ Database seeded successfully!");
    console.log("\n🔑 Demo Login Credentials:");
    console.log(
      "  Email: john@example.com | Username: johndoe | Password: Demo123!",
    );
    console.log(
      "  Email: jane@example.com | Username: janedoe | Password: Demo123!",
    );
  } catch (err) {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  }
}

seed();
