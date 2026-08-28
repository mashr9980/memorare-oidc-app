import "server-only";
import { NextResponse } from "next/server";
import { serverConfig } from "./config";
import { challengeFor, createState, createVerifier, generateNonce } from "./pkce";
import { COOKIE } from "./cookies";

type Intent = { email: string } | { google: true } | { silent: true };

/**
 * One place that builds an authorize redirect and parks the PKCE material in
 * httpOnly cookies, so the interactive and silent entry points cannot drift.
 */
export function startAuthorize(intent: Intent, secure: boolean): NextResponse {
  const cfg = serverConfig();
  const verifier = createVerifier();
  const state = createState();
  const nonce = generateNonce();

  const url = new URL(`${cfg.authBase.replace(/\/$/, "")}/api/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", cfg.redirectUri);
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", challengeFor(verifier));
  url.searchParams.set("code_challenge_method", "S256");

  // The provider treats these as mutually exclusive, and the silent check must
  // carry neither of them.
  if ("email" in intent) url.searchParams.set("login_hint", intent.email);
  else if ("google" in intent) url.searchParams.set("idp", "google");
  else url.searchParams.set("prompt", "none");

  const res = NextResponse.redirect(url.toString(), { status: 303 });
  const opts = { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge: 600 };
  res.cookies.set(COOKIE.verifier, verifier, opts);
  res.cookies.set(COOKIE.state, state, opts);
  res.cookies.set(COOKIE.nonce, nonce, opts);
  return res;
}
