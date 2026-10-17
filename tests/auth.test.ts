import { afterEach, describe, expect, it } from "vitest";
import app from "../src/index.ts";
import {
  cleanupDatabase,
  createTestUser,
  testEnv,
} from "./helpers/dbHelpers.ts";

const jsonRequest = (path: string, body: unknown, headers?: HeadersInit) =>
  app.request(
    path,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    },
    testEnv,
  );

describe("Authentication Endpoints", () => {
  afterEach(async () => {
    await cleanupDatabase();
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user with valid data", async () => {
      const userData = {
        email: `Test-${Date.now()}@Example.com`,
        firstName: "John",
        lastName: "Doe",
        password: "TestPassword123!",
      };

      const response = await jsonRequest("/api/auth/register", userData);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body).toEqual({
        data: {
          id: expect.any(String),
          email: userData.email.toLowerCase(),
          firstName: "John",
          lastName: "Doe",
          createdAt: expect.any(String),
        },
      });
    });

    it("should return 409 for duplicate email", async () => {
      const { user } = await createTestUser();

      const response = await jsonRequest("/api/auth/register", {
        email: user.email,
        firstName: "Another",
        password: "TestPassword123!",
      });
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body).toEqual({
        code: "ALREADY_EXISTS",
        resource: "user",
        params: {
          email: "already_exists",
        },
      });
    });

    it("should return 422 for invalid email", async () => {
      const response = await jsonRequest("/api/auth/register", {
        email: "invalid-email",
        firstName: "Test",
        password: "TestPassword123!",
      });
      const body = await response.json();

      expect(response.status).toBe(422);
      expect(body).toEqual({
        code: "VALIDATION_ERROR",
        resource: "user",
        params: {
          email: "invalid_email",
        },
      });
    });

    it("should return 422 for weak password", async () => {
      const response = await jsonRequest("/api/auth/register", {
        email: `test-${Date.now()}@example.com`,
        firstName: "Test",
        password: "short",
      });
      const body = await response.json();

      expect(response.status).toBe(422);
      expect(body).toEqual({
        code: "VALIDATION_ERROR",
        resource: "user",
        params: {
          password: "password_too_short",
        },
      });
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login with valid credentials", async () => {
      const { user, rawPassword } = await createTestUser();

      const response = await jsonRequest("/api/auth/login", {
        email: user.email,
        password: rawPassword,
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        data: {
          token: expect.any(String),
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          },
        },
      });
    });

    it("should return 422 for missing email", async () => {
      const response = await jsonRequest("/api/auth/login", {
        password: "TestPassword123!",
      });
      const body = await response.json();

      expect(response.status).toBe(422);
      expect(body).toEqual({
        code: "VALIDATION_ERROR",
        resource: "user",
        params: {
          email: "required",
        },
      });
    });

    it("should return 401 for invalid password", async () => {
      const { user } = await createTestUser();

      const response = await jsonRequest("/api/auth/login", {
        email: user.email,
        password: "WrongPassword123!",
      });
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body).toEqual({
        code: "UNAUTHORIZED",
        resource: "user",
      });
    });

    it("should return 401 for non-existent user", async () => {
      const response = await jsonRequest("/api/auth/login", {
        email: "nonexistent@example.com",
        password: "TestPassword123!",
      });
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body).toEqual({
        code: "UNAUTHORIZED",
        resource: "user",
      });
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return the authenticated user profile", async () => {
      const { user, token } = await createTestUser();

      const response = await app.request(
        "/api/auth/me",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        testEnv,
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        data: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      });
    });

    it("should return 401 when Authorization header is missing", async () => {
      const response = await app.request("/api/auth/me", {}, testEnv);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body).toEqual({
        code: "UNAUTHORIZED",
        resource: "user",
      });
    });

    it("should return 401 for an invalid token", async () => {
      const response = await app.request(
        "/api/auth/me",
        {
          headers: {
            Authorization: "Bearer invalid.jwt.token",
          },
        },
        testEnv,
      );
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body).toEqual({
        code: "UNAUTHORIZED",
        resource: "user",
      });
    });
  });
});
