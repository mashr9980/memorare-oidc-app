import { NextRequest, NextResponse } from "next/server";
import { serverConfig } from "@/lib/config";
import { challengeFor, createState, createVerifier } from "@/lib/pkce";
import { COOKIE, isSecureRequest } from "@/lib/cookies";
import { publicOrigin } from "@/lib/origin";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  let cfg;
  try {
    cfg = serverConfig();
  } catch (err) {
    console.error("[auth/login] configuration error", err);
    return NextResponse.redirect(`${publicOrigin(req)}/?error=server_misconfigured`);
  }

  const email = req.nextUrl.searchParams.get("email")?.trim();
  const useGoogle = req.nextUrl.searchParams.get("idp") === "google";

  if (!useGoogle && !email) {
    return NextResponse.redirect(`${publicOrigin(req)}/?error=email_required`);
  }

  const verifier = createVerifier();
  const state = createState();
  const authorize = new URL(`${cfg.authBase.replace(/\/$/, "")}/api/authorize`);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", cfg.clientId);
  authorize.searchParams.set("redirect_uri", cfg.redirectUri);
  authorize.searchParams.set("scope", "openid profile email");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("code_challenge", challengeFor(verifier));
  authorize.searchParams.set("code_challenge_method", "S256");
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
