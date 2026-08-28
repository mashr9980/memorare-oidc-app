import { jwtVerify } from "jose";
import { serverConfig } from "./config";

export type IDToken = {
  iss: string;
  aud: string;
  sub: string;
  exp: number;
  iat: number;
  nonce?: string;
};

export async function verifyIDToken(idToken: string): Promise<IDToken> {
  const cfg = serverConfig();
  const secret = new TextEncoder().encode(cfg.clientSecret);

  const { payload } = await jwtVerify(idToken, secret, {
    algorithms: ["HS256"],
    issuer: "https://auth.memorare.ai",
    audience: cfg.clientId,
  });

  if (payload.token_type && payload.token_type !== "Bearer") {
    throw new Error("invalid_token_type");
  }

  return payload as unknown as IDToken;
}
