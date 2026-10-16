import { SignJWT, jwtVerify } from "jose";
import { SYSTEM_CONFIG } from "../config";

export interface JwtPayload {
  sub: string;
  email: string;
  username: string;
}

const encodeSecret = (secret: string) => new TextEncoder().encode(secret);

export const generateToken = (payload: JwtPayload, secret: string) =>
  new SignJWT({ email: payload.email, username: payload.username })
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
    username: payload.username as string,
  };
};
