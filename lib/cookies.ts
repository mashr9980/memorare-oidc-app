export const COOKIE = {
  verifier: "mem_cv",
  state: "mem_state",
  nonce: "mem_nonce",
  session: "mem_session",
} as const;

/** Cookies must be Secure in production; allow http for local development. */
export function isSecureRequest(req: {
  nextUrl: { protocol: string };
  headers: { get(name: string): string | null };
}): boolean {
  return (
    req.nextUrl.protocol === "https:" ||
    req.headers.get("x-forwarded-proto") === "https"
  );
}
