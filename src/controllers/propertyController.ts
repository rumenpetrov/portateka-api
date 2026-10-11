import type { Context } from "hono";

const propertyCollectionMock = [
  { id: "1", name: "Varna Briz" },
  { id: "2", name: "Sofia Center" },
];

export const getPropertyCollection = (c: Context) =>
  c.json({
    data: propertyCollectionMock,
  });

export const createPropertyEntry = (c: Context) =>
  c.json({ data: propertyCollectionMock[0] }, 201);

export const getPropertyEntry = (c: Context) => {
  const match = propertyCollectionMock.find(
    (propertyEntry) => propertyEntry.id === c.req.param("id"),
  );

  if (match) {
    return c.json({ data: match });
  }

  return c.json({ message: "Not found" }, 404);
};

export const updatePropertyEntry = (c: Context) => {
  return c.json({ data: propertyCollectionMock[0] });
};

export const deletePropertyEntry = (c: Context) => {
  return c.body(null, 204);
};
