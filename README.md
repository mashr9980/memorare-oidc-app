# Memorare Candidate App

Next.js + React app integrating the Memorare Identity Provider over OAuth 2.0 /
OIDC with PKCE, plus an editable user profile.

**Demo:** https://test.vault-mind.com

## Screenshots

| Login | Profile (after sign-in) |
|---|---|
| ![Login](docs/live-login.png) | ![Profile](docs/live-profile.png) |

## How it works

The entire OAuth exchange happens server-side in Route Handlers. The browser
receives one encrypted, httpOnly session cookie and nothing else. `client_secret`,
`code_verifier`, and `access_token` never reach the client.

| Route | Purpose |
|---|---|
| `/` | Login screen (email + Google) |
| `/api/auth/login` | Generates PKCE verifier/challenge and state, redirects to `/api/authorize` |
| `/api/auth/callback` | Validates `state`, exchanges the code for tokens, reads `/api/userinfo`, seals the session |
| `/profile` | Server component; shows email (read-only), name (editable), picture |
| `/api/profile` | `PATCH` proxy that forwards `{name}` upstream with the Bearer token |
| `/api/auth/logout` | Clears the session, redirects to the provider logout |

### Security notes

- **PKCE S256.** `code_verifier` is 32 random bytes base64url-encoded; the
  challenge is `BASE64URL(SHA256(verifier))`. The verifier is held in an httpOnly
  cookie for the duration of the flow only.
- **State validation.** The `state` returned by the provider is compared against
  the issued value before any token exchange happens.
- **Session.** Encrypted JWE (`dir` / `A256GCM`, key derived from
  `SESSION_SECRET`) in an httpOnly, SameSite=Lax cookie, Secure in production.
  Because it is encrypted rather than merely signed, the access token inside is
  opaque even to the cookie holder.
- **Identity source.** The signed-in user is read from `/api/userinfo` after the
  exchange, never inferred from the `login_hint` we sent.
- **No `NEXT_PUBLIC_` variables exist in this project.** Secret-handling modules
  import `server-only`, so any accidental client import fails the build.
- **Response narrowing.** `PATCH /api/profile` returns only `{name}` rather than
  echoing the upstream body, so no upstream field can leak to the browser.

## Run locally

```bash
npm install
cp .env.example .env.local     # fill in the values below
npm run dev                    # http://localhost:3000
```

Local development needs a redirect URI registered for `http://localhost:3000/api/auth/callback`.
If only the deployed HTTPS callback is registered, test on the server instead.

## Environment

| Variable | Description |
|---|---|
| `AUTH_BASE` | `https://auth.memorare.ai` |
| `MEMORARE_CLIENT_ID` | OAuth client id |
| `MEMORARE_CLIENT_SECRET` | OAuth client secret (server-side only) |
| `MEMORARE_REDIRECT_URI` | Must exactly match the registered value |
| `APP_URL` | Public origin, used for post-logout `return_to` |
| `SESSION_SECRET` | 32+ chars. `openssl rand -base64 32` |

## Deploy

```bash
npm ci && npm run build
rm -rf .next/cache     # Turbopack's build cache snapshots env values; it is never served, but don't leave it on disk
sudo cp deploy/memorare-app.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now memorare-app
```

Next.js listens on `127.0.0.1:3000`; nginx terminates SSL on 443.

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/memorare-app
sudo sed -i "s/HOSTNAME/<your-host>/g" /etc/nginx/sites-available/memorare-app
sudo ln -s /etc/nginx/sites-available/memorare-app /etc/nginx/sites-enabled/
sudo certbot --nginx -d <your-host>
sudo nginx -t && sudo systemctl reload nginx
```

`deploy/apache.conf` is the Apache equivalent. Both set `X-Forwarded-Proto https`,
which is required: without it Next.js builds `http://` absolute URLs and the
`redirect_uri` no longer matches the registered value.

## Tests

```bash
npm test          # PKCE and session unit tests (includes the RFC 7636 test vector)
```

## Local end-to-end testing without credentials

`mock/idp.js` is a strict local mock of the Memorare IdP implementing
`/api/authorize`, `/api/token`, `/api/userinfo`, `/api/profile`, and `/logout`
per the published docs. It enforces PKCE (S256 verifier check), one-time codes,
client authentication, and the `idp=google` / `login_hint` exclusivity rule, so
integration mistakes fail here instead of on the real server.

```bash
node mock/idp.js                      # listens on 127.0.0.1:9000
# in .env.local: AUTH_BASE=http://127.0.0.1:9000
npm run build && npm start
```

Both login paths, name persistence, code replay, and wrong-verifier rejection
were verified end-to-end against this mock.

**The public demo runs this way.** The mock is bound to loopback; nginx exposes
only its browser-facing endpoints under `/mock-idp/` (see `deploy/nginx.conf`),
and `AUTH_BASE=https://<host>/mock-idp`. The app's own server-to-server calls
(token exchange, userinfo, profile) go through the same HTTPS origin. Switching
to the real provider is a config change: set `AUTH_BASE=https://auth.memorare.ai`
and the issued `client_id` / `client_secret`, then delete the `/mock-idp/` block.

## Verifying no secrets are exposed

```bash
npm run build
grep -r "$MEMORARE_CLIENT_SECRET" .next/     # must return nothing
```

Then open DevTools, complete a login, and confirm no secret appears in any
response body, in page source, or in the JS bundle.
