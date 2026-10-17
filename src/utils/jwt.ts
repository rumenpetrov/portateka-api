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

export interface EmailVerificationPayload {
  sub: string;
  email: string;
}

export const generateEmailVerificationToken = (
  payload: EmailVerificationPayload,
  secret: string,
) =>
  new SignJWT({
    email: payload.email,
    purpose: "email_verification",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(SYSTEM_CONFIG.emailVerificationExpiresIn)
    .sign(encodeSecret(secret));

export const verifyEmailVerificationToken = async (
  token: string,
  secret: string,
): Promise<EmailVerificationPayload> => {
  const { payload } = await jwtVerify(token, encodeSecret(secret), {
    algorithms: ["HS256"],
  });

  if (
    payload.purpose !== "email_verification" ||
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string"
  ) {
    throw new Error("Invalid email verification token");
  }

  return {
    sub: payload.sub,
    email: payload.email,
  };
};
