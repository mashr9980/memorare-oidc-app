const http = require("http");
const { createHash, randomBytes, createHmac } = require("crypto");

const CLIENT_ID = process.env.MOCK_CLIENT_ID || "local-dev-client-id";
const CLIENT_SECRET = process.env.MOCK_CLIENT_SECRET || "local-dev-client-secret-PLACEHOLDER";
const PORT = 9000;

const codes = new Map();  // code  -> { challenge, user, nonce, used }
const tokens = new Map(); // token -> mutable profile

const b64url = (buf) => buf.toString("base64url");
const sha256 = (s) => b64url(createHash("sha256").update(s, "ascii").digest());

function signHS256(payload, secret) {
  const header = b64url(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(createHmac("sha256", secret).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

function deny(res, status, error, detail) {
  console.log(`[mock-idp] DENY ${status} ${error} ${detail ?? ""}`);
  const headers = { "Content-Type": "application/json" };
  if (status === 401) headers["WWW-Authenticate"] = "Bearer";
  res.writeHead(status, headers);
  res.end(JSON.stringify({ error, error_description: detail ?? "" }));
}

function bearer(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
  return m ? tokens.get(m[1]) : undefined;
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const q = u.searchParams;

  if (req.method === "GET" && u.pathname === "/api/authorize") {
    if (q.get("response_type") !== "code") return deny(res, 400, "invalid_request", "response_type");
    if (q.get("client_id") !== CLIENT_ID) return deny(res, 401, "invalid_client", "client_id");
    if (!q.get("redirect_uri")) return deny(res, 400, "invalid_request", "redirect_uri");
    if (!q.get("state")) return deny(res, 400, "invalid_request", "state");
    if (!q.get("code_challenge")) return deny(res, 400, "invalid_request", "code_challenge");
    if (q.get("code_challenge_method") !== "S256") return deny(res, 400, "invalid_request", "code_challenge_method");
    if (q.get("idp") === "google" && q.get("login_hint"))
      return deny(res, 400, "invalid_request", "idp=google must not carry login_hint");

    const user =
      q.get("idp") === "google"
        ? { sub: "g-100", email: "googleuser@gmail.com", name: null, picture: "https://example.com/avatar.png" }
        : { sub: "e-100", email: q.get("login_hint") || "unknown@example.com", name: null, picture: null };

    const code = b64url(randomBytes(16));
    codes.set(code, {
      challenge: q.get("code_challenge"),
      user,
      nonce: q.get("nonce"),
      used: false,
    });

    const back = new URL(q.get("redirect_uri"));
    back.searchParams.set("code", code);
    back.searchParams.set("state", q.get("state"));
    console.log(`[mock-idp] authorize ok (${q.get("idp") === "google" ? "google" : "email"}) -> code issued`);
    res.writeHead(302, { Location: back.toString() });
    return res.end();
  }

  if (req.method === "POST" && u.pathname === "/api/token") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const p = new URLSearchParams(body);
      if (p.get("grant_type") !== "authorization_code") return deny(res, 400, "unsupported_grant_type");
      if (p.get("client_id") !== CLIENT_ID || p.get("client_secret") !== CLIENT_SECRET)
        return deny(res, 401, "invalid_client");
      const rec = codes.get(p.get("code"));
      if (!rec) return deny(res, 400, "invalid_grant", "unknown code");
      if (rec.used) return deny(res, 400, "invalid_grant", "code already used");
      if (sha256(p.get("code_verifier") || "") !== rec.challenge)
        return deny(res, 400, "invalid_grant", "PKCE verifier mismatch");

      rec.used = true;
      const token = b64url(randomBytes(24));
      const now = Math.floor(Date.now() / 1000);
      const idTokenPayload = {
        iss: "https://auth.memorare.ai",
        aud: p.get("client_id"),
        sub: rec.user.sub,
        exp: now + 3600,
        iat: now,
      };
      if (rec.nonce) idTokenPayload.nonce = rec.nonce;
      const idToken = signHS256(idTokenPayload, CLIENT_SECRET);

      tokens.set(token, { ...rec.user, updated_at: "2026-08-28 00:00:00" });
      console.log("[mock-idp] token exchange ok (PKCE verified)");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ access_token: token, token_type: "Bearer", expires_in: 3600, id_token: idToken, scope: "openid profile email" }));
    });
    return;
  }

  
  if (req.method === "GET" && u.pathname === "/api/.well-known/openid-configuration") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({
      issuer: "https://auth.memorare.ai",
      authorization_endpoint: "https://auth.memorare.ai/api/authorize",
      token_endpoint: "https://auth.memorare.ai/api/token",
      userinfo_endpoint: "https://auth.memorare.ai/api/userinfo",
      profile_endpoint: "https://auth.memorare.ai/api/profile",
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: ["openid", "profile", "email"],
      token_endpoint_auth_methods_supported: ["client_secret_post"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["HS256"],
      claims_supported: ["sub", "email", "name", "picture", "updated_at"],
      login_hint_supported: true,
      idp_parameter_supported: true,
      idp_values_supported: ["google"],
    }));
  }

if (req.method === "GET" && u.pathname === "/api/userinfo") {
    const user = bearer(req);
    if (!user) return deny(res, 401, "invalid_token");
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(user));
  }

  if (req.method === "GET" && u.pathname === "/api/profile") {
    const user = bearer(req);
    if (!user) return deny(res, 401, "invalid_token");
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, profile: user }));
  }

  if (req.method === "PATCH" && u.pathname === "/api/profile") {
    const user = bearer(req);
    if (!user) return deny(res, 401, "invalid_token");
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      let parsed;
      try { parsed = JSON.parse(body); } catch { return deny(res, 400, "invalid_json"); }
      if ("email" in parsed) return deny(res, 400, "invalid_request", "Email cannot be changed.");
      const picture = "picture" in parsed ? parsed.picture : parsed.avatar_url;
      const touches = "name" in parsed || picture !== undefined;
      if (!touches) return deny(res, 400, "invalid_request", "Nothing to update.");
      if ("name" in parsed) {
        if (parsed.name !== null && typeof parsed.name !== "string") return deny(res, 400, "invalid_request", "name must be a string or null");
        user.name = parsed.name === null || parsed.name.trim() === "" ? null : parsed.name.trim();
      }
      if (picture !== undefined) {
        if (picture !== null && !/^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)[:/])/.test(String(picture)))
          return deny(res, 400, "invalid_request", "picture must be an https URL");
        user.picture = picture;
      }
      console.log(`[mock-idp] profile PATCH ok -> name=${JSON.stringify(user.name)} picture=${JSON.stringify(user.picture)}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, profile: user }));
    });
    return;
  }


  if (req.method === "POST" && u.pathname === "/api/profile/avatar") {
    const user = bearer(req);
    if (!user) return deny(res, 401, "invalid_token");
    let buf = Buffer.alloc(0);
    req.on("data", (c) => { buf = Buffer.concat([buf, c]); });
    req.on("end", () => {
      try {
        const bd = new TextDecoder().decode(buf);
        if (!bd.includes("avatar")) return deny(res, 400, "avatar_required");
        user.picture = `https://example.com/avatar-${user.sub}.png`;
        console.log(`[mock-idp] avatar upload ok -> picture="${user.picture}"`);
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, profile: user }));
      } catch {
        return deny(res, 400, "invalid_multipart");
      }
    });
    return;
  }

  if (req.method === "GET" && u.pathname === "/logout") {
    const to = q.get("return_to") || q.get("post_logout_redirect_uri") || q.get("redirect_uri") || "/";
    res.writeHead(302, { Location: to });
    return res.end();
  }

  deny(res, 404, "not_found", u.pathname);
});

server.listen(PORT, "127.0.0.1", () => console.log(`[mock-idp] listening on http://127.0.0.1:${PORT}`));
