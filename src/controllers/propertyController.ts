import type { Context, Next } from "hono";

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
  c.json({
    data: propertyCollectionMock,
  });

export const createPropertyEntry = (c: Context) =>
  c.json({ data: propertyCollectionMock[0] }, 201);

export const getPropertyEntry = (c: Context, next: Next) => {
  const match = matchEntry(c);

  if (match) {
    return c.json({ data: match });
  }

  return next();
};

export const updatePropertyEntry = (c: Context, next: Next) => {
  const match = matchEntry(c);

  if (match) {
    return c.json({ data: match });
  }

  return next();
};

export const deletePropertyEntry = (c: Context, next: Next) => {
  const match = matchEntry(c);

  if (match) {
    return c.body(null, 204);
  }

  return next();
};
