import type { NextResponse } from "next/server";

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

/**
 * Clearing a cookie is itself a Set-Cookie, so it has to satisfy the same rules
 * the browser applied when it stored the cookie. A __Host- name is rejected
 * unless the header carries Secure and Path=/ with no Domain, which is why the
 * expiry below hardcodes Secure rather than mirroring the request. Without it
 * the browser silently drops the deletion and the session survives sign out.
 */
export function clearSessionCookies(res: NextResponse, secure: boolean): void {
  const dead = {
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  };
  res.cookies.set({ ...dead, name: HOST_SESSION, secure: true });
  res.cookies.set({ ...dead, name: COOKIE.session, secure });
}
