# Wodflow — local & deployment setup

## Local dev (.env.local, not committed)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PIN_LOGIN_SECRET=
YOCO_SECRET_KEY=
YOCO_WEBHOOK_SECRET=
```

## Production (Cloudflare)

Build-time (GitHub Actions repo secrets, injected during `npx @opennextjs/cloudflare build`):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `CLOUDFLARE_API_TOKEN`

Runtime secrets (set once via `wrangler secret put <NAME>`, never as build-time env — these must not appear in the GitHub Actions build step):
- `SUPABASE_SERVICE_ROLE_KEY`
- `PIN_LOGIN_SECRET`
- `YOCO_SECRET_KEY`
- `YOCO_WEBHOOK_SECRET`

Build and test the Yoco flow entirely against Yoco's test-mode webhook simulator first — swap `YOCO_SECRET_KEY`/`YOCO_WEBHOOK_SECRET` for live keys only after the full registration→payment→webhook rehearsal passes (see design doc, Milestone 7).
