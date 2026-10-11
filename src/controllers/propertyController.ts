import type { Context } from "hono";
import { NotFoundApiError } from "../helpers/errors";
import { ok } from "../helpers/responses";

const propertyCollectionMock = [
  { id: "1", name: "Varna Briz" },
  { id: "2", name: "Sofia Center" },
];

const matchEntry = (c: Context) => {
  return propertyCollectionMock.find(
    (propertyEntry) => propertyEntry.id === c.req.param("id"),
  );
};

export const getPropertyCollection = (c: Context) =>
  ok(c, propertyCollectionMock);

export const createPropertyEntry = (c: Context) => {
  return ok({ c, status: 201 }, propertyCollectionMock[0]!);
};

export const getPropertyEntry = (c: Context) => {
  const match = matchEntry(c);

  if (!match) {
    throw new NotFoundApiError("property", c.req.param());
  }

  return ok(c, match);
};

export const updatePropertyEntry = (c: Context) => {
  const match = matchEntry(c);

  if (!match) {
    throw new NotFoundApiError("property", c.req.param());
  }

  return ok(c, match);
};

export const deletePropertyEntry = (c: Context) => {
  const match = matchEntry(c);

  if (!match) {
    throw new NotFoundApiError("property", c.req.param());
  }

  return c.body(null, 204);
};
