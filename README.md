# Memorare Candidate App

Next.js + React app integrating the Memorare Identity Provider over OAuth 2.0 /
OIDC with PKCE, plus an editable user profile.

**Demo:** `https://<HOSTNAME>` _(fill in once deployed)_

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
npm test          # PKCE and session unit tests
```

## Verifying no secrets are exposed

```bash
npm run build
grep -r "$MEMORARE_CLIENT_SECRET" .next/     # must return nothing
```

Then open DevTools, complete a login, and confirm no secret appears in any
response body, in page source, or in the JS bundle.
