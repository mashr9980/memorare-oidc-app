import { NextResponse } from "next/server";
import { challengeFor, createState, createVerifier } from "@/lib/pkce";

export const dynamic = "force-dynamic";

/**
 * Proves the real Memorare credentials work from this server, without
 * touching the public login flow. The issued client is scoped to
 * dev15.memorarem.com only, so a full sign-in can't complete here — this
 * checks the one thing that CAN be verified pre-SSH: that the client_id is
 * live and that the provider genuinely enforces its redirect_uri allowlist,
 * by sending one request from an allowed host and one from a different one.
 */
const REAL_CLIENT_ID = "memoraredev15";
const ALLOWED_REDIRECT = "https://dev15.memorarem.com/auth/callback";
const THIS_SERVER_REDIRECT = "https://test.vault-mind.com/auth/callback";

async function probe(redirectUri: string) {
  const verifier = createVerifier();
  const url = new URL("https://auth.memorare.ai/api/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", REAL_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", createState());
  url.searchParams.set("code_challenge", challengeFor(verifier));
  url.searchParams.set("code_challenge_method", "S256");

  const res = await fetch(url.toString(), { redirect: "manual", cache: "no-store" });
  let body: unknown = null;
  try {
    body = await res.clone().json();
  } catch {
    /* a 3xx has no JSON body, that's expected */
  }
  return { redirect_uri: redirectUri, status: res.status, body };
}

export async function GET() {
  const [allowed, other] = await Promise.all([probe(ALLOWED_REDIRECT), probe(THIS_SERVER_REDIRECT)]);

  const credentialsLive = allowed.status >= 300 && allowed.status < 400;
  const scopingEnforced = other.status === 400;

  return NextResponse.json({
    checked_at: new Date().toISOString(),
    client_id: REAL_CLIENT_ID,
    checks: {
      "client_id is live (allowed redirect_uri gets a redirect, not an error)": {
        pass: credentialsLive,
        ...allowed,
      },
      "redirect_uri allowlist is enforced (a different domain is rejected)": {
        pass: scopingEnforced,
        ...other,
      },
    },
    summary:
      credentialsLive && scopingEnforced
        ? "Real Memorare credentials are live and correctly scoped to dev15.memorarem.com. Full sign-in requires deploying there; SSH access is still pending."
        : "Unexpected response from the real provider — see the raw status codes above.",
  });
}
