import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, fetchUserinfo } from "@/lib/memorare";
import { sealSession } from "@/lib/session";
import { COOKIE, isSecureRequest } from "@/lib/cookies";
import { safeEqual } from "@/lib/pkce";

export const dynamic = "force-dynamic";

function fail(req: NextRequest, reason: string) {
  const res = NextResponse.redirect(new URL(`/?error=${reason}`, req.nextUrl.origin));
  res.cookies.delete(COOKIE.verifier);
  res.cookies.delete(COOKIE.state);
  return res;
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const upstreamError = params.get("error");
  if (upstreamError) {
    console.error("[auth/callback] provider returned error", upstreamError);
    return fail(req, "auth_failed");
  }

  const code = params.get("code");
  const state = params.get("state");
  const cookieState = req.cookies.get(COOKIE.state)?.value;
  const verifier = req.cookies.get(COOKIE.verifier)?.value;

  if (!code || !state || !cookieState || !verifier) return fail(req, "missing_params");

  // CSRF: the returned state must match the one we issued.
  if (!safeEqual(state, cookieState)) {
    console.error("[auth/callback] state mismatch");
    return fail(req, "state_mismatch");
  }

  try {
    const tokens = await exchangeCode(code, verifier);
    // Identity comes from userinfo, never from the login_hint we sent.
    const user = await fetchUserinfo(tokens.access_token);

    const sealed = await sealSession(
      {
        sub: String(user.sub ?? ""),
        email: String(user.email ?? ""),
        name: user.name ?? null,
        picture: user.picture ?? null,
        accessToken: tokens.access_token,
      },
      tokens.expires_in ?? 3600
    );

    const res = NextResponse.redirect(new URL("/profile", req.nextUrl.origin));
    res.cookies.set(COOKIE.session, sealed, {
      httpOnly: true,
      secure: isSecureRequest(req),
      sameSite: "lax",
      path: "/",
      maxAge: tokens.expires_in ?? 3600,
    });
    res.cookies.delete(COOKIE.verifier);
    res.cookies.delete(COOKIE.state);
    return res;
  } catch (err) {
    console.error("[auth/callback] exchange failed", err);
    return fail(req, "exchange_failed");
  }
}
