/// <reference types="node" />
import "dotenv/config";
import { getDb } from "./index.ts";
import { properties, users } from "./schema.ts";
import { hashPassword } from "../utils/password.ts";

async function seed() {
  try {
    console.log("🌱 Starting database seed...");

    const db = getDb(process.env.DATABASE_URL!);

    console.log("Clearing existing data...");
    await db.delete(properties);
    await db.delete(users);

    console.log("Creating demo users...");
    const password = await hashPassword("Demo123!");

    const [john, jane] = await db
      .insert(users)
      .values([
        {
          email: "john@example.com",
          firstName: "John",
          lastName: "Doe",
          password,
          emailVerified: true,
        },
        {
          email: "jane@example.com",
          firstName: "Jane",
          password,
          emailVerified: true,
        },
      ])
      .returning();

    console.log("Creating demo properties...");
    await db.insert(properties).values([
      {
        userId: john!.id,
        name: "Varna Briz",
        description: "Two-bedroom apartment near the Sea Garden",
        notes: "Electricity meter is in the hallway cabinet",
        preferred: true,
      },
      {
        userId: john!.id,
        name: "Sofia Center",
        description: "Studio apartment downtown",
        preferred: false,
      },
      {
        userId: jane!.id,
        name: "Plovdiv Kapana",
        description: "Loft in the arts district",
        preferred: true,
      },
    ]);

    console.log("✅ Database seeded successfully!");
    console.log("\n🔑 Demo Login Credentials:");
    console.log("  Email: john@example.com | Name: John Doe | Password: Demo123! (2 properties)");
    console.log("  Email: jane@example.com | Name: Jane | Password: Demo123! (1 property)");
  } catch (err) {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  }
}

seed();

