import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
// Relative import (not "@/") so drizzle-kit can resolve it without the TS path alias.
import { DEFAULT_LOCALE } from "../config";
import type { Locale } from "../config";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  firstName: varchar("first_name", { length: 50 }).notNull().default("User"),
  lastName: varchar("last_name", { length: 50 }),
  // Stores the password hash, never the plain password.
  password: varchar("password", { length: 255 }).notNull(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  // Source of truth for server-generated content (emails). Validated against SUPPORTED_LOCALES in Zod, not a pgEnum, so adding a locale needs no migration.
  locale: varchar("locale", { length: 10 })
    .$type<Locale>()
    .notNull()
    .default(DEFAULT_LOCALE),
  preferredPropertyId: uuid("preferred_property_id").references(
    (): AnyPgColumn => properties.id,
    { onDelete: "set null" },
  ),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const properties = pgTable("properties", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  properties: many(properties),
  preferredProperty: one(properties, {
    fields: [users.preferredPropertyId],
    references: [properties.id],
  }),
}));

export const propertiesRelations = relations(properties, ({ one }) => ({
  user: one(users, {
    fields: [properties.userId],
    references: [users.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;

