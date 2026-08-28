import type { NextRequest } from "next/server";

/**
 * Public origin for absolute redirects. Behind a reverse proxy, req.nextUrl
 * reflects the internal listener (127.0.0.1:3000), so prefer the configured
 * APP_URL, then the forwarded headers, and only then the request itself.
 */
export function publicOrigin(req: NextRequest): string {
  const configured = process.env.APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  return host ? `${proto}://${host}` : req.nextUrl.origin;
}
