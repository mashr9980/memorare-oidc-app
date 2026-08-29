import { NextRequest, NextResponse } from "next/server";
import { COOKIE, clearSessionCookies, isSecureRequest } from "@/lib/cookies";
import { publicOrigin } from "@/lib/origin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authBase = process.env.AUTH_BASE ?? "https://auth.memorare.ai";
  const secure = isSecureRequest(req);

  const target = new URL(`${authBase.replace(/\/$/, "")}/logout`);
  target.searchParams.set("return_to", `${publicOrigin(req)}/`);

  const res = NextResponse.redirect(target.toString(), { status: 303 });
  clearSessionCookies(res, secure);

  // Signing out is an explicit "not right now", so leave the silent-SSO probe
  // marked as spent. Clearing it here sent the visitor straight back through
  // prompt=none, which the provider answers from its own live session and
  // lands them on /profile again.
  res.cookies.set(COOKIE.ssoTried, "1", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
  });
  return res;
}
