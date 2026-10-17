/// <reference types="node" />
import "dotenv/config";
import { getDb } from "../../src/db/index.ts";
import { properties, users } from "../../src/db/schema.ts";
import { hashPassword } from "../../src/utils/password.ts";
import { generateToken } from "../../src/utils/jwt.ts";

export const testEnv: CloudflareBindings = {
  DATABASE_URL: process.env.TEST_DATABASE_URL!,
  TEST_DATABASE_URL: process.env.TEST_DATABASE_URL!,
  JWT_SECRET: process.env.JWT_SECRET!,
  RESEND_API_KEY: "",
  WEB_APP_BASE_URL:
    process.env.WEB_APP_BASE_URL ?? "https://portateka.rpetrov.dev",
  WEB_APP_VERIFY_EMAIL_PREFIX:
    process.env.WEB_APP_VERIFY_EMAIL_PREFIX ?? "/verify-email",
};

export const testDb = getDb(testEnv.DATABASE_URL);

export async function createTestUser(
  userData: Partial<{
    email: string;
    firstName: string;
    lastName: string | null;
    password: string;
    emailVerified: boolean;
  }> = {},
) {
  const defaultData = {
    email: `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
    firstName: "Test",
    lastName: "User" as string | null,
    password: "TestPassword123!",
    emailVerified: true,
    ...userData,
  };

  const hashedPassword = await hashPassword(defaultData.password);

  const [user] = await testDb
    .insert(users)
    .values({
      email: defaultData.email,
      firstName: defaultData.firstName,
      lastName: defaultData.lastName,
      password: hashedPassword,
      emailVerified: defaultData.emailVerified,
    })
    .returning();

  if (!user) {
    throw new Error("Failed to insert test user");
  }

  const token = await generateToken(
    {
      sub: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    },
    testEnv.JWT_SECRET,
  );

  return { user, token, rawPassword: defaultData.password };
}

export async function createTestProperty(
  userId: string,
  propertyData: Partial<{
    name: string;
    description: string | null;
    notes: string | null;
    preferred: boolean;
  }> = {},
) {
  const [property] = await testDb
    .insert(properties)
    .values({
      userId,
      name: propertyData.name ?? `Test Property ${Date.now()}`,
      description: propertyData.description ?? "Test description",
      notes: propertyData.notes ?? null,
      preferred: propertyData.preferred ?? false,
    })
    .returning();

  if (!property) {
    throw new Error("Failed to insert test property");
  }

  return property;
}

export async function cleanupDatabase() {
  await testDb.delete(properties);
  await testDb.delete(users);
}

