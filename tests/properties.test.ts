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
    it("should create a user's first property as preferred=true automatically", async () => {
      const { user, token } = await createTestUser();

      const response = await authRequest("/api/properties", token, {
        method: "POST",
        body: JSON.stringify({
          name: "Varna Briz",
          description: "Sea view apartment",
          notes: "Meter in hallway",
          preferred: false, // Even if false is sent, first property is forced to true
        }),
      });
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body).toEqual({
        data: {
          id: expect.any(String),
          userId: user.id,
          name: "Varna Briz",
          description: "Sea view apartment",
          notes: "Meter in hallway",
          preferred: true,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      });
    });

    it("should default subsequent properties to preferred=false and switch preferred when preferred=true is passed", async () => {
      const { user, token } = await createTestUser();
      const first = await createTestProperty(user.id, {
        name: "First Property",
        preferred: true,
      });

      // Second property without `preferred` -> defaults to false
      const secondRes = await authRequest("/api/properties", token, {
        method: "POST",
        body: JSON.stringify({ name: "Second Property" }),
      });
      const secondBody = (await secondRes.json()) as {
        data: { id: string; preferred: boolean };
      };

      expect(secondRes.status).toBe(201);
      expect(secondBody.data.preferred).toBe(false);

      // Third property with `preferred: true` -> unsets first property
      const thirdRes = await authRequest("/api/properties", token, {
        method: "POST",
        body: JSON.stringify({ name: "Third Property", preferred: true }),
      });
      const thirdBody = (await thirdRes.json()) as {
        data: { id: string; preferred: boolean };
      };

      expect(thirdRes.status).toBe(201);
      expect(thirdBody.data.preferred).toBe(true);

      // Verify first property is now preferred=false
      const firstCheckRes = await authRequest(
        `/api/properties/${first.id}`,
        token,
      );
      const firstCheckBody = (await firstCheckRes.json()) as {
        data: { preferred: boolean };
      };
      expect(firstCheckBody.data.preferred).toBe(false);
    });

    it("should atomically switch preferred property on concurrent preferred=true creations", async () => {
      const { user, token } = await createTestUser();
      await createTestProperty(user.id, {
        name: "Initial Preferred",
        preferred: true,
      });

      const [resA, resB] = await Promise.all([
        authRequest("/api/properties", token, {
          method: "POST",
          body: JSON.stringify({ name: "Concurrent A", preferred: true }),
        }),
        authRequest("/api/properties", token, {
          method: "POST",
          body: JSON.stringify({ name: "Concurrent B", preferred: true }),
        }),
      ]);

      expect(resA.status).toBe(201);
      expect(resB.status).toBe(201);

      const listRes = await authRequest("/api/properties", token);
      const listBody = (await listRes.json()) as {
        data: Array<{ preferred: boolean }>;
      };
      const preferredCount = listBody.data.filter((p) => p.preferred).length;
      expect(preferredCount).toBe(1);
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
    it("should return only the authenticated user's properties with preferred first", async () => {
      const { user: user1, token: token1 } = await createTestUser();
      const { user: user2 } = await createTestUser();

      await createTestProperty(user1.id, {
        name: "Non-preferred",
        preferred: false,
      });
      await createTestProperty(user1.id, {
        name: "Preferred",
        preferred: true,
      });
      await createTestProperty(user2.id, {
        name: "Other User Property",
        preferred: true,
      });

      const response = await authRequest("/api/properties", token1);
      const body = (await response.json()) as {
        data: Array<{ name: string; preferred: boolean }>;
      };

      expect(response.status).toBe(200);
      expect(body.data).toHaveLength(2);
      expect(body.data[0]?.name).toBe("Preferred");
      expect(body.data[1]?.name).toBe("Non-preferred");
    });
  });

  describe("GET /api/properties/:id", () => {
    it("should return a specific property owned by the user", async () => {
      const { user, token } = await createTestUser();
      const property = await createTestProperty(user.id, {
        name: "My Property",
        preferred: true,
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
          preferred: true,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      });
    });

    it("should return 404 when accessing another user's property", async () => {
      const { token: token1 } = await createTestUser();
      const { user: user2 } = await createTestUser();
      const otherProperty = await createTestProperty(user2.id, {
        preferred: true,
      });

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
    it("should prevent unsetting preferred=false when user has only 1 property", async () => {
      const { user, token } = await createTestUser();
      const onlyProperty = await createTestProperty(user.id, {
        name: "Only Property",
        preferred: true,
      });

      const response = await authRequest(
        `/api/properties/${onlyProperty.id}`,
        token,
        {
          method: "PATCH",
          body: JSON.stringify({ preferred: false }),
        },
      );
      const body = await response.json();

      expect(response.status).toBe(422);
      expect(body).toEqual({
        code: "VALIDATION_ERROR",
        resource: "property",
        params: {
          preferred: "cannot_unset_only_property",
        },
      });
    });

    it("should switch preferred property and unset the previous one", async () => {
      const { user, token } = await createTestUser();
      const first = await createTestProperty(user.id, {
        name: "First",
        preferred: true,
      });
      const second = await createTestProperty(user.id, {
        name: "Second",
        preferred: false,
      });

      const response = await authRequest(
        `/api/properties/${second.id}`,
        token,
        {
          method: "PATCH",
          body: JSON.stringify({ name: "Second Updated", preferred: true }),
        },
      );
      const body = (await response.json()) as {
        data: { name: string; preferred: boolean };
      };

      expect(response.status).toBe(200);
      expect(body.data.name).toBe("Second Updated");
      expect(body.data.preferred).toBe(true);

      const firstCheckRes = await authRequest(
        `/api/properties/${first.id}`,
        token,
      );
      const firstCheckBody = (await firstCheckRes.json()) as {
        data: { preferred: boolean };
      };
      expect(firstCheckBody.data.preferred).toBe(false);
    });
  });

  describe("DELETE /api/properties/:id", () => {
    it("should delete the user's property and return 204", async () => {
      const { user, token } = await createTestUser();
      const property = await createTestProperty(user.id, { preferred: true });

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
    });
  });
});
