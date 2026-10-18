import { afterEach, describe, expect, it, vi } from "vitest";
import app from "../src/index.ts";
import {
  cleanupDatabase,
  createTestUser,
  testDb,
  testEnv,
} from "./helpers/dbHelpers.ts";
import { users } from "../src/db/schema.ts";
import { eq } from "drizzle-orm";
import {
  generateEmailVerificationToken,
  generatePasswordResetToken,
  getPasswordHashSlice,
} from "../src/utils/jwt.ts";
import * as emailUtils from "../src/utils/email.ts";

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
    vi.restoreAllMocks();
    await cleanupDatabase();
  });

  describe("POST /api/auth/sign-up/email", () => {
    it("should register a new user with emailVerified=false and return verification_email_sent", async () => {
      const sendSpy = vi.spyOn(emailUtils, "sendVerificationEmail");
      const userData = {
        email: `Test-${Date.now()}@Example.com`,
        firstName: "John",
        lastName: "Doe",
        password: "TestPassword123!",
      };

      const response = await jsonRequest("/api/auth/sign-up/email", userData);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        data: {
          message: "verification_email_sent",
        },
      });
      expect(sendSpy).toHaveBeenCalledTimes(1);

      const [dbUser] = await testDb
        .select()
        .from(users)
        .where(eq(users.email, userData.email.toLowerCase()));
      expect(dbUser).toBeDefined();
      expect(dbUser?.emailVerified).toBe(false);
    });

    it("should roll back user creation and return 500 if verification email fails to send", async () => {
      vi.spyOn(emailUtils, "sendVerificationEmail").mockRejectedValueOnce(
        new Error("Resend API error"),
      );

      const email = `rollback-${Date.now()}@example.com`;
      const response = await jsonRequest("/api/auth/sign-up/email", {
        email,
        firstName: "Rollback",
        password: "TestPassword123!",
      });
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        code: "INTERNAL_SERVER_ERROR",
        resource: "user",
      });

      const dbUsers = await testDb
        .select()
        .from(users)
        .where(eq(users.email, email));
      expect(dbUsers).toHaveLength(0);
    });

    it("should return 200 verification_email_sent without sending email for already verified email", async () => {
      const { user } = await createTestUser({ emailVerified: true });
      const sendSpy = vi.spyOn(emailUtils, "sendVerificationEmail");

      const response = await jsonRequest("/api/auth/sign-up/email", {
        email: user.email,
        firstName: "Another",
        password: "TestPassword123!",
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        data: {
          message: "verification_email_sent",
        },
      });
      expect(sendSpy).not.toHaveBeenCalled();
    });

    it("should resend verification email and return 200 when existing user is unverified", async () => {
      const { user } = await createTestUser({ emailVerified: false });
      const sendSpy = vi.spyOn(emailUtils, "sendVerificationEmail");

      const response = await jsonRequest("/api/auth/sign-up/email", {
        email: user.email,
        firstName: "UpdatedName",
        password: "TestPassword123!",
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        data: {
          message: "verification_email_sent",
        },
      });
      expect(sendSpy).toHaveBeenCalledTimes(1);
    });

    it("should return 422 for invalid email", async () => {
      const response = await jsonRequest("/api/auth/sign-up/email", {
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
      const response = await jsonRequest("/api/auth/sign-up/email", {
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

  describe("POST /api/auth/verify-email", () => {
    it("should verify a user's email with a valid verification token", async () => {
      const { user } = await createTestUser({ emailVerified: false });
      const verificationToken = await generateEmailVerificationToken(
        {
          sub: user.id,
          email: user.email,
          pwdHashSlice: getPasswordHashSlice(user.password),
        },
        testEnv.JWT_SECRET,
      );

      const response = await jsonRequest("/api/auth/verify-email", {
        token: verificationToken,
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        data: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          emailVerified: true,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      });
    });

    it("should reject an older verification token if an unverified user's password was overwritten", async () => {
      const { user } = await createTestUser({ emailVerified: false });
      const originalToken = await generateEmailVerificationToken(
        {
          sub: user.id,
          email: user.email,
          pwdHashSlice: getPasswordHashSlice(user.password),
        },
        testEnv.JWT_SECRET,
      );

      // Overwrite the unverified account via a subsequent sign-up call
      await jsonRequest("/api/auth/sign-up/email", {
        email: user.email,
        firstName: "Overwritten",
        password: "DifferentPassword123!",
      });

      const response = await jsonRequest("/api/auth/verify-email", {
        token: originalToken,
      });
      const body = await response.json();

      expect(response.status).toBe(422);
      expect(body).toEqual({
        code: "VALIDATION_ERROR",
        resource: "user",
        params: {
          token: "invalid_or_expired_token",
        },
      });
    });

    it("should return 422 for an invalid or expired verification token", async () => {
      const response = await jsonRequest("/api/auth/verify-email", {
        token: "invalid.jwt.token",
      });
      const body = await response.json();

      expect(response.status).toBe(422);
      expect(body).toEqual({
        code: "VALIDATION_ERROR",
        resource: "user",
        params: {
          token: "invalid_or_expired_token",
        },
      });
    });
  });

  describe("POST /api/auth/sign-in/email", () => {
    it("should login with valid credentials when email is verified", async () => {
      const { user, rawPassword } = await createTestUser({
        emailVerified: true,
      });

      const response = await jsonRequest("/api/auth/sign-in/email", {
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
            emailVerified: true,
          },
        },
      });
    });

    it("should return 403 when email is not verified", async () => {
      const { user, rawPassword } = await createTestUser({
        emailVerified: false,
      });

      const response = await jsonRequest("/api/auth/sign-in/email", {
        email: user.email,
        password: rawPassword,
      });
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body).toEqual({
        code: "FORBIDDEN",
        resource: "user",
        params: {
          email: "email_not_verified",
        },
      });
    });

    it("should return 422 for missing email", async () => {
      const response = await jsonRequest("/api/auth/sign-in/email", {
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

    it("should return 422 when password exceeds 128 characters", async () => {
      const response = await jsonRequest("/api/auth/sign-in/email", {
        email: "user@example.com",
        password: "a".repeat(129),
      });
      const body = await response.json();

      expect(response.status).toBe(422);
      expect(body).toEqual({
        code: "VALIDATION_ERROR",
        resource: "user",
        params: {
          password: "password_too_long",
        },
      });
    });

    it("should return 401 for invalid password", async () => {
      const { user } = await createTestUser();

      const response = await jsonRequest("/api/auth/sign-in/email", {
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
      const response = await jsonRequest("/api/auth/sign-in/email", {
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
          emailVerified: true,
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

  describe("POST /api/auth/forgot-password", () => {
    it("should send password reset email and return 200 for existing user", async () => {
      const { user } = await createTestUser();
      const sendSpy = vi.spyOn(emailUtils, "sendPasswordResetEmail");

      const response = await jsonRequest("/api/auth/forgot-password", {
        email: user.email,
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        data: {
          message: "password_reset_email_sent",
        },
      });
      expect(sendSpy).toHaveBeenCalledTimes(1);
    });

    it("should return 200 without sending email for non-existent user (anti-enumeration)", async () => {
      const sendSpy = vi.spyOn(emailUtils, "sendPasswordResetEmail");

      const response = await jsonRequest("/api/auth/forgot-password", {
        email: "nobody@example.com",
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        data: {
          message: "password_reset_email_sent",
        },
      });
      expect(sendSpy).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/auth/reset-password", () => {
    it("should reset password with valid token, mark emailVerified=true, and invalidate token for reuse", async () => {
      const { user } = await createTestUser({ emailVerified: false });
      const resetToken = await generatePasswordResetToken(
        {
          sub: user.id,
          email: user.email,
          pwdHashSlice: getPasswordHashSlice(user.password),
        },
        testEnv.JWT_SECRET,
      );

      const newPassword = "NewStrongPassword123!";
      const response = await jsonRequest("/api/auth/reset-password", {
        token: resetToken,
        password: newPassword,
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        data: {
          message: "password_reset_successful",
        },
      });

      // Verify user can sign in with new password
      const signInResponse = await jsonRequest("/api/auth/sign-in/email", {
        email: user.email,
        password: newPassword,
      });
      expect(signInResponse.status).toBe(200);

      // Reusing the same reset token must fail with 422
      const reuseResponse = await jsonRequest("/api/auth/reset-password", {
        token: resetToken,
        password: "AnotherStrongPassword123!",
      });
      const reuseBody = await reuseResponse.json();
      expect(reuseResponse.status).toBe(422);
      expect(reuseBody).toEqual({
        code: "VALIDATION_ERROR",
        resource: "user",
        params: {
          token: "invalid_or_expired_token",
        },
      });
    });

    it("should return 422 for invalid reset token", async () => {
      const response = await jsonRequest("/api/auth/reset-password", {
        token: "invalid.jwt.token",
        password: "NewStrongPassword123!",
      });
      const body = await response.json();

      expect(response.status).toBe(422);
      expect(body).toEqual({
        code: "VALIDATION_ERROR",
        resource: "user",
        params: {
          token: "invalid_or_expired_token",
        },
      });
    });
  });
});

