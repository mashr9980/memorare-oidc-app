import { NextRequest, NextResponse } from "next/server";
import { COOKIE, isSecureRequest } from "@/lib/cookies";
import { publicOrigin } from "@/lib/origin";
import { startAuthorize } from "@/lib/authorize";

export const dynamic = "force-dynamic";

/**
 * Silent single sign-on. If the visitor already has a session with the provider
 * from another Memorare app, prompt=none signs them in without a click; if not,
 * the provider answers login_required and the callback sends them back here to
 * the normal form. The mem_sso cookie makes sure that round trip happens once.
 */
export async function GET(req: NextRequest) {
  const secure = isSecureRequest(req);
  let res: NextResponse;
  try {
    res = startAuthorize({ silent: true }, secure);
  } catch (err) {
    console.error("[auth/sso] configuration error", err);
    return NextResponse.redirect(`${publicOrigin(req)}/?error=server_misconfigured`, { status: 303 });
  }
  res.cookies.set(COOKIE.ssoTried, "1", { httpOnly: true, secure, sameSite: "lax", path: "/" });
  return res;
}
