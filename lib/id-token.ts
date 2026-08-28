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

  return payload as unknown as IDToken;
}
