/**
 * Shared avatar rules. No server-only import: the browser pre-checks with the
 * same constants the server enforces, so the two can never drift.
 */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const AVATAR_ACCEPT = AVATAR_TYPES.join(",");

export function isSafeSub(sub: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(sub);
}

export function avatarKey(sub: string): string {
  return `avatars/${sub}.webp`;
}

/**
 * Sniff the real format instead of trusting the browser's Content-Type. A file
 * claiming image/png while carrying SVG or HTML is the usual stored-XSS trick.
 */
export function sniffImageType(buf: Uint8Array): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  const ascii = (a: number, b: number) => String.fromCharCode(...buf.slice(a, b));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}
