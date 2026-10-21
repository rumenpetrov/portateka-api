import type { Context } from "hono";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { z } from "zod";
import { NotFoundApiError } from "../helpers/errors";
import { ok } from "../helpers/responses";
import { getDb } from "../db";
import { properties, users } from "../db/schema";
import type {
  createPropertySchema,
  propertyIdParamSchema,
  updatePropertySchema,
} from "../validators/propertyValidators";
import type { AppEnv } from "../types/env";

type PropertyContext = Context<AppEnv>;

type PropertyParamContext = Context<
  AppEnv,
  string,
  {
    in: { param: z.input<typeof propertyIdParamSchema> };
    out: { param: z.output<typeof propertyIdParamSchema> };
  }
>;

type CreatePropertyContext = Context<
  AppEnv,
  string,
  {
    in: { json: unknown };
    out: { json: z.output<typeof createPropertySchema> };
  }
>;

type UpdatePropertyContext = Context<
  AppEnv,
  string,
  {
    in: {
      param: z.input<typeof propertyIdParamSchema>;
      json: unknown;
    };
    out: {
      param: z.output<typeof propertyIdParamSchema>;
      json: z.output<typeof updatePropertySchema>;
    };
  }
>;

export const getPropertyCollection = async (c: PropertyContext) => {
  const { sub: userId } = c.get("user");
  const db = getDb(c.env.DATABASE_URL);

  const userProperties = await db
    .select()
    .from(properties)
    .where(eq(properties.userId, userId))
    .orderBy(desc(properties.createdAt));

  return ok(c, userProperties);
};

export const createPropertyEntry = async (c: CreatePropertyContext) => {
  const { sub: userId } = c.get("user");
  const { name, description, notes } = c.req.valid("json");
  const db = getDb(c.env.DATABASE_URL);

  const [newProperty] = await db
    .insert(properties)
    .values({
      userId,
      name,
      description,
      notes,
    })
    .returning();

  // Automatically set as the user's preferred property if they don't have one yet.
  await db
    .update(users)
    .set({
      preferredPropertyId: newProperty!.id,
      updatedAt: new Date(),
    })
    .where(and(eq(users.id, userId), isNull(users.preferredPropertyId)));

  return ok({ c, status: 201 }, newProperty!);
};

export const getPropertyEntry = async (c: PropertyParamContext) => {
  const { sub: userId } = c.get("user");
  const { id } = c.req.valid("param");
  const db = getDb(c.env.DATABASE_URL);

  const [property] = await db
    .select()
    .from(properties)
    .where(and(eq(properties.id, id), eq(properties.userId, userId)))
    .limit(1);

  if (!property) {
    throw new NotFoundApiError("property", { id });
  }

  return ok(c, property);
};

export const updatePropertyEntry = async (c: UpdatePropertyContext) => {
  const { sub: userId } = c.get("user");
  const { id } = c.req.valid("param");
  const updates = c.req.valid("json");
  const db = getDb(c.env.DATABASE_URL);

  const [updatedProperty] = await db
    .update(properties)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(properties.id, id), eq(properties.userId, userId)))
    .returning();

  if (!updatedProperty) {
    throw new NotFoundApiError("property", { id });
  }

  return ok(c, updatedProperty);
};

export const deletePropertyEntry = async (c: PropertyParamContext) => {
  const { sub: userId } = c.get("user");
  const { id } = c.req.valid("param");
  const db = getDb(c.env.DATABASE_URL);

  const [deletedProperty] = await db
    .delete(properties)
    .where(and(eq(properties.id, id), eq(properties.userId, userId)))
    .returning({ id: properties.id });

  if (!deletedProperty) {
    throw new NotFoundApiError("property", { id });
  }

  return c.body(null, 204);
};

