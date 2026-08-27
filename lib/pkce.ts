import { createHash, randomBytes } from "crypto";

const b64url = (buf: Buffer) => buf.toString("base64url");

/** RFC 7636 code_verifier: 43 chars of base64url from 32 random bytes. */
export const createVerifier = (): string => b64url(randomBytes(32));

/** S256 challenge: BASE64URL(SHA256(ASCII(code_verifier))). */
export const challengeFor = (verifier: string): string =>
  b64url(createHash("sha256").update(verifier, "ascii").digest());

/** Random CSRF state value. */
export const createState = (): string => b64url(randomBytes(16));

/** Constant-time-ish comparison for state validation. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
