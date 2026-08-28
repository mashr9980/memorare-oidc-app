export const COOKIE = {
  verifier: "mem_cv",
  state: "mem_state",
  nonce: "mem_nonce",
  session: "mem_session",
  ssoTried: "mem_sso",
} as const;

/**
 * __Host- pins a cookie to the exact origin (Secure, Path=/, no Domain), so a
 * subdomain can never overwrite it. It only works over HTTPS, so plain-HTTP
 * local dev keeps the unprefixed name and readers accept either.
 */
export const HOST_SESSION = `__Host-${COOKIE.session}`;

export function sessionCookieName(secure: boolean): string {
  return secure ? HOST_SESSION : COOKIE.session;
}

export function isSecureRequest(req: {
  nextUrl: { protocol: string };
  headers: { get(name: string): string | null };
}): boolean {
  return (
    req.nextUrl.protocol === "https:" ||
    req.headers.get("x-forwarded-proto") === "https"
  );
}
