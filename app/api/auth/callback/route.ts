import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, fetchUserinfo } from "@/lib/memorare";
import { sealSession } from "@/lib/session";
import { COOKIE, isSecureRequest, sessionCookieName } from "@/lib/cookies";
import { safeEqual } from "@/lib/pkce";
import { publicOrigin } from "@/lib/origin";
import { verifyIDToken } from "@/lib/id-token";

export const dynamic = "force-dynamic";

function fail(req: NextRequest, reason: string) {
  const res = NextResponse.redirect(`${publicOrigin(req)}/?error=${reason}`);
  res.cookies.delete(COOKIE.verifier);
  res.cookies.delete(COOKIE.state);
  return res;
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const upstreamError = params.get("error");
  if (upstreamError) {
    if (upstreamError === "login_required") {
      console.error("[auth/callback] login required - show login UI");
      return fail(req, "login_required");
    }
    console.error("[auth/callback] provider returned error", upstreamError);
    return fail(req, "auth_failed");
  }

  const code = params.get("code");
  const state = params.get("state");
  const cookieState = req.cookies.get(COOKIE.state)?.value;
  const verifier = req.cookies.get(COOKIE.verifier)?.value;

  if (!code || !state || !cookieState || !verifier) return fail(req, "missing_params");
  if (!safeEqual(state, cookieState)) {
    console.error("[auth/callback] state mismatch");
    return fail(req, "state_mismatch");
  }

  try {
    const tokens = await exchangeCode(code, verifier);

    let claims = null;
    if (tokens.id_token) {
      claims = await verifyIDToken(tokens.id_token);
      const cookieNonce = req.cookies.get(COOKIE.nonce)?.value;
      if (cookieNonce && claims.nonce && claims.nonce !== cookieNonce) {
        console.error("[auth/callback] nonce mismatch");
        return fail(req, "nonce_mismatch");
      }
    }

    const user = await fetchUserinfo(tokens.access_token);

    if (claims && String(user.sub ?? "") !== claims.sub) {
      console.error("[auth/callback] userinfo sub does not match id_token sub");
      return fail(req, "subject_mismatch");
    }

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

    const secure = isSecureRequest(req);
    const res = NextResponse.redirect(`${publicOrigin(req)}/profile`);
    res.cookies.set(sessionCookieName(secure), sealed, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: tokens.expires_in ?? 3600,
    });
    res.cookies.delete(COOKIE.verifier);
    res.cookies.delete(COOKIE.state);
    res.cookies.delete(COOKIE.nonce);
    return res;
  } catch (err) {
    console.error("[auth/callback] exchange failed", err);
    return fail(req, "exchange_failed");
  }
}
