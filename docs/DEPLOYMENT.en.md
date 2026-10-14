> 🌐 **English** | [한국어](./DEPLOYMENT.md)

> ℹ️ This is an English translation of [DEPLOYMENT.md](./DEPLOYMENT.md). The Korean version is canonical and may be more up to date.

# Deployment Guide

Procedure for deploying Anonymous Chat to Cloudflare Workers (including static assets).

---

## Table of Contents

- [Overview](#overview)
- [1. Prerequisites](#1-prerequisites)
- [2. Secret Configuration](#2-secret-configuration)
- [3. D1 Database Setup](#3-d1-database-setup)
- [4. KV Namespaces (required)](#4-kv-namespaces-required)
- [5. Durable Objects Bindings](#5-durable-objects-bindings)
- [6. AI Binding](#6-ai-binding)
- [7. Build](#7-build)
- [8. Local Development](#8-local-development)
- [9. Production Deployment](#9-production-deployment)
- [10. Domain Setup](#10-domain-setup)
- [11. Monitoring](#11-monitoring)
- [12. Rollback](#12-rollback)
- [13. Performance Tuning](#13-performance-tuning)
- [14. Troubleshooting](#14-troubleshooting)
- [15. Post-Deployment Checklist](#15-post-deployment-checklist)
- [16. References](#16-references)

---

## Overview

| Step | Task | Time |
|---|---|---|
| 1 | Prerequisites (account, tools) | 5 min |
| 2 | Secret configuration (8 secrets) | 10 min |
| 3 | D1 database creation + migrations | 5 min |
| 4 | KV namespaces (ADMIN_TOKENS required + PUSH_SUBSCRIPTIONS) | 2 min |
| 5-6 | DO/AI bindings (automatic) | 0 min |
| 7 | Build | 1 min |
| 8 | Local testing | 10 min |
| 9 | Production deployment | 5 min |
| 10-16 | Domain/monitoring/rollback setup | 20 min |

Total estimated time: about 1 hour

---

## 1. Prerequisites

### 1.1 Account/Tools
- Cloudflare account (Free or Paid)
- Node.js 18+ installed
- Wrangler CLI: `npm install -g wrangler`
- Git repository (GitHub/GitLab)

### 1.2 Cloudflare Authentication
```bash
wrangler login
# 브라우저에서 OAuth 인증
```

## 2. Secret Configuration

### 2.1 Required Secrets
```bash
# 관리자
wrangler secret put ADMIN_ID
wrangler secret put ADMIN_PASSWORD

# 메시지 서명 + 내부 토큰
wrangler secret put HMAC_SECRET
# openssl rand -hex 32 결과값 사용 권장

# Web Push (VAPID)
wrangler secret put VAPID_PUBLIC_KEY
wrangler secret put VAPID_PRIVATE_KEY
# 생성: npx web-push generate-vapid-keys

# Cloudflare Turnstile
wrangler secret put TURNSTILE_SECRET_KEY
# https://dash.cloudflare.com → Turnstile → Site Key/Secret Key

# FCM (선택, Android 알림)
wrangler secret put FCM_SERVICE_ACCOUNT
# Firebase Console → Project Settings → Service Accounts → Generate Key
# JSON 내용을 한 줄로 입력

# 외부 파일 서비스 (필수 — 없으면 업로드/다운로드 503)
wrangler secret put FILE_API_KEY
```

### 2.2 Environment Variables (vars)
Already defined in `wrangler.toml` (editable):
```toml
[vars]
TURNSTILE_SITE_KEY = "0x4AAA..."
FILE_UPLOAD_URL = "https://file.kalpha.kr/api/files"
KALPHA_API_URL = "https://api.kalpha.kr"
```

## 3. D1 Database Setup

### 3.1 Create
```bash
wrangler d1 create anonymous-chat-db
# 출력: database_id = "xxxx-xxxx-xxxx-xxxx"
```

### 3.2 Update `wrangler.toml`
Already defined in `wrangler.toml` (no changes needed):
```toml
[[d1_databases]]
binding = "DB_ADMIN"
database_name = "anonymous-chat-db"
database_id = "여기에-위에서-받은-ID"
```
> `migrations_dir` is not configured (the default `migrations/` is used).

### 3.3 Run Migrations
```bash
# 프로덕션
wrangler d1 migrations apply anonymous-chat-db --remote

# 로컬 테스트
wrangler d1 migrations apply anonymous-chat-db --local
```

Tables created (in migrations/ apply order):
- `admin_activity_logs` (002) — admin login/logout/activity
- `audit_logs` (002) — admin actions (kick, edit, delete, etc.)
- `error_logs` (002) — client/server errors
- `security_events` (003) — security events (90-day retention)

Other migrations:
- `001_create_admin_logs.sql` — legacy `admin_logs` (dropped in 004)
- `004_drop_admin_logs.sql` — DROP the legacy `admin_logs` table
- `005_fix_security_events_index.sql` — recreate the non-deterministic `strftime` partial index on `security_events`

## 4. KV Namespaces (required)

### 4.1 Create
Two namespaces are needed: `ADMIN_TOKENS` (admin token issuance/verification/revocation, required) and `PUSH_SUBSCRIPTIONS` (push subscription storage, required when using push).
```bash
wrangler kv:namespace create ADMIN_TOKENS
wrangler kv:namespace create PUSH_SUBSCRIPTIONS
# 출력: id = "yyyy"
```

### 4.2 Update `wrangler.toml`
```toml
[[kv_namespaces]]
binding = "ADMIN_TOKENS"
id = "여기에-ID"

[[kv_namespaces]]
binding = "PUSH_SUBSCRIPTIONS"
id = "여기에-ID"
```

## 5. Durable Objects Bindings

Already defined in `wrangler.toml` (no changes needed, based on `compatibility_date = "2026-07-15"`):
```toml
[[durable_objects.bindings]]
name = "CHAT_ROOM"
class_name = "ChatRoom"

[[durable_objects.bindings]]
name = "CHANNEL_REGISTRY"
class_name = "ChannelRegistry"

[[durable_objects.bindings]]
name = "DEAD_DROP_STORE"
class_name = "DeadDropStore"

[[migrations]]
tag = "v1"
new_classes = ["ChatRoom"]

[[migrations]]
tag = "v2"
new_sqlite_classes = ["ChannelRegistry"]

[[migrations]]
tag = "v3"
new_sqlite_classes = ["DeadDropStore"]
```

**Important**: when renaming a DO class, add the new class via migration and then remove the old class (Workers does not support renames).

## 6. AI Binding

Defined in `wrangler.toml`:
```toml
[ai]
binding = "AI"
```

**Limits**:
- Free tier: Workers AI has a daily limit
- Models used: `@cf/qwen/qwen3-30b-a3b-fp8`, `@cf/qwen/qwen1.5-7b-chat` (both support the free tier)

## 7. Build

### 7.1 Client Bundle
```bash
npm install
npm run build
# 출력: public/js/*.bundle.js (10종), public/css/tailwind.min.css
```

### 7.2 Build Scripts (`package.json`)
```json
{
  "scripts": {
    "dev": "npm run css && npm run bundle && wrangler dev --var ENVIRONMENT:development --port 8788",
    "build": "npm run css && npm run bundle && npm run lint",
    "deploy": "npm run css && npm run bundle && wrangler deploy",
    "lint": "eslint src/ public/js/",
    "test": "vitest run"
  }
}
```

### 7.3 Workers Builds (when Git-integrated)
If Workers Builds' Build command is **empty**, the `public/js/*.bundle.js`, `public/js/chunks/*`, and `public/css/tailwind.min.css` committed to the repository are deployed as-is. Therefore you must **run `npm run build` locally and commit the output before pushing**. To automate the build in CI, set the Dashboard's Build command to `npm run build`.

## 8. Local Development

### 8.1 `.dev.vars` File
Create it at the project root (check gitignore):
```bash
cp .dev.vars.example .dev.vars
# 각 시크릿 값 입력
```

### 8.2 Starting the Development Server
```bash
npm run dev
# http://localhost:8788
```

**Features**:
- Hot reload (Worker code)
- Local D1 (`.wrangler/state/`)
- Local KV (`.wrangler/state/`)
- Local DO instances

### 8.3 Debugging
- `wrangler tail` (production logs)
- `wrangler dev --local` (local only)
- `console.log` output appears in the `wrangler dev` console

## 9. Production Deployment

### 9.1 Git Integration (recommended)
Cloudflare Dashboard → Workers & Pages → existing Worker (`anonymous-chat`) → Settings → Builds → connect the Git repository (Workers Builds).

**Build settings**:
- Build command: (empty by default — deploys the committed build output as-is. Can be set to `npm run build` in the Dashboard)
- Deploy command: `npx wrangler deploy`
- Root directory: `/`

**Environment variables**:
- Dashboard → Settings → Variables and Secrets
- Can be configured separately for Production / Preview

### 9.2 CLI Deployment
```bash
npm run deploy
# 또는
wrangler deploy
```

### 9.3 Post-Deployment Checks
1. Open https://your-domain.com
2. Test the WebSocket connection (send a message)
3. Admin login (`/administrator.html`)
4. Test push notifications
5. Check D1 logs

## 10. Domain Setup

### 10.1 Workers Custom Domain
- Dashboard → Workers & Pages → `anonymous-chat` → Settings → Domains & Routes
- Add `chat.example.com` (CNAME)

### 10.2 DNS
Managed automatically by Cloudflare (CNAME flattening).

### 10.3 SSL/TLS
- Full (Strict) mode recommended
- Submit to HSTS preload (requires domain prevalidation)

## 11. Monitoring

### 11.1 Cloudflare Built-in
- Workers → Metrics (traffic, error rate)
- Workers → Logs (real-time logs, `wrangler tail`)
- D1 → Metrics (query count, latency)

### 11.2 External Tools (optional)
- Sentry (error tracking)
- Plausible/Umami (analytics)
- Uptime Kuma (uptime)

## 12. Rollback

### 12.1 Dashboard Rollback
- Dashboard → Workers & Pages → `anonymous-chat` → Deployments → previous version → "Rollback"

### 12.2 CLI
```bash
wrangler deployments list
wrangler rollback [deployment-id]
```

### 12.3 D1 Migration Rollback
**D1 is forward-only**. For breaking changes:
1. Always add new columns as nullable or with a default value
2. Drop columns in a two-step migration (rename → drop in the next release)
3. Write code that is compatible with both schemas

## 13. Performance Tuning

### 13.1 Worker
- Memory: 128MB limit
- CPU: 10ms (Free) / 50ms (Paid) — average
- Use per-region cache: `caches.default`

### 13.2 Durable Objects
- Memory: 128MB per DO
- Storage: 1GB per DO
- WebSocket: 32K concurrent connections (in practice depends on memory)
- Distribution: `getChatRoom()` guarantees sticky sessions

### 13.3 D1
- Reads: 5 million/day (Free) / 50 million/day (Paid)
- Writes: 100K/day (Free) / 1M/day (Paid)
- Indexes: defined in `migrations/*.sql`

### 13.4 Cache Strategy
- OG Preview: 1 hour (Edge + client LRU 50)
- Static assets: `/js/*`, `/css/*` use `no-cache, must-revalidate` via `public/_headers` — bundle filenames are fixed (no hashes), so revalidate on every load (ETag 304) to prevent browsers/edge from serving stale versions after a deploy
- API responses: mostly not cached (real-time takes priority)

## 14. Troubleshooting

### 14.1 WebSocket Connection Failures
- `Origin` required (fail-closed): missing or not in the allowlist → `403`; check `SECURITY.ALLOWED_ORIGINS` (in development only `ENVIRONMENT=development` + `http://localhost:8788` are allowed)
- `ticket` query required: an HMAC ticket (2 hours, bound to the join sessionId — mismatch closes with `4401`) issued by `POST /api/turnstile/verify` (with `sessionId` in the body). Missing/mismatched tickets reject the connection
- `admin_obs_*` observer sessions pass the 5-minute ticket issued by `POST /api/admin/observer-ticket` (admin auth) as the `ticket` query parameter; failures return `401` (the admin token is never placed in the URL)
- Verify `/api/check-ban` returns 200
- Verify `HMAC_SECRET` matches
- Local development port is `8788` (`wrangler dev --var ENVIRONMENT:development --port 8788`)

### 14.2 Push Notifications Not Received
- Verify VAPID keys match
- `Notification.permission === 'granted'`
- Verify Service Worker registration (`/sw.js`)
- Check KV key TTL (30 days)

### 14.3 D1 Errors
- Check migration order
- Check parameter binding (`?` placeholders are enforced to prevent SQL injection)
- Check index usage (`EXPLAIN QUERY PLAN`)

### 14.4 AI Summary Failures
- Verify model availability (`qwen3-30b-a3b-fp8`, `qwen1.5-7b-chat`)
- Completes within the 8-second timeout
- Check the daily limit

## 15. Post-Deployment Checklist

- [ ] All 8 secrets configured
- [ ] D1 migrations applied
- [ ] DO migrations applied
- [ ] KV namespaces created (`ADMIN_TOKENS` required, `PUSH_SUBSCRIPTIONS` when using push)
- [ ] Domain connected
- [ ] SSL/TLS Full (Strict)
- [ ] No CSP violations (Cloudflare Analytics)
- [ ] Admin login works
- [ ] WebSocket chat works
- [ ] AI summary works
- [ ] Push notifications work
- [ ] OG preview works
- [ ] Channel creation/join works
- [ ] Dead drop secret messages work
- [ ] Mobile responsiveness verified
- [ ] Lighthouse score 90+

## 16. References

- [docs/DEVELOPMENT.en.md](./DEVELOPMENT.en.md) — development guide
- [docs/SECURITY.md (Korean)](./SECURITY.md) — security checklist
- [wrangler.toml](../wrangler.toml) — Cloudflare configuration
- [Cloudflare Workers documentation](https://developers.cloudflare.com/workers)
