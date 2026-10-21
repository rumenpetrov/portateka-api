import { SignJWT, jwtVerify } from "jose";
import { SYSTEM_CONFIG } from "../config";

export interface JwtPayload {
  sub: string;
  email: string;
  firstName: string;
  lastName: string | null;
}

const encodeSecret = (secret: string) => new TextEncoder().encode(secret);

export const generateToken = (payload: JwtPayload, secret: string) =>
  new SignJWT({
    email: payload.email,
    firstName: payload.firstName,
    lastName: payload.lastName,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(SYSTEM_CONFIG.jwtExpiresIn)
    .sign(encodeSecret(secret));

export const verifyToken = async (
  token: string,
  secret: string,
): Promise<JwtPayload> => {
  const { payload } = await jwtVerify(token, encodeSecret(secret), {
    algorithms: ["HS256"],
  });

  if (payload.purpose) {
    throw new Error("Invalid token purpose");
  }

  return {
    sub: payload.sub as string,
    email: payload.email as string,
    firstName: payload.firstName as string,
    lastName: (payload.lastName as string | null) ?? null,
  };
};

export interface PurposeTokenPayload {
  sub: string;
  email: string;
  pwdHashSlice: string;
}

type TokenPurpose = "email_verification" | "password_reset";

export const getPasswordHashSlice = (passwordHash: string) =>
  passwordHash.slice(-16);

const generatePurposeToken = (
  payload: PurposeTokenPayload,
  secret: string,
  purpose: TokenPurpose,
  expiresIn: string,
) =>
  new SignJWT({
    email: payload.email,
    pwdHashSlice: payload.pwdHashSlice,
    purpose,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(encodeSecret(secret));

const verifyPurposeToken = async (
  token: string,
  secret: string,
  expectedPurpose: TokenPurpose,
): Promise<PurposeTokenPayload> => {
  const { payload } = await jwtVerify(token, encodeSecret(secret), {
    algorithms: ["HS256"],
  });

  if (
    payload.purpose !== expectedPurpose ||
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string" ||
    typeof payload.pwdHashSlice !== "string"
  ) {
    throw new Error(`Invalid ${expectedPurpose} token`);
  }

  return {
    sub: payload.sub,
    email: payload.email,
    pwdHashSlice: payload.pwdHashSlice,
  };
};

export const generateEmailVerificationToken = (
  payload: PurposeTokenPayload,
  secret: string,
) =>
  generatePurposeToken(
    payload,
    secret,
    "email_verification",
    SYSTEM_CONFIG.emailVerificationExpiresIn,
  );

export const verifyEmailVerificationToken = (
  token: string,
  secret: string,
): Promise<PurposeTokenPayload> =>
  verifyPurposeToken(token, secret, "email_verification");

export const generatePasswordResetToken = (
  payload: PurposeTokenPayload,
  secret: string,
) =>
  generatePurposeToken(
    payload,
    secret,
    "password_reset",
    SYSTEM_CONFIG.passwordResetExpiresIn,
  );

export const verifyPasswordResetToken = (
  token: string,
  secret: string,
): Promise<PurposeTokenPayload> =>
  verifyPurposeToken(token, secret, "password_reset");
