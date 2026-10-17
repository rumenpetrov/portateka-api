import type { Context } from "hono";
import { ApiError, DuplicateApiError } from "../helpers/errors";
import { ok } from "../helpers/responses";
import { getDb } from "../db";
import { users } from "../db/schema";
import { hashPassword, verifyPassword } from "../utils/password";
import { generateToken } from "../utils/jwt";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import type {
  signUpEmailSchema,
  signInEmailSchema,
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

type AuthContext = Context<AppEnv>;

// Constant decoy hash used when user is not found to prevent timing-based user enumeration.
const DECOY_HASH =
  "pbkdf2$sha256$100000$3qLFHGqxTSVbhRfdCjTUlA==$Oe07AH4z7xVtEX03/3RzLSsbhWRoCxYwRiTmp4q+eWo=";

const UNIQUE_VIOLATION = "23505";

// Drizzle may wrap the driver error, so look at `cause` too.
const getPgError = (err: unknown) => {
  const candidates = [err, (err as { cause?: unknown } | null)?.cause];

  return candidates.find(
    (e): e is { code: string; constraint?: string } =>
      typeof e === "object" &&
      e !== null &&
      (e as { code?: unknown }).code === UNIQUE_VIOLATION,
  );
};

export const signUpEmail = async (c: SignUpEmailContext) => {
  const { email, firstName, lastName, password } = c.req.valid("json");
  const db = getDb(c.env.DATABASE_URL);

  try {
    const [user] = await db
      .insert(users)
      .values({
        email,
        firstName,
        lastName,
        password: await hashPassword(password),
      })
      .returning({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        createdAt: users.createdAt,
      });

    return ok({ c, status: 201 }, user!);
  } catch (err) {
    const pgError = getPgError(err);

    if (pgError) {
      throw new DuplicateApiError("user", { email: "already_exists" });
    }

    throw err;
  }
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
    },
  });
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
