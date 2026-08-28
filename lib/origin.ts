import type { NextRequest } from "next/server";
export function publicOrigin(req: NextRequest): string {
  const configured = process.env.APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  return host ? `${proto}://${host}` : req.nextUrl.origin;
}
