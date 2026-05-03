<p align="center">
  <img src="https://img.shields.io/badge/status-live-10B981?style=for-the-badge&labelColor=000000" alt="Status" />
  <img src="https://img.shields.io/badge/license-MIT-10B981?style=for-the-badge&labelColor=000000" alt="License" />
  <img src="https://img.shields.io/badge/react-19-61DAFB?style=for-the-badge&logo=react&labelColor=000000" alt="React" />
  <img src="https://img.shields.io/badge/typescript-6-3178C6?style=for-the-badge&logo=typescript&labelColor=000000" alt="TypeScript" />
  <img src="https://img.shields.io/badge/vite-8-646CFF?style=for-the-badge&logo=vite&labelColor=000000" alt="Vite" />
  <img src="https://img.shields.io/badge/supabase-edge%20functions-3ECF8E?style=for-the-badge&logo=supabase&labelColor=000000" alt="Supabase" />
</p>

<h1 align="center">
  <br />
  ⚡ onramp
  <br />
</h1>

<h3 align="center">
  Non-custodial stablecoin payment gateway — server-authoritative, HMAC-signed, production-deployed.
</h3>

<p align="center">
  Accept USDC on Solana and USDT on Polygon, settling directly into the merchant wallet.<br />
  Zero platform fees · Zero custody · On-chain verified.
</p>

<p align="center">
  <a href="https://onramp-delta.vercel.app"><strong>Live demo →</strong></a>
</p>

---

## 🧭 Overview

**Onramp** lets merchants generate checkout links, share them with customers, and receive stablecoin payments that settle directly into their own wallets. The system never holds funds — every payment is an on-chain `transfer` from payer to merchant, verified server-side before anything is marked "paid".

The platform is composed of three layers:

1. **Browser SPA** (Vite + React 19) — marketing site, merchant dashboard, customer checkout.
2. **Supabase backend** — Postgres with a state-machine schema, 10 migrations, Row-Level-Security lockdown, six Edge Functions (Deno), and `pg_cron` for scheduled jobs.
3. **Chain layer** — Solana (SPL transfer + Memo-program binding) and Polygon (ERC-20 transfer with a sub-cent reference suffix).

Nothing the browser says about price, destination, amount, or status is trusted. Every transition is either produced by the server or verified by the server.

---

## ✨ What's shipped

### Merchant experience

- **Signup + login** with auto-created profile & rotated API/webhook secrets (server-side trigger).
- **Product management** — create, list, delete, and copy shareable `/checkout/:productId` links.
- **Dashboard** — revenue, transaction count, product count, **active in-flight checkout sessions**.
- **Transactions ledger** — full filterable history, explorer links (Solscan / Polygonscan), confirmed/failed state badges.
- **Webhook configuration** — set destination URL (HTTPS-only; loopback / RFC-1918 / metadata IPs blocked server-side), reveal API secret on demand, rotate webhook secret with one click, live delivery history.
- **Settings** — business name, Solana wallet (base58 validated), Polygon wallet (EIP-55 checksum validated).

### Customer checkout

- Phantom-based **Solana USDC** flow with Memo-program binding (`onramp:<reference>`), destination-ATA auto-creation when the merchant hasn't received USDC before.
- MetaMask-based **Polygon USDT** flow with chain-id check (rejects non-137) and **sub-cent reference suffix** so parallel sessions for the same product can never collide.
- Polls the server verifier every 3 s; the browser never invents a "confirmed" state.

### Backend

- **Six Edge Functions** (`create-checkout-session`, `verify-payment`, `webhook-dispatcher`, `update-merchant-config`, `get-merchant-secrets`, `rotate-webhook-secret`).
- **State-machine DB** — `checkout_sessions.status ∈ {awaiting_payment, confirming, confirmed, failed, expired}` with a trigger that enforces legal transitions.
- **`pg_cron`** fires the webhook dispatcher every 10 s for delivery + catch-up verification of stuck sessions.
- **Token-bucket rate limiting** (atomic `rl_consume` RPC) applied per-IP, per-product, and per-session on customer endpoints.
- **HMAC-SHA256 webhook signatures** (`Onramp-Signature: t=<unix>,v1=<hex>`) with replay-window enforcement on the receiver side.
- **Row-Level Security** — `anon` and `authenticated` have *zero* INSERT/UPDATE/DELETE on payment tables; SELECT scoped to `merchant_id = auth.uid()` where appropriate.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                               Browser (SPA)                               │
│     Landing · Login · Register · Dashboard · Products · Transactions      │
│     · Webhooks · Settings · Checkout(/:id) · Success(?session=)           │
└─────────────┬────────────────────────────────────────────────────────────┘
              │ fetch(Edge Function)                                       ▲
              │                                                             │ merchant webhook
┌─────────────▼─────────────────────────────────────────────────┐   HMAC   │
│                Supabase Edge Functions (Deno)                  │          │
│                                                                │          │
│  Public / anon-callable:                                       │          │
│    • create-checkout-session  (server-frozen amount, token,    │          │
│                                destination, reference)         │          │
│    • verify-payment           (drives the state machine;       │          │
│                                idempotent ledger insert)       │          │
│                                                                │          │
│  Dashboard / user-JWT + CORS allowlist:                        │          │
│    • update-merchant-config   (EIP-55, base58, URL validation) │          │
│    • get-merchant-secrets     (reveal sk_live_… / whsec_… )    │          │
│    • rotate-webhook-secret                                     │          │
│                                                                │          │
│  Scheduler-invoked (service role):                             │          │
│    • webhook-dispatcher  ──── HMAC-SHA256 signed POST ─────────┘          │
│                          exponential backoff + jitter                      │
└─────────────┬──────────────────────────┬─────────────────────────────────┘
              │ service role              │ pg_cron every 10s
              ▼                           │
┌──────────────────────────────────────────────────────────────────────────┐
│                          Postgres (Supabase)                              │
│                                                                           │
│  checkout_sessions  → state machine + trigger-enforced transitions        │
│  transactions       → append-only ledger (UNIQUE network, tx_hash)        │
│  webhook_deliveries → retry queue with backoff state                      │
│  merchant_secrets   → sk_live_ / whsec_ (RLS-locked, never reaches browser)│
│  profiles, products → merchant data                                       │
│  rate_limit_buckets → token-bucket state for rl_consume                   │
│                                                                           │
│  Extensions: pgcrypto · pg_cron · pg_net                                  │
└─────────────┬────────────────────────────────────────────────────────────┘
              │ fetch() from verify-payment
              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         Chain verifiers                                   │
│    Solana RPC (Memo binding check)  ·  Polygon RPC (exact amount check)   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 🔐 Security model

| Property | How it's enforced |
|---|---|
| **Browser cannot choose what it pays** | `create-checkout-session` loads price from `products.price_minor`, destination from `profiles.*_wallet`, freezes them into `checkout_sessions`. The browser receives the frozen row; anything it tampers with is compared server-side on verify. |
| **On-chain binding of the session to the tx** | Solana: the transaction must include a Memo-program instruction containing `onramp:<reference>`. Polygon: the transferred `amount_minor` must exactly match the server-allocated value including a unique sub-cent suffix. A random replay of an unrelated transfer fails both checks. |
| **Idempotent ledger** | `transactions` has a `UNIQUE (network, tx_hash)` constraint. `verify-payment` upserts; duplicate confirmations are no-ops. |
| **State-machine enforced by trigger** | `checkout_sessions_enforce_transition` rejects any status update that isn't a legal transition of `awaiting_payment → confirming → confirmed\|failed\|expired`. |
| **Merchant secrets never in the browser** | `merchant_secrets.secret_key` and `webhook_secret` have `REVOKE SELECT` from `anon` + `authenticated`; the dashboard reveals them via the auth-gated `get-merchant-secrets` Edge Function only. |
| **Webhook payload authenticity** | HMAC-SHA256 over `<ts>.<raw_body>` with the merchant's `whsec_…`. Signature header is `Onramp-Signature: t=<unix>,v1=<hex>`. Receiver example (Node + WebCrypto) ships in the Webhooks page. |
| **Webhook URL validation** | Server-side: HTTPS only; blocks loopback (`127.0.0.0/8`, `::1`), RFC-1918 ranges, link-local, and cloud-metadata IPs. |
| **CORS allowlist on dashboard endpoints** | `update-merchant-config`, `get-merchant-secrets`, `rotate-webhook-secret` reject any `Origin` not in `DASHBOARD_ORIGINS`. Customer endpoints stay `*` for embeddability. |
| **Rate limits** | Per-IP (30/min), per-product (60/min) on session creation; per-IP (120/min) and per-session (12/min) on verification. Atomic token bucket via `rl_consume` RPC. |
| **Signup trigger** | `SECURITY DEFINER` with locked `search_path = public, pg_temp`; generates `pk_live_…`, `sk_live_…`, `whsec_…` with `extensions.gen_random_bytes`. Browser only supplies `business_name` via signup metadata. |
| **Password policy** | `password_min_length = 10`, must include upper + lower + digit, enforced by Supabase Auth server-side and mirrored client-side. |

Full Supabase security-advisor output is reviewed in [`supabase/README.md`](./supabase/README.md).

---

## 🛠️ Tech stack

| Layer | Technology | Notes |
|---|---|---|
| **Frontend** | React 19, TypeScript 6, Vite 8 | `tsc -b --noEmit` clean |
| **Styling** | Tailwind CSS 4, Inter + Instrument Serif | Dark-first; `.glow-card`, `.liquid-glass` utilities |
| **Icons** | Lucide React | |
| **Routing** | React Router 7 | Nested routes under `DashboardLayout` |
| **Auth & DB** | Supabase (Postgres 17) | 10 SQL migrations tracked in `supabase/migrations/` |
| **Edge Functions** | Deno, hosted on Supabase | 6 functions in `supabase/functions/` |
| **Cron** | `pg_cron` + `pg_net` | 10-second schedule for webhook dispatcher |
| **Crypto** | `pgcrypto` | All secrets generated server-side via `gen_random_bytes` |
| **Solana** | `@solana/web3.js` 1.98 + `@solana/spl-token` 0.4 | SPL transfer + Memo-program binding |
| **Polygon** | `ethers` v6 | ERC-20 `transfer` through `BrowserProvider` (MetaMask RPC) |
| **Hosting** | Vercel (frontend), Supabase (backend) | Frontend auto-redeploys on push to `main` |

---

## 📂 Project structure

```
onramp/
├── public/                              # Static assets
├── src/
│   ├── assets/                          # Images
│   ├── hooks/
│   │   └── useMobile.ts                 # Breakpoint hook
│   ├── layouts/
│   │   └── DashboardLayout.tsx          # Sidebar + outlet shell
│   ├── lib/
│   │   ├── supabase.ts                  # Supabase client (fail-loud on missing env)
│   │   ├── auth.tsx                     # AuthProvider + useAuth
│   │   └── api.ts                       # Typed client for Edge Functions
│   ├── pages/
│   │   ├── Landing.tsx                  # Marketing homepage
│   │   ├── Login.tsx · Register.tsx     # Merchant auth
│   │   ├── Dashboard.tsx                # Stats overview
│   │   ├── Products.tsx                 # Product CRUD + copy link
│   │   ├── Transactions.tsx             # Ledger viewer
│   │   ├── Webhooks.tsx                 # URL config, secret rotate, delivery history
│   │   ├── Settings.tsx                 # Profile + wallet addresses
│   │   ├── Checkout.tsx                 # Customer payment flow
│   │   └── Success.tsx                  # Post-payment confirmation
│   ├── App.tsx · main.tsx · index.css
│   └── …
├── supabase/
│   ├── README.md                        # Backend deploy + apply-order
│   ├── functions/
│   │   ├── _shared/                     # auth, cors, db, hmac, validators, ratelimit,
│   │   │                                # verify-solana, verify-polygon, reference
│   │   ├── create-checkout-session/
│   │   ├── verify-payment/
│   │   ├── webhook-dispatcher/
│   │   ├── update-merchant-config/
│   │   ├── get-merchant-secrets/
│   │   └── rotate-webhook-secret/
│   └── migrations/
│       ├── 0002_checkout_sessions.sql   # state machine + RLS lockdown
│       ├── 0003_webhook_deliveries.sql
│       ├── 0004_webhook_cron.sql        # pg_cron schedule
│       ├── 0005_ratelimit.sql           # rl_consume RPC
│       ├── 0006_drop_profile_secrets.sql
│       ├── 0007_signup_trigger.sql      # SECURITY DEFINER on auth.users
│       ├── 0008_inline_cron_config.sql
│       ├── 0009_fix_signup_trigger_search_path.sql
│       └── 0010_security_hardening.sql  # REVOKE EXECUTE on RPCs, lock search_path
├── .env.example
├── tailwind.config.js
├── vite.config.ts
├── tsconfig*.json
└── package.json
```

---

## 🚀 Getting started (frontend only)

Prereqs: Node ≥ 18, npm ≥ 9. You can run the SPA locally pointed at the live Supabase project without deploying anything.

```bash
git clone https://github.com/zanni098/onramp.git
cd onramp
npm install
```

Create `.env`:

```env
# Required
VITE_SUPABASE_URL=https://hkheayotxkyfgxjaoizj.supabase.co
VITE_SUPABASE_ANON_KEY=<anon jwt from Supabase project>

# Optional — used only by the Solana checkout path for blockhash lookup.
# Falls back to https://api.mainnet-beta.solana.com (rate-limited).
VITE_HELIUS_API_KEY=
```

```bash
npm run dev      # http://localhost:5173
npm run build    # type-check + production bundle
npm run preview  # serve the production build
npm run lint
```

## 🧱 Deploying the backend yourself

If you're forking this and want your own Supabase project, see **[`supabase/README.md`](./supabase/README.md)** for:

- Migration apply order (0002 → 0010).
- Edge Function secrets: `HELIUS_API_KEY`, `ALCHEMY_API_KEY`, `DASHBOARD_ORIGINS`.
- The auth-config settings that are NOT captured in migrations: `mailer_autoconfirm = true` for dev (flip to `false` + configure a real SMTP before taking real customers), `password_min_length = 10`, `password_required_characters = lower+upper+digit`.

Frontend deploys via Vercel's GitHub integration — every push to `main` builds and promotes. The Supabase anon key is injected at build time via Vercel project env vars.

---

## 🗺️ Route map

| Path | Component | Access | Description |
|---|---|---|---|
| `/` | `Landing` | Public | Marketing homepage |
| `/login` | `Login` | Public | Merchant sign-in |
| `/register` | `Register` | Public | Merchant registration |
| `/checkout/:productId` | `Checkout` | Public (capability URL) | Customer payment page |
| `/success` | `Success` | Public | Re-reads session status from DB; cannot be faked |
| `/dashboard` | `Dashboard` | Auth | Revenue, txn count, product count, active checkouts |
| `/products` | `Products` | Auth | Create / delete products, copy checkout link |
| `/transactions` | `Transactions` | Auth | Filterable ledger (confirmed / failed) |
| `/webhooks` | `Webhooks` | Auth | URL config, secret rotate, delivery history, verification examples |
| `/settings` | `Settings` | Auth | Business name + wallet addresses (server-validated) |

---

## 🔮 Roadmap

Genuinely open items (the misleading "TODO" roadmap of the previous README covered things that are already shipped — those have been removed):

- [ ] **Custom SMTP provider** (Resend / Postmark / SendGrid) — currently `mailer_autoconfirm = true` so the free Supabase shared sender's 2/hr cap doesn't block signups.
- [ ] **Helius + Alchemy keys in production Edge Function secrets** — currently using free public RPCs, which will rate-limit under real load.
- [ ] **Sentry (or equivalent) error + cron monitoring** — right now a stopped cron goes undetected until webhook delivery visibly backs up.
- [ ] **Hosted iframe / embed script** so merchants can drop a checkout widget into their site without the `/checkout/:id` redirect.
- [ ] **Mobile wallet deep-links** (Phantom / MetaMask app) on the checkout page.
- [ ] **Scrypt/argon2 hashing of `merchant_secrets.secret_key`** — currently plaintext-equivalent and only ever read through the auth-gated Edge Function, but should move to hashed compare once a public merchant API exists.
- [ ] **HIBP leaked-password protection** — requires Supabase Pro plan.
- [ ] **More stablecoins** (USDT on Solana, USDC on Polygon, DAI).
- [ ] **Analytics charts** (revenue trends, conversion funnel).

---

## 🤝 Contributing

Fork, branch, open a PR. [Conventional Commits](https://www.conventionalcommits.org/) preferred for messages so changelogs are generable.

```bash
git checkout -b feat/your-feature
git commit -m "feat: ..."
git push origin feat/your-feature
```

---

## 📄 License

MIT — see [LICENSE](LICENSE).

---

<p align="center">
  Built with ⚡ by <a href="https://github.com/zanni098">zanni098</a> · deployed at <a href="https://onramp-delta.vercel.app">onramp-delta.vercel.app</a>
</p>
