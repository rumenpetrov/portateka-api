import { afterEach, describe, expect, it } from "vitest";
import app from "../src/index.ts";
import {
  cleanupDatabase,
  createTestProperty,
  createTestUser,
  testEnv,
} from "./helpers/dbHelpers.ts";

const authRequest = (
  path: string,
  token: string,
  options: RequestInit = {},
) =>
  app.request(
    path,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    },
    testEnv,
  );

describe("Properties Endpoints", () => {
  afterEach(async () => {
    await cleanupDatabase();
  });

  describe("Authentication guard", () => {
    it("should return 401 when requesting properties without a token", async () => {
      const response = await app.request("/api/properties", {}, testEnv);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body).toEqual({
        code: "UNAUTHORIZED",
        resource: "user",
      });
    });
  });

  describe("POST /api/properties", () => {
    it("should create a property and set it as preferredPropertyId when user has none, keeping it on subsequent creations", async () => {
      const { user, token } = await createTestUser();

      const firstRes = await authRequest("/api/properties", token, {
        method: "POST",
        body: JSON.stringify({
          name: "Varna Briz",
          description: "Sea view apartment",
          notes: "Meter in hallway",
        }),
      });
      const firstBody = (await firstRes.json()) as {
        data: { id: string };
      };

      expect(firstRes.status).toBe(201);
      expect(firstBody).toEqual({
        data: {
          id: expect.any(String),
          userId: user.id,
          name: "Varna Briz",
          description: "Sea view apartment",
          notes: "Meter in hallway",
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      });

      const meAfterFirstRes = await authRequest("/api/auth/me", token);
      const meAfterFirstBody = (await meAfterFirstRes.json()) as {
        data: { preferredPropertyId: string | null };
      };
      expect(meAfterFirstBody.data.preferredPropertyId).toBe(firstBody.data.id);

      // Creating a second property should not overwrite existing preferredPropertyId
      const secondRes = await authRequest("/api/properties", token, {
        method: "POST",
        body: JSON.stringify({
          name: "Sofia Center",
        }),
      });
      expect(secondRes.status).toBe(201);

      const meAfterSecondRes = await authRequest("/api/auth/me", token);
      const meAfterSecondBody = (await meAfterSecondRes.json()) as {
        data: { preferredPropertyId: string | null };
      };
      expect(meAfterSecondBody.data.preferredPropertyId).toBe(
        firstBody.data.id,
      );
    });

    it("should return 422 when name is missing", async () => {
      const { token } = await createTestUser();

      const response = await authRequest("/api/properties", token, {
        method: "POST",
        body: JSON.stringify({ description: "No name" }),
      });
      const body = await response.json();

      expect(response.status).toBe(422);
      expect(body).toEqual({
        code: "VALIDATION_ERROR",
        resource: "property",
        params: {
          name: "required",
        },
      });
    });

    it("should return 422 when request body exceeds 16 KB limit", async () => {
      const { token } = await createTestUser();

      const response = await authRequest("/api/properties", token, {
        method: "POST",
        body: JSON.stringify({
          name: "Oversized",
          notes: "x".repeat(17 * 1024),
        }),
      });
      const body = await response.json();

      expect(response.status).toBe(422);
      expect(body).toEqual({
        code: "VALIDATION_ERROR",
      });
    });
  });

  describe("GET /api/properties", () => {
    it("should return only the authenticated user's properties ordered by newest first", async () => {
      const { user: user1, token: token1 } = await createTestUser();
      const { user: user2 } = await createTestUser();

      await createTestProperty(user1.id, {
        name: "First Property",
      });
      await createTestProperty(user1.id, {
        name: "Second Property",
      });
      await createTestProperty(user2.id, {
        name: "Other User Property",
      });

      const response = await authRequest("/api/properties", token1);
      const body = (await response.json()) as {
        data: Array<{ name: string }>;
      };

      expect(response.status).toBe(200);
      expect(body.data).toHaveLength(2);
      expect(body.data[0]?.name).toBe("Second Property");
      expect(body.data[1]?.name).toBe("First Property");
    });
  });

  describe("GET /api/properties/:id", () => {
    it("should return a specific property owned by the user", async () => {
      const { user, token } = await createTestUser();
      const property = await createTestProperty(user.id, {
        name: "My Property",
      });

      const response = await authRequest(
        `/api/properties/${property.id}`,
        token,
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        data: {
          id: property.id,
          userId: user.id,
          name: "My Property",
          description: "Test description",
          notes: null,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      });
    });

    it("should return 404 when accessing another user's property", async () => {
      const { token: token1 } = await createTestUser();
      const { user: user2 } = await createTestUser();
      const otherProperty = await createTestProperty(user2.id);

      const response = await authRequest(
        `/api/properties/${otherProperty.id}`,
        token1,
      );
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body).toEqual({
        code: "NOT_FOUND",
        resource: "property",
        params: { id: otherProperty.id },
      });
    });

    it("should return 422 for an invalid UUID parameter", async () => {
      const { token } = await createTestUser();

      const response = await authRequest("/api/properties/not-a-uuid", token);
      const body = await response.json();

      expect(response.status).toBe(422);
      expect(body).toEqual({
        code: "VALIDATION_ERROR",
        resource: "property",
        params: { id: "invalid_uuid" },
      });
    });
  });

  describe("PATCH /api/properties/:id", () => {
    it("should update the property fields", async () => {
      const { user, token } = await createTestUser();
      const property = await createTestProperty(user.id, {
        name: "Original Name",
      });

      const response = await authRequest(
        `/api/properties/${property.id}`,
        token,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: "Updated Name",
            description: "Updated description",
          }),
        },
      );
      const body = (await response.json()) as {
        data: { name: string; description: string | null };
      };

      expect(response.status).toBe(200);
      expect(body.data.name).toBe("Updated Name");
      expect(body.data.description).toBe("Updated description");
    });

    it("should return 404 when updating another user's property", async () => {
      const { token: token1 } = await createTestUser();
      const { user: user2 } = await createTestUser();
      const otherProperty = await createTestProperty(user2.id);

      const response = await authRequest(
        `/api/properties/${otherProperty.id}`,
        token1,
        {
          method: "PATCH",
          body: JSON.stringify({ name: "Hijacked" }),
        },
      );
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body).toEqual({
        code: "NOT_FOUND",
        resource: "property",
        params: { id: otherProperty.id },
      });
    });
  });

  describe("DELETE /api/properties/:id", () => {
    it("should delete the user's property, return 204, and clear preferredPropertyId if it was preferred", async () => {
      const { user, token } = await createTestUser();
      const property = await createTestProperty(user.id);

      await authRequest("/api/auth/me", token, {
        method: "PATCH",
        body: JSON.stringify({ preferredPropertyId: property.id }),
      });

      const response = await authRequest(
        `/api/properties/${property.id}`,
        token,
        { method: "DELETE" },
      );

      expect(response.status).toBe(204);

      const getRes = await authRequest(
        `/api/properties/${property.id}`,
        token,
      );
      expect(getRes.status).toBe(404);

      const meRes = await authRequest("/api/auth/me", token);
      const meBody = (await meRes.json()) as {
        data: { preferredPropertyId: string | null };
      };
      expect(meBody.data.preferredPropertyId).toBeNull();
    });
  });
});
