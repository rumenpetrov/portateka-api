import type { Context } from "hono";
import {
  ApiError,
  InternalServerApiError,
  NotFoundApiError,
  ValidationApiError,
} from "../helpers/errors";
import { ok } from "../helpers/responses";
import { getDb } from "../db";
import { users } from "../db/schema";
import { hashPassword, verifyPassword } from "../utils/password";
import {
  generateEmailVerificationToken,
  generatePasswordResetToken,
  generateToken,
  getPasswordHashSlice,
  verifyEmailVerificationToken,
  verifyPasswordResetToken,
} from "../utils/jwt";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "../utils/email";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import type {
  forgotPasswordSchema,
  resetPasswordSchema,
  signUpEmailSchema,
  signInEmailSchema,
  verifyEmailSchema,
} from "../validators/authValidators";
import type { AppEnv } from "../types/env";

type SignUpEmailContext = Context<
  AppEnv,
  string,
  { in: { json: unknown }; out: { json: z.output<typeof signUpEmailSchema> } }
>;

type SignInEmailContext = Context<
  AppEnv,
  string,
  { in: { json: unknown }; out: { json: z.output<typeof signInEmailSchema> } }
>;

type VerifyEmailContext = Context<
  AppEnv,
  string,
  { in: { json: unknown }; out: { json: z.output<typeof verifyEmailSchema> } }
>;

type ForgotPasswordContext = Context<
  AppEnv,
  string,
  {
    in: { json: unknown };
    out: { json: z.output<typeof forgotPasswordSchema> };
  }
>;

type ResetPasswordContext = Context<
  AppEnv,
  string,
  { in: { json: unknown }; out: { json: z.output<typeof resetPasswordSchema> } }
>;

type AuthContext = Context<AppEnv>;

// Constant decoy hash used when user is not found to prevent timing-based user enumeration.
const DECOY_HASH =
  "pbkdf2$sha256$100000$3qLFHGqxTSVbhRfdCjTUlA==$Oe07AH4z7xVtEX03/3RzLSsbhWRoCxYwRiTmp4q+eWo=";

export const signUpEmail = async (c: SignUpEmailContext) => {
  const { email, firstName, lastName, password } = c.req.valid("json");
  const db = getDb(c.env.DATABASE_URL);

  // Always hash password first for consistent timing regardless of whether the email exists.
  const hashedPassword = await hashPassword(password);

  const [existingUser] = await db
    .select({
      id: users.id,
      email: users.email,
      emailVerified: users.emailVerified,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // If the account already exists and is verified, return the same response silently (protects against enumeration and email quota burn).
  if (existingUser?.emailVerified) {
    return ok(c, { message: "verification_email_sent" });
  }

  let targetUserId: string;
  let isNewUser = false;

  if (existingUser) {
    // Existing unverified account: update details and resend verification email.
    await db
      .update(users)
      .set({
        firstName,
        lastName: lastName ?? null,
        password: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingUser.id));

    targetUserId = existingUser.id;
  } else {
    const [createdUser] = await db
      .insert(users)
      .values({
        email,
        firstName,
        lastName,
        password: hashedPassword,
      })
      .returning({
        id: users.id,
      });

    targetUserId = createdUser!.id;
    isNewUser = true;
  }

  try {
    const verificationToken = await generateEmailVerificationToken(
      {
        sub: targetUserId,
        email,
      },
      c.env.JWT_SECRET,
    );

    await sendVerificationEmail({
      to: email,
      firstName,
      token: verificationToken,
      webAppBaseUrl: c.env.WEB_APP_BASE_URL,
      verifyEmailPrefix: c.env.WEB_APP_VERIFY_EMAIL_PREFIX,
      resendApiKey: c.env.RESEND_API_KEY,
    });
  } catch (err) {
    console.error("Failed to send verification email:", err);
    if (isNewUser) {
      await db.delete(users).where(eq(users.id, targetUserId));
    }
    throw new InternalServerApiError("user");
  }

  return ok(c, { message: "verification_email_sent" });
};

export const signInEmail = async (c: SignInEmailContext) => {
  const { email, password } = c.req.valid("json");
  const db = getDb(c.env.DATABASE_URL);

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      password: users.password,
      emailVerified: users.emailVerified,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Constant-time protection: always run verifyPassword even if user wasn't found
  const passwordHash = user?.password ?? DECOY_HASH;
  const isValid = await verifyPassword(password, passwordHash);

  if (!user || !isValid) {
    throw new ApiError("UNAUTHORIZED", "user");
  }

  if (!user.emailVerified) {
    throw new ApiError("FORBIDDEN", "user", { email: "email_not_verified" });
  }

  const token = await generateToken(
    {
      sub: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    },
    c.env.JWT_SECRET,
  );

  return ok(c, {
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerified: user.emailVerified,
    },
  });
};

export const verifyEmail = async (c: VerifyEmailContext) => {
  const { token } = c.req.valid("json");
  const db = getDb(c.env.DATABASE_URL);

  let payload: { sub: string; email: string };
  try {
    payload = await verifyEmailVerificationToken(token, c.env.JWT_SECRET);
  } catch {
    throw new ValidationApiError("user", { token: "invalid_or_expired_token" });
  }

  const [updatedUser] = await db
    .update(users)
    .set({
      emailVerified: true,
      updatedAt: new Date(),
    })
    .where(and(eq(users.id, payload.sub), eq(users.email, payload.email)))
    .returning({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    });

  if (!updatedUser) {
    throw new NotFoundApiError("user", { id: payload.sub });
  }

  return ok(c, updatedUser);
};

export const forgotPassword = async (c: ForgotPasswordContext) => {
  const { email } = c.req.valid("json");
  const db = getDb(c.env.DATABASE_URL);

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      password: users.password,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    return ok(c, { message: "password_reset_email_sent" });
  }

  try {
    const resetToken = await generatePasswordResetToken(
      {
        sub: user.id,
        email: user.email,
        pwdHashSlice: getPasswordHashSlice(user.password),
      },
      c.env.JWT_SECRET,
    );

    await sendPasswordResetEmail({
      to: user.email,
      firstName: user.firstName,
      token: resetToken,
      webAppBaseUrl: c.env.WEB_APP_BASE_URL,
      resetPasswordPrefix: c.env.WEB_APP_RESET_PASSWORD_PREFIX,
      resendApiKey: c.env.RESEND_API_KEY,
    });
  } catch (err) {
    console.error("Failed to send password reset email:", err);
    throw new InternalServerApiError("user");
  }

  return ok(c, { message: "password_reset_email_sent" });
};

export const resetPassword = async (c: ResetPasswordContext) => {
  const { token, password } = c.req.valid("json");
  const db = getDb(c.env.DATABASE_URL);

  let payload: { sub: string; email: string; pwdHashSlice: string };
  try {
    payload = await verifyPasswordResetToken(token, c.env.JWT_SECRET);
  } catch {
    throw new ValidationApiError("user", { token: "invalid_or_expired_token" });
  }

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      password: users.password,
    })
    .from(users)
    .where(and(eq(users.id, payload.sub), eq(users.email, payload.email)))
    .limit(1);

  if (!user || getPasswordHashSlice(user.password) !== payload.pwdHashSlice) {
    throw new ValidationApiError("user", { token: "invalid_or_expired_token" });
  }

  const hashedPassword = await hashPassword(password);

  await db
    .update(users)
    .set({
      password: hashedPassword,
      emailVerified: true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return ok(c, { message: "password_reset_successful" });
};

export const me = async (c: AuthContext) => {
  const { sub } = c.get("user");
  const db = getDb(c.env.DATABASE_URL);

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, sub))
    .limit(1);

  if (!user) {
    throw new ApiError("UNAUTHORIZED", "user");
  }

  return ok(c, user);
};
