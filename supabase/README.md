# Onramp — Backend (Supabase)

Server-authoritative payment infrastructure. Nothing in `src/` is ever
allowed to write payment state directly — everything flows through here.

## Layout

```
supabase/
├── migrations/
│   ├── 0002_checkout_sessions.sql      # state machine + RLS lockdown
│   └── 0003_webhook_deliveries.sql     # outbound webhook queue
└── functions/
    ├── _shared/
    │   ├── db.ts                       # service-role client (NEVER import in src/)
    │   ├── cors.ts                     # cors helpers
    │   ├── reference.ts                # session reference + polygon suffix
    │   ├── verify-solana.ts            # pure on-chain verifier (Solana)
    │   └── verify-polygon.ts           # pure on-chain verifier (Polygon)
    ├── create-checkout-session/        # POST: server creates a paid-order intent
    └── verify-payment/                 # POST: drives the state machine
```

## Required Edge Function secrets

Set in Supabase dashboard (Project Settings → Edge Functions → Secrets) — the
`SUPABASE_*` ones are auto-injected:

```
HELIUS_API_KEY      = ...     # or SOLANA_RPC_URL
ALCHEMY_API_KEY     = ...     # or POLYGON_RPC_URL
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided by the platform.

## Apply migrations

Via Supabase CLI:

```bash
supabase db push
```

Or paste each `.sql` into the SQL editor in order.

## Deploy functions

```bash
supabase functions deploy create-checkout-session
supabase functions deploy verify-payment
```

## State machine (canonical)

```
awaiting_payment ──► confirming ──► confirmed
       │                  │
       └──► failed/expired ◄──┘
```

Once a session is `confirmed`/`failed`/`expired`, it is terminal and the DB
trigger `checkout_sessions_enforce_transition` will reject further updates.

## Trust boundary

| Operation | Allowed actor |
|---|---|
| `INSERT` into `checkout_sessions` | service role only (`create-checkout-session`) |
| `UPDATE checkout_sessions.status` | service role only (`verify-payment`, cron) |
| `INSERT` into `transactions` | service role only |
| `INSERT` into `webhook_deliveries` | service role only |
| `SELECT` a `checkout_sessions` row | anyone with the uuid (capability token) |

The `anon`/`authenticated` roles have **no** write privileges on payment
tables. Migrations explicitly `REVOKE INSERT, UPDATE, DELETE`.

## Migration apply order

```
0002_checkout_sessions.sql       state machine + RLS lockdown
0003_webhook_deliveries.sql      outbound webhook queue
0004_webhook_cron.sql            pg_cron schedule
0005_ratelimit.sql               rl_consume RPC
0006_drop_profile_secrets.sql    drops profiles.secret_key, profiles.webhook_secret
0007_signup_trigger.sql          server-side profile + secrets on auth.users insert
```

`0007` MUST be applied *before* the new dashboard build is rolled out and
*after* `0006`. Order matters: the trigger reads the new schema (no
`secret_key` / `webhook_secret` on `profiles`).

## Edge Function secrets

Set in Supabase dashboard (Project Settings → Edge Functions → Secrets):

```
HELIUS_API_KEY      = ...     # or SOLANA_RPC_URL
ALCHEMY_API_KEY     = ...     # or POLYGON_RPC_URL
DASHBOARD_ORIGINS   = https://your-dashboard.example.com,https://staging.example.com
```

`DASHBOARD_ORIGINS` is required in production for `update-merchant-config`,
`get-merchant-secrets`, `rotate-webhook-secret`. If unset, those endpoints
fall back to a localhost dev allowlist only — disallowed origins are
rejected at preflight.

## Auth configuration (NOT a migration — Dashboard only)

These settings live in Project Settings → Authentication (or via the
Management API `PATCH /v1/projects/{ref}/config/auth`). They're listed
here because they are load-bearing for the signup flow and must be
re-applied on any fresh project clone.

```
mailer_autoconfirm         = true     # no email confirmation required
password_min_length        = 10
password_required_characters = lower + upper + digit
rate_limit_email_sent      = 2/hr     # (default; only matters if autoconfirm is off)
```

`mailer_autoconfirm = true` is set because the free Supabase SMTP sender
is capped at ~2 confirmation emails per hour per project — signups were
returning `over_email_send_rate_limit` in production. Flipping this bit
means users log in immediately on signup (no verification email).

When/before going live with real customers:

1. Configure a custom SMTP provider (Resend, Postmark, SendGrid).
2. Set `mailer_autoconfirm = false` so users have to prove control of the
   inbox before the account becomes useful.
3. Upgrade to a Supabase plan that includes HaveIBeenPwned leaked-password
   protection and set `password_hibp_enabled = true`.

## Notes on PII / data exposure

`webhook_deliveries.payload` is JSONB and contains `payer_address`. It is
restricted to the merchant via RLS (`merchant_id = auth.uid()`) — the same
party who already receives the data via the live webhook delivery. Payer
address is on-chain public data, so this is acceptable. If a future feature
adds personally identifiable information to webhook payloads (email, billing
address, etc.), tighten this column with column-level RLS or a separate
table that omits the field from the merchant-facing read path.
