import type { Context } from "hono";
import { NotFoundApiError } from "../helpers/errors";
import { ok } from "../helpers/responses";
import type { AppEnv } from "../types/env";

type PropertyContext = Context<AppEnv>;

const propertyCollectionMock = [
  { id: "1", name: "Varna Briz" },
  { id: "2", name: "Sofia Center" },
];

const matchEntry = (c: PropertyContext) => {
  return propertyCollectionMock.find(
    (propertyEntry) => propertyEntry.id === c.req.param("id"),
  );
};

export const getPropertyCollection = (c: PropertyContext) =>
  ok(c, propertyCollectionMock);

export const createPropertyEntry = (c: PropertyContext) => {
  return ok({ c, status: 201 }, propertyCollectionMock[0]!);
};

export const getPropertyEntry = (c: PropertyContext) => {
  const match = matchEntry(c);

  if (!match) {
    throw new NotFoundApiError("property", c.req.param());
  }

  return ok(c, match);
};

export const updatePropertyEntry = (c: PropertyContext) => {
  const match = matchEntry(c);

  if (!match) {
    throw new NotFoundApiError("property", c.req.param());
  }

  return ok(c, match);
};

export const deletePropertyEntry = (c: PropertyContext) => {
  const match = matchEntry(c);

  if (!match) {
    throw new NotFoundApiError("property", c.req.param());
  }

  return c.body(null, 204);
};
