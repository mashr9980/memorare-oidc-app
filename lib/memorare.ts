import "server-only";
import { serverConfig } from "./config";

export type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  id_token?: string;
  scope?: string;
};

export type Profile = {
  sub?: string;
  email?: string;
  name?: string | null;
  picture?: string | null;
  updated_at?: string;
};

/** Server-to-server. client_secret and code_verifier never leave this function. */
export async function exchangeCode(code: string, codeVerifier: string): Promise<TokenResponse> {
  const cfg = serverConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: cfg.redirectUri,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code_verifier: codeVerifier,
  });

  const res = await fetch(`${cfg.authBase}/api/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("[memorare] token exchange failed", res.status, await res.text());
    throw new Error("token_exchange_failed");
  }
  return (await res.json()) as TokenResponse;
}

/** The only trustworthy source of identity. Never trust login_hint. */
export async function fetchUserinfo(accessToken: string): Promise<Profile> {
  const cfg = serverConfig();
  const res = await fetch(`${cfg.authBase}/api/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    console.error("[memorare] userinfo failed", res.status, await res.text());
    throw new Error("userinfo_failed");
  }
  return (await res.json()) as Profile;
}

export async function getProfile(accessToken: string): Promise<Profile> {
  const cfg = serverConfig();
  const res = await fetch(`${cfg.authBase}/api/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (res.status === 401) {
    throw new Error("token_expired");
  }
  if (!res.ok) {
    console.error("[memorare] profile GET failed", res.status, await res.text());
    throw new Error("profile_fetch_failed");
  }
  const json = (await res.json()) as { ok?: boolean; profile?: Profile } | Profile;
  return (json as { profile?: Profile }).profile ?? (json as Profile);
}

export type ProfilePatch = { name?: string | null; picture?: string | null };

export async function patchProfile(accessToken: string, patch: ProfilePatch): Promise<Profile> {
  const cfg = serverConfig();
  const res = await fetch(`${cfg.authBase}/api/profile`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
    cache: "no-store",
  });
  if (res.status === 401) {
    throw new Error("token_expired");
  }
  if (!res.ok) {
    console.error("[memorare] profile PATCH failed", res.status, await res.text());
    throw new Error("profile_update_failed");
  }
  const json = (await res.json()) as { ok?: boolean; profile?: Profile } | Profile;
  return (json as { profile?: Profile }).profile ?? (json as Profile);
}
