# Wodflow — local & deployment setup

## Local dev (.env.local, not committed)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PIN_LOGIN_SECRET=
PAYFAST_MERCHANT_ID=
PAYFAST_MERCHANT_KEY=
PAYFAST_PASSPHRASE=
PAYFAST_MODE=
```

## Production (Cloudflare)

Build-time (GitHub Actions repo secrets, injected during `npx @opennextjs/cloudflare build`):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `CLOUDFLARE_API_TOKEN`

Runtime secrets (set once via `wrangler secret put <NAME>`, never as build-time env — these must not appear in the GitHub Actions build step):
- `SUPABASE_SERVICE_ROLE_KEY`
- `PIN_LOGIN_SECRET`
- `PAYFAST_MERCHANT_ID`
- `PAYFAST_MERCHANT_KEY`
- `PAYFAST_PASSPHRASE`
- `PAYFAST_MODE` (`sandbox` or unset/`live`)

Wodflow is PayFast-only — Yoco was removed (migration-043) after never
being used in production. If a second provider is ever needed again,
build and test it entirely against that provider's test-mode webhook
simulator before going live, same as PayFast was.
