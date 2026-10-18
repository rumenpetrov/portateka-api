import type { Context } from "hono";
import { and, count, desc, eq, ne } from "drizzle-orm";
import type { z } from "zod";
import { NotFoundApiError, ValidationApiError } from "../helpers/errors";
import { ok } from "../helpers/responses";
import { getDb } from "../db";
import { properties } from "../db/schema";
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
    .orderBy(desc(properties.preferred), desc(properties.createdAt));

  return ok(c, userProperties);
};

export const createPropertyEntry = async (c: CreatePropertyContext) => {
  const { sub: userId } = c.get("user");
  const { name, description, notes, preferred } = c.req.valid("json");
  const db = getDb(c.env.DATABASE_URL);

  const [countResult] = await db
    .select({ value: count() })
    .from(properties)
    .where(eq(properties.userId, userId));

  const userPropertyCount = countResult?.value ?? 0;

  // Business rule: a user's first property is always preferred.
  const isPreferred = userPropertyCount === 0 ? true : (preferred ?? false);

  const insertQuery = db
    .insert(properties)
    .values({
      userId,
      name,
      description,
      notes,
      preferred: isPreferred,
    })
    .returning();

  if (isPreferred && userPropertyCount > 0) {
    const [, [newProperty]] = await db.batch([
      db
        .update(properties)
        .set({ preferred: false, updatedAt: new Date() })
        .where(
          and(eq(properties.userId, userId), eq(properties.preferred, true)),
        ),
      insertQuery,
    ]);

    return ok({ c, status: 201 }, newProperty!);
  }

  const [newProperty] = await insertQuery;

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

  const [existing] = await db
    .select()
    .from(properties)
    .where(and(eq(properties.id, id), eq(properties.userId, userId)))
    .limit(1);

  if (!existing) {
    throw new NotFoundApiError("property", { id });
  }

  if (updates.preferred === false) {
    const [countResult] = await db
      .select({ value: count() })
      .from(properties)
      .where(eq(properties.userId, userId));

    if ((countResult?.value ?? 0) <= 1) {
      throw new ValidationApiError("property", {
        preferred: "cannot_unset_only_property",
      });
    }
  }

  const updateQuery = db
    .update(properties)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(properties.id, id), eq(properties.userId, userId)))
    .returning();

  if (updates.preferred === true && !existing.preferred) {
    const [, [updatedProperty]] = await db.batch([
      db
        .update(properties)
        .set({ preferred: false, updatedAt: new Date() })
        .where(
          and(
            eq(properties.userId, userId),
            eq(properties.preferred, true),
            ne(properties.id, id),
          ),
        ),
      updateQuery,
    ]);

    return ok(c, updatedProperty!);
  }

  const [updatedProperty] = await updateQuery;

  return ok(c, updatedProperty!);
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

