import { NextRequest, NextResponse } from "next/server";
import { serverConfig } from "@/lib/config";
import { challengeFor, createState, createVerifier } from "@/lib/pkce";
import { COOKIE, isSecureRequest } from "@/lib/cookies";

export const dynamic = "force-dynamic";

/**
 * Starts the OIDC authorization-code + PKCE flow.
 *   ?email=<address> -> email/OTP path via login_hint
 *   ?idp=google      -> Google path (login_hint must be omitted)
 * The code_verifier is stored in an httpOnly cookie and never reaches the page.
 */
export async function GET(req: NextRequest) {
  let cfg;
  try {
    cfg = serverConfig();
  } catch (err) {
    console.error("[auth/login] configuration error", err);
    return NextResponse.redirect(new URL("/?error=server_misconfigured", req.nextUrl.origin));
  }

  const email = req.nextUrl.searchParams.get("email")?.trim();
  const useGoogle = req.nextUrl.searchParams.get("idp") === "google";

  if (!useGoogle && !email) {
    return NextResponse.redirect(new URL("/?error=email_required", req.nextUrl.origin));
  }

  const verifier = createVerifier();
  const state = createState();

  const authorize = new URL("/api/authorize", cfg.authBase);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", cfg.clientId);
  authorize.searchParams.set("redirect_uri", cfg.redirectUri);
  authorize.searchParams.set("scope", "openid profile email");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("code_challenge", challengeFor(verifier));
  authorize.searchParams.set("code_challenge_method", "S256");

  // idp=google and login_hint are mutually exclusive.
  if (useGoogle) authorize.searchParams.set("idp", "google");
  else authorize.searchParams.set("login_hint", email!);

  const res = NextResponse.redirect(authorize.toString());
  const opts = {
    httpOnly: true,
    secure: isSecureRequest(req),
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
  };
  res.cookies.set(COOKIE.verifier, verifier, opts);
  res.cookies.set(COOKIE.state, state, opts);
  return res;
}
