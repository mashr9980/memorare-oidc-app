import "server-only";
import { EncryptJWT, jwtDecrypt } from "jose";
import { createHash } from "crypto";
import { cookies } from "next/headers";
import { COOKIE, HOST_SESSION } from "./cookies";

export type Session = {
  sub: string;
  email: string;
  name?: string | null;
  picture?: string | null;
  accessToken: string;
};

/** A256GCM needs exactly 32 bytes; derive them from the configured secret. */
function key(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters");
  }
  return new Uint8Array(createHash("sha256").update(secret).digest());
}

/** Encrypted (JWE) so the access token is opaque even to the cookie holder. */
export async function sealSession(session: Session, ttlSeconds: number): Promise<string> {
  return new EncryptJWT({ ...session })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${Math.max(60, ttlSeconds)}s`)
    .encrypt(key());
}

export async function unsealSession(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtDecrypt(token, key());
    if (!payload.sub && !payload.email) return null;
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

/** Read the current session from the request cookies. Server-side only. */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const raw = jar.get(HOST_SESSION)?.value ?? jar.get(COOKIE.session)?.value;
  return raw ? unsealSession(raw) : null;
}
