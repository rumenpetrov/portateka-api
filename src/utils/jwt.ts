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

  return {
    sub: payload.sub as string,
    email: payload.email as string,
    firstName: payload.firstName as string,
    lastName: (payload.lastName as string | null) ?? null,
  };
};
