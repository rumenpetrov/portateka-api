import { afterEach, describe, expect, it, vi } from "vitest";
import app from "@/index.ts";
import {
  cleanupDatabase,
  createTestUser,
  testDb,
  testEnv,
} from "./helpers/dbHelpers.ts";
import { users } from "@/db/schema.ts";
import { eq } from "drizzle-orm";
import { EMAIL_TEMPLATES } from "@/emails/index.ts";
import { resolveLocaleFromHeader } from "@/utils/locale.ts";
import * as emailUtils from "@/utils/email.ts";

const jsonRequest = (
  path: string,
  body: unknown,
  init: { method?: string; headers?: Record<string, string> } = {},
) =>
  app.request(
    path,
    {
      method: init.method ?? "POST",
      headers: {
        "Content-Type": "application/json",
        ...init.headers,
      },
      body: JSON.stringify(body),
    },
    testEnv,
  );

const signUpBody = (overrides: Record<string, unknown> = {}) => ({
  email: `locale-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
  firstName: "Locale",
  password: "TestPassword123!",
  ...overrides,
});

const getStoredLocale = async (email: string) => {
  const [dbUser] = await testDb
    .select({ locale: users.locale })
    .from(users)
    .where(eq(users.email, email));
  return dbUser?.locale;
};

describe("resolveLocaleFromHeader", () => {
  it("returns the default locale when the header is missing or unsupported", () => {
    expect(resolveLocaleFromHeader(undefined)).toBe("en-US");
    expect(resolveLocaleFromHeader("")).toBe("en-US");
    expect(resolveLocaleFromHeader("fr-FR,de;q=0.9")).toBe("en-US");
  });

  it("matches exact tags case-insensitively and by primary language", () => {
    expect(resolveLocaleFromHeader("BG-bg")).toBe("bg-BG");
    expect(resolveLocaleFromHeader("bg")).toBe("bg-BG");
    expect(resolveLocaleFromHeader("en-GB")).toBe("en-US");
  });

  it("respects q-values and order", () => {
    expect(resolveLocaleFromHeader("en;q=0.5,bg;q=0.9")).toBe("bg-BG");
    expect(resolveLocaleFromHeader("fr,bg-BG,en")).toBe("bg-BG");
    expect(resolveLocaleFromHeader("bg;q=0,en")).toBe("en-US");
  });
});

describe("EMAIL_TEMPLATES", () => {
  it("renders localized content with interpolated values", () => {
    const params = {
      firstName: "Ivan",
      url: "https://example.com/verify?token=abc",
      expiresInHours: 24,
    };

    const en = EMAIL_TEMPLATES["en-US"].verification(params);
    const bg = EMAIL_TEMPLATES["bg-BG"].verification(params);

    expect(en.subject).toBe("Verify your Portateka email address");
    expect(en.html).toContain("24 hours");
    expect(bg.subject).toBe("Потвърдете имейл адреса си в Portateka");
    expect(bg.html).toContain("24 часа");
    expect(bg.html).toContain(params.url);
    expect(bg.html).toContain("Ivan");
  });
});

describe("User locale", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await cleanupDatabase();
  });

  describe("POST /api/auth/sign-up/email", () => {
    it("stores and uses the locale from the request body", async () => {
      const sendSpy = vi.spyOn(emailUtils, "sendVerificationEmail");
      const body = signUpBody({ locale: "bg-BG" });

      const response = await jsonRequest("/api/auth/sign-up/email", body);

      expect(response.status).toBe(200);
      expect(await getStoredLocale(body.email)).toBe("bg-BG");
      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({ locale: "bg-BG" }),
      );
    });

    it("prefers the body locale over Accept-Language", async () => {
      const body = signUpBody({ locale: "en-US" });

      await jsonRequest("/api/auth/sign-up/email", body, {
        headers: { "Accept-Language": "bg-BG" },
      });

      expect(await getStoredLocale(body.email)).toBe("en-US");
    });

    it("falls back to Accept-Language when the body has no locale", async () => {
      const body = signUpBody();

      await jsonRequest("/api/auth/sign-up/email", body, {
        headers: { "Accept-Language": "bg,en;q=0.8" },
      });

      expect(await getStoredLocale(body.email)).toBe("bg-BG");
    });

    it("falls back to en-US when neither body nor header provide a locale", async () => {
      const body = signUpBody();

      await jsonRequest("/api/auth/sign-up/email", body);

      expect(await getStoredLocale(body.email)).toBe("en-US");
    });

    it("updates the locale when an unverified user signs up again", async () => {
      const { user } = await createTestUser({
        emailVerified: false,
        locale: "en-US",
      });

      await jsonRequest(
        "/api/auth/sign-up/email",
        signUpBody({ email: user.email, locale: "bg-BG" }),
      );

      expect(await getStoredLocale(user.email)).toBe("bg-BG");
    });

    it("returns 422 invalid_locale for an unsupported locale", async () => {
      const response = await jsonRequest(
        "/api/auth/sign-up/email",
        signUpBody({ locale: "fr-FR" }),
      );

      expect(response.status).toBe(422);
      expect(await response.json()).toEqual({
        code: "VALIDATION_ERROR",
        resource: "user",
        params: { locale: "invalid_locale" },
      });
    });
  });

  describe("PATCH /api/auth/me", () => {
    it("updates the locale and returns it", async () => {
      const { user, token } = await createTestUser();

      const response = await jsonRequest(
        "/api/auth/me",
        { locale: "bg-BG" },
        { method: "PATCH", headers: { Authorization: `Bearer ${token}` } },
      );
      const body = (await response.json()) as { data: { locale: string } };

      expect(response.status).toBe(200);
      expect(body.data.locale).toBe("bg-BG");
      expect(await getStoredLocale(user.email)).toBe("bg-BG");
    });

    it("returns 422 invalid_locale for an unsupported locale", async () => {
      const { token } = await createTestUser();

      const response = await jsonRequest(
        "/api/auth/me",
        { locale: "de" },
        { method: "PATCH", headers: { Authorization: `Bearer ${token}` } },
      );

      expect(response.status).toBe(422);
      expect(await response.json()).toEqual({
        code: "VALIDATION_ERROR",
        resource: "user",
        params: { locale: "invalid_locale" },
      });
    });
  });

  describe("emails for existing users", () => {
    it("forgot-password uses the stored locale and ignores Accept-Language", async () => {
      const { user } = await createTestUser({ locale: "bg-BG" });
      const sendSpy = vi.spyOn(emailUtils, "sendPasswordResetEmail");

      await jsonRequest(
        "/api/auth/forgot-password",
        { email: user.email },
        { headers: { "Accept-Language": "en-US" } },
      );

      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({ locale: "bg-BG" }),
      );
    });

    it("account deletion email uses the stored locale", async () => {
      const { token } = await createTestUser({ locale: "bg-BG" });
      const sendSpy = vi.spyOn(emailUtils, "sendAccountDeletedEmail");

      const response = await app.request(
        "/api/auth/me",
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
        testEnv,
      );

      expect(response.status).toBe(204);
      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({ locale: "bg-BG" }),
      );
    });
  });
});
