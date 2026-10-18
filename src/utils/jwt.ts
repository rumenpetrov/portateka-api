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
  pwdHashSlice: string;
}

export const generateEmailVerificationToken = (
  payload: EmailVerificationPayload,
  secret: string,
) =>
  new SignJWT({
    email: payload.email,
    pwdHashSlice: payload.pwdHashSlice,
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
    typeof payload.email !== "string" ||
    typeof payload.pwdHashSlice !== "string"
  ) {
    throw new Error("Invalid email verification token");
  }

  return {
    sub: payload.sub,
    email: payload.email,
    pwdHashSlice: payload.pwdHashSlice,
  };
};

export interface PasswordResetPayload {
  sub: string;
  email: string;
  pwdHashSlice: string;
}

export const getPasswordHashSlice = (passwordHash: string) =>
  passwordHash.slice(-16);

export const generatePasswordResetToken = (
  payload: PasswordResetPayload,
  secret: string,
) =>
  new SignJWT({
    email: payload.email,
    pwdHashSlice: payload.pwdHashSlice,
    purpose: "password_reset",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(SYSTEM_CONFIG.passwordResetExpiresIn)
    .sign(encodeSecret(secret));

export const verifyPasswordResetToken = async (
  token: string,
  secret: string,
): Promise<PasswordResetPayload> => {
  const { payload } = await jwtVerify(token, encodeSecret(secret), {
    algorithms: ["HS256"],
  });

  if (
    payload.purpose !== "password_reset" ||
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string" ||
    typeof payload.pwdHashSlice !== "string"
  ) {
    throw new Error("Invalid password reset token");
  }

  return {
    sub: payload.sub,
    email: payload.email,
    pwdHashSlice: payload.pwdHashSlice,
  };
};
