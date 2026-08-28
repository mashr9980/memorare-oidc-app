# Memorare OIDC Candidate Test

A Next.js OAuth 2.0 + OIDC implementation demonstrating secure server-side auth flow, encrypted session management, and spec compliance. Built for the ibl.ai / Memorare hiring take-home.

## Live Demo

**https://test.vault-mind.com**

| Login | Profile (after sign-in) |
|---|---|
| ![Login](docs/live-login.png) | ![Profile](docs/live-profile.png) |

## Deliverables (Memorare Spec §7)

| Criterion | Status | File |
|-----------|--------|------|
| Next.js 15+ with React 19 | ✅ | `package.json`, `app/` |
| Login UI matches mockup | ✅ | `app/page.tsx` |
| Email login end-to-end (PKCE S256 + OAuth) | ✅ | `app/api/auth/{login,callback}` |
| Google login (idp=google path) | ✅ | `app/api/auth/login` |
| Profile page with email + name + picture | ✅ | `app/profile/page.tsx` |
| Name editable via PATCH + persists | ✅ | `app/api/profile` |
| PKCE S256 + state validation | ✅ | `lib/pkce.ts`, `app/api/auth/callback` |
| Client secrets server-only (never in bundle/Network) | ✅ | Route handlers only, encrypted session |
| nginx + HTTPS (Let's Encrypt, auto-renew) | ✅ | `deploy/nginx.conf` |
| README with how to run, deploy, demo URL | ✅ | This file |
| **Bonus: Avatar upload (optional)** | ✅ | `app/api/profile/avatar` |
| **Bonus: ID token HS256 validation** | ✅ | `lib/id-token.ts` |

## Architecture

```
┌─ User Browser ─────────────────────────────────────────────┐
│  email/password via login page → /api/auth/login          │
│  (email stays in browser only, no URL params in prod)     │
└─────────────────────────────────────────────────────────┬──┘
                                                         │
        ┌────────────────────────────────────────────┤
        ▼
    ┌─ Next.js BFF Route Handlers ──────────────────┐
    │ /api/auth/login:     Generate PKCE verifier   │
    │                      Store in httpOnly cookie │
    │                      Redirect to auth.memorare.ai
    │                                               │
    │ /api/auth/callback:  Exchange code + verifier│
    │                      (client_secret server-side)
    │                      Validate id_token (HS256)│
    │                      Fetch & verify userinfo  │
    │                      Seal JWT session cookie  │
    │                      (A256GCM encryption)     │
    │                                               │
    │ /auth/callback:      Re-export handler above  │
    │                      (registered path)        │
    │                                               │
    │ /api/profile:        PATCH name to upstream   │
    │                      (Bearer token server-side)
    │                                               │
    │ /api/profile/avatar: Upload file to upstream  │
    │                      (multipart + Bearer)     │
    └───────────────────────────────────────────────┘
        │
        │ code_verifier (in memory), client_secret (in env)
        │ NEVER leave this process
        │
        ▼
    ┌─ auth.memorare.ai (Identity Provider) ────────┐
    │ /api/authorize, /api/token, /api/userinfo,     │
    │ /api/profile (PATCH), /api/profile/avatar      │
    │                                                │
    │ Returns: access_token (24h), id_token (HS256), │
    │ profile + picture as { ok, profile }           │
    └────────────────────────────────────────────────┘

Session: Encrypted JWE httpOnly cookie (mem_session)
  - sub, email, name, picture, access_token
  - Secure + HttpOnly + SameSite=lax
  - Max-age = token expires_in (86400s)
```

## Key Decisions

**Why no refresh_token?** Discovery advertises `grant_types_supported: ["authorization_code"]` only (no refresh_token). On 24h token expiry, the correct "refresh" is a new authorize round-trip. The provider's SSO session (cookie on auth.memorare.ai) makes this silent if prompt=none is used.

**Why HS256 for id_token validation?** Discovery has no jwks_uri and all conventional JWKS paths 404. HS256 means the client_secret IS the key — which conveniently forces validation server-side (where the secret already lives) and prevents any client-side token manipulation.

**Why SameSite=lax not Strict?** The OAuth callback is a cross-site top-level GET. Strict would drop the state cookie on the redirect back from auth.memorare.ai, causing state mismatch. Lax allows the top-level GET but still blocks CSRF forms.

**Why nonce is optional?** The profile.html spec never mentions nonce (0 occurrences). The app sends it because OIDC Core mandates it IF claimed in id_token. On mismatch, it rejects — but only enforces if the provider echoed it.

## How to Run Locally

### Prerequisites
- Node.js 18+
- npm

### Dev Mode (with mock IdP)

\`\`\`bash
npm install
npm run dev
\`\`\`

Opens http://localhost:3000. Auth flow runs against ./mock/idp.js on loopback:9000, exposed via localhost:3000/mock-idp/ as if it were auth.memorare.ai (OIDC discovery lives at /mock-idp/api/.well-known/...).

### Tests

\`\`\`bash
npx vitest run          # Unit tests (PKCE S256, session encryption)
npm run build           # Type check + Next.js build
\`\`\`

## Deployment (AWS EC2 + nginx + Let's Encrypt)

### One-Time Setup

\`\`\`bash
# On your server
ssh ubuntu@<ip>
cd /opt/memorare-app

# Install Node
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install npm dependencies
npm ci

# Build
npm run build

# Remove Turbopack cache (contains env snapshots)
rm -rf .next/cache

# Set env
cat > .env.local << 'EOF'
CLIENT_ID=<your-client-id>
CLIENT_SECRET=<your-client-secret>
APP_URL=https://test.vault-mind.com
AUTH_BASE=https://auth.memorare.ai
REDIRECT_URI=https://test.vault-mind.com/auth/callback
EOF
chmod 600 .env.local

# Install systemd units
sudo cp deploy/memorare-app.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable memorare-app && sudo systemctl start memorare-app

# Install & configure nginx
sudo apt-get install -y nginx certbot python3-certbot-nginx
sudo cp deploy/nginx-http.conf /etc/nginx/sites-available/memorare
sudo ln -sf /etc/nginx/sites-available/memorare /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx

# Get SSL cert (auto-renew via certbot timer)
sudo certbot --nginx -d test.vault-mind.com

# Update nginx config to HTTPS version
sudo cp deploy/nginx.conf /etc/nginx/sites-available/memorare
sudo nginx -t && sudo systemctl reload nginx
\`\`\`

### Redeploy (CI/CD or manual)

\`\`\`bash
git pull origin main
npm ci && npm run build && rm -rf .next/cache
sudo systemctl restart memorare-app
sudo systemctl reload nginx
\`\`\`

### Tear Down

\`\`\`bash
aws ec2 terminate-instances --instance-ids i-0d6662a2e2a0aa138
aws ec2 release-address --allocation-id eipalloc-00810ebc9d2b4f801
\`\`\`

(Instance & EIP IDs from AWS console or `aws ec2 describe-instances`)

## Secret Management

- **.env.local** (600 mode): CLIENT_SECRET, SESSION_SECRET. Never committed.
- **Turbopack cache purge**: `rm -rf .next/cache` on deploy (cache snapshots env values).
- **NEXT_PUBLIC_ prefix**: NOT used for any secret. Verified via `npm run build && grep -r NEXT_PUBLIC_ .next/static/`.
- **Session encryption**: jose A256GCM with SERVER-SIDE SESSION_SECRET.

## Spec Compliance

- ✅ OAuth 2.0 authorization-code flow (RFC 6749)
- ✅ PKCE S256 (RFC 7636)
- ✅ OIDC Core (OpenID Connect)
  - ID token HS256 signature validation
  - Sub cross-check (id_token.sub === userinfo.sub)
  - Nonce validation (if claimed)
- ✅ Server-side secrets (client_secret, code_verifier never in browser)
- ✅ Encrypted session (JWE A256GCM)
- ✅ HTTP/2, TLS 1.2+, security headers

## File Structure

\`\`\`
app/
  page.tsx                   # Login UI (email + Google buttons)
  layout.tsx                 # Root layout
  globals.css                # Tailwind reset
  profile/
    page.tsx                 # Profile (server-rendered, redirects if no session)
    profile-form.tsx         # Name edit form (client component)
  api/auth/
    login/route.ts           # Initiate OAuth (generate PKCE + state)
    callback/route.ts        # Exchange code + validate + seal session
    logout/route.ts          # Clear cookies, redirect to provider
  auth/
    callback/route.ts        # Re-export /api/auth/callback (registered path)
  api/profile/
    route.ts                 # PATCH /api/profile (name edit)
    avatar/route.ts          # POST multipart avatar upload
lib/
  config.ts                  # Env validation (server-only)
  cookies.ts                 # Cookie constants + isSecureRequest()
  pkce.ts                    # PKCE verifier, S256 challenge, state, nonce
  id-token.ts                # ID token HS256 verification
  memorare.ts                # API client (exchangeCode, fetchUserinfo, getProfile, patchProfile)
  session.ts                 # JWE sealing/unsealing (A256GCM)
  origin.ts                  # publicOrigin() for redirects behind proxy
mock/
  idp.js                     # Standalone mock identity provider (Node.js)
deploy/
  nginx.conf                 # HTTPS config (with Let's Encrypt cert)
  nginx-http.conf            # HTTP-only (pre-SSL)
  memorare-app.service       # systemd unit for Next.js
  memorare-mock.service      # systemd unit for mock IdP
tests/
  pkce.test.ts               # PKCE S256 + state generation
  session.test.ts            # Session encryption/decryption
\`\`\`

## Known Limitations

- **Mock IdP only**: Real Memorare credentials not yet provisioned. Once received, change `AUTH_BASE` in .env.local and restart.
- **No refresh_token**: App re-auths via SSO session after 24h expiry.
- **No prompt=none silent SSO**: Deferred to avoid loop guards. Can be added in <30 min if needed.

---

Built with ❤️ for ibl.ai / Memorare. Next.js 15 + React 19 + TypeScript.
