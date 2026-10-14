> 🌐 **English** | [한국어](./PRESENTATION.md)

> ℹ️ This is an English translation of [PRESENTATION.md](./PRESENTATION.md). The Korean version is canonical and may be more up to date.

# Anonymous Chat — Presentation

> **Anonymous real-time chat platform built on Cloudflare Workers**  
> School personal project / portfolio presentation deck

---

## 📋 Table of Contents

1. [Project Overview](#1-project-overview)
2. [Why I Built It](#2-why-i-built-it)
3. [Tech Stack & Rationale](#3-tech-stack--rationale)
4. [Architecture (4 Layers)](#4-architecture-4-layers)
5. [Core Features](#5-core-features)
6. [Security Design (Key Differentiator)](#6-security-design-key-differentiator)
7. [Demo Scenario (5-Minute Demo)](#7-demo-scenario-5-minute-demo)
8. [Technical Challenges & Troubleshooting](#8-technical-challenges--troubleshooting)
9. [Project Stats](#9-project-stats)
10. [Future Potential & Roadmap](#10-future-potential--roadmap)
11. [Top 15 Q&A](#11-top-15-qa)
12. [Appendix: Presentation Script](#12-appendix-presentation-script)

---

## 1. Project Overview

### One-Line Summary
> **Anonymous real-time chat you join instantly with just a nickname and no sign-up — every message self-destructs after 12 hours**

### Core Values
- **Anonymity**: No IP or email stored; the nickname lives only in client-side localStorage
- **Ephemerality**: Messages auto-delete after 12 hours; bans expire automatically too
- **Real-time**: Instant delivery over WebSocket
- **Full-stack**: Channels, push notifications, file sharing, AI summaries — the whole stack

### Target Users
- People who want lightweight small talk
- Groups that need a temporary community (side projects, study groups, gaming)
- Company-internal anonymous suggestion boxes

---

## 2. Why I Built It

### Motivation
- **"KakaoTalk group chats are heavy, DCInside/Reddit require sign-up, and Twitter stores everything forever"**
- → I wanted a **hybrid**: "lightweight, no sign-up, and leaves no trace"
- Discovering Cloudflare Workers made me fall for the idea that **"you can go full-stack serverless"**

### Learning Goals
1. Apply **Edge Computing** concepts in practice (Cloudflare Workers)
2. Learn state management patterns through **Durable Objects**
3. Handle the **WebSocket** protocol directly
4. Apply **web security** in practice (CSP, HMAC, Rate Limiting)
5. Design **full-stack architecture**

---

## 3. Tech Stack & Rationale

| Area | Tech | Rationale |
|------|------|-----------|
| **Runtime** | Cloudflare Workers | Edge execution (200+ POPs worldwide), cold start < 5ms, generous free tier |
| **State** | Durable Objects | Per-channel instance isolation, sticky sessions guaranteed, single-threaded to prevent race conditions |
| **Main DB** | Cloudflare D1 (SQLite) | Logs and audit trails, SQL migration management |
| **Ephemeral storage** | Cloudflare KV | Push subscriptions, transient state |
| **AI** | Workers AI (Qwen 1.5/3) | LLM summaries without operational burden; `/summary` `/topic` `/mood` `/conflict` |
| **Push** | Web Push (VAPID) + FCM v1 | Standard Web Push + Android compatibility |
| **Build** | esbuild | Code splitting across 10 entries, builds in under a second |
| **Frontend** | Vanilla JS + CSS Custom Properties | Minimal framework dependency, lower learning curve |
| **Testing** | Vitest | 611 cases, 41 files |
| **Linting** | ESLint + Prettier | Consistent code style |

### Trade-offs
- ❌ No React/Vue → smaller bundles, more learning (direct DOM control)
- ❌ No PostgreSQL → hard to replicate globally, but D1 is enough instead
- ✅ Vanilla JS → showcases "full-stack without a framework" in the portfolio

---

## 4. Architecture (4 Layers)

```
┌─────────────────────────────────────────────────────┐
│ Browser (chat.js)                                   │
│ - Web Crypto HMAC signing                           │
│ - 9 theme CSS variables                             │
│ - Service Worker (PWA, push receiver)               │
└──────────────────┬──────────────────────────────────┘
                   │ HTTPS / WSS
┌──────────────────▼──────────────────────────────────┐
│ Cloudflare Edge — Worker (worker.js)                │
│ - Routing (static/API/WS/admin)                     │
│ - Rate Limiting (KV/memory)                         │
│ - CORS / security headers                           │
└──┬──────────────┬──────────────────┬───────────────┘
   │              │                  │
   ▼              ▼                  ▼
┌────────┐   ┌─────────────┐   ┌──────────────┐
│ChatRoom│   │ChannelReg.  │   │DeadDropStore │
│  DO    │   │     DO      │   │     DO       │
│1/chan. │   │Metadata     │   │Secret msgs   │
└───┬────┘   └──────┬──────┘   └──────┬───────┘
    │               │                  │
    ▼               ▼                  ▼
┌────────────────────────────────────────────────────┐
│ Storage: D1 (logs) / KV (push) / AI (Qwen)         │
└────────────────────────────────────────────────────┘
```

### Roles of the 3 Durable Objects
| DO Class | Responsibility | Instances |
|-----------|------|----------|
| **ChatRoom** | WebSocket connections, message fan-out, reactions, bans, channel management | 1 per channel (idFromName) |
| **ChannelRegistry** | Channel list and metadata, permanent storage | 1 (singleton) |
| **DeadDropStore** | 30-minute TTL secret messages, one-time read | 1 (singleton) |

### Key Decisions
- **Handle WebSockets directly in the DO** → sticky sessions give each client a 1:1 DO pairing
- **HMAC message signing** → prevents tampering with client → DO messages
- **Ephemeral Token model** → secret delivered only once during the handshake, discarded on close
- **Worker ↔ DO communication uses `X-Admin-Internal-Token`** → SSRF prevention

---

## 5. Core Features

### 👤 User Features

| Feature | Description | Technical Point |
|------|------|---------------|
| Instant entry | Enter a nickname only, no sign-up | localStorage + crypto.randomUUID() |
| Real-time chat | Instant WebSocket message delivery | 1-second cooldown, 30 msg/min rate limit |
| 9 themes | dark/light/midnight/amethyst/sunset/sakura/evernight/ocean/forest | CSS Custom Properties (60+ variables) |
| Message reactions | 6 emoji, double-click quick like | reaction count Map |
| Replies + secret messages | Original preview, **Dead Drop** (30-min TTL, one-time read) | separate DO instance |
| File sharing | Images/video/audio/PDF, 100MB | external file.kalpha.kr proxy |
| AI summary | `/summary` `/topic` `/mood` `/conflict` | Workers AI Qwen 3 30B → 1.5 7B fallback |
| Message search | Keywords + tags (`#images` `#code` `#url`) | FTS-like substring matching |
| Link preview | Auto-parses OG tags + security header analysis | /api/preview SSRF defense |
| Code highlighting | Prism.js auto-detection | line count / alpha ratio heuristic |
| Multi-channel | Independent chat rooms per topic | DO instance isolation |
| Announcements | Normal/emergency + scheduling | DO storage (history capped at 100), CSV export |
| Push notifications | VAPID Web Push + FCM v1 | 30-day TTL, for offline users |
| PWA | Add to home screen, offline shell, share target | manifest.json, sw.js |

### 🛠️ Admin Features

| Feature | Description |
|------|------|
| Message management | Edit / delete / delete-all (confirm modal) |
| User bans | IP + SessionID dual (presets + custom input) |
| Announcements | Send/edit/delete/emergency/expiry |
| Channel management | List/detail/force delete |
| Audit log | D1 permanent storage, filtering, CSV export |
| Error tracking | Auto-collection + download + reset |
| Security events | 22 event types, Risk Score, auto-block recommendation |
| Login history | Success/failure/ban/logout |

---

## 6. Security Design (Key Differentiator)

### 6.1 Ephemeral Token Model (The Design I'm Proudest Of)

```
[Client]                              [ChatRoom DO]
  │                                          │
  │ ◀────── WS Upgrade ──────────────────────▶│
  │                                          │
  │ ◀─── {type: "handshake",                 │
  │        secret: 32-byte random,           │
  │        key: capability key,              │
  │        authorId: HMAC(sessionId)} ─────────│
  │                                          │
  │  Reconnect: {type: "join",               │
  │    sessionId, key} → key rotation,       │
  │    mismatch/missing → close 4401         │
  │                                          │
  │  Every message/edit/delete thereafter:   │
  │    HMAC-SHA256(                          │
  │      {content, sessionId, timestamp},    │
  │      secret                              │
  │    )  signature attached                 │
  │ ─────── signed message ─────────────────▶│
  │                                          │ verify
```

**Why does it matter?**
- In ordinary chat, messages travel in **plaintext** → a MITM can tamper with them
- Ephemeral Tokens:
  - A **32-byte secret per session** is issued
  - Delivered only once during the handshake → **minimizes the leak window**
  - **Discarded immediately** on WS close → even a reconnect can't forge old messages
  - Reconnects are allowed only via the capability key → mismatch/missing gives **close 4401**, and the key rotates on every connection

### 6.2 Triple-ban System

```javascript
// Multi-layer bans via IP / SessionID / Token
banReason = {
  ip: '1.2.3.4',           // direct IPv4 match
  sessionId: 'user_abc',   // per session
  token: 'kicked-uuid'     // kick token (strongest)
}
```

- Banning only the IP blocks legitimate users behind the same NAT
- Banning only the session is bypassed by simply reconnecting
- The token stays effective even when a kicked user reuses the shared IP

### 6.3 Security Headers (Compressed Into One Snippet)

```http
Content-Security-Policy: default-src 'self'; ...; upgrade-insecure-requests;
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Frame-Options: (removed — replaced by CSP frame-ancestors)
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

There is no external script CDN dependency — even Prism.js is self-hosted in our own bundle instead of cdnjs, and cdnjs was removed from the CSP.

### 6.4 Rate Limiting (4 Layers)

| Layer | Target | Limit |
|--------|------|------|
| L1 Worker memory | IP + endpoint | varies per endpoint |
| L2 Worker KV | IP (logins, etc.) | 5/5 min |
| L3 DO memory | WebSocket connections per IP | 25 |
| L4 DO message cooldown | per session | 1 second / 30 msg/min |

In addition, key entry points such as `/ws` must pass Cloudflare Turnstile ticket validation (bound to the join session, 2-hour TTL). Admin APIs (`/api/admin/*`) are protected by a shared 120/min/IP limiter and login-failure counters (with IP recorded).

### 6.5 Risk Scoring (Auto-Block Recommendation)

```javascript
// Each of 22 security event types is scored → cumulative score per IP
{
  XSS_PAYLOAD: 65,
  SQL_INJECTION: 70,
  PATH_TRAVERSAL: 60,
  TOKEN_INVALID: 50,
  WS_FLOOD: 50,
  // ... category diversity bonus +20%
}
// 150 points → auto-block recommendation, 300 points → critical
```

### 6.6 Input Sanitization in 3 Stages

1. **Client** → `sanitizeInput()` (strip control characters)
2. **Worker** → `validate.js` (type/length/structure)
3. **DO** → `security-classifier.js` (XSS/SQLi/Path Traversal pattern matching)

---

## 7. Demo Scenario (5-Minute Demo)

### Demo Flow (5 Minutes)

| Time | Demo | What It Showcases |
|------|-----------|-----------|
| 0:00 | Enter the main page | Emphasize "no sign-up, just a nickname" |
| 0:30 | Send a message (switch themes) | 9 themes, instant WebSocket updates |
| 1:30 | Reactions + replies | 6 emoji, Dead Drop option |
| 2:30 | File upload | 100MB upload → OG preview |
| 3:30 | AI summary command | `/summary` → summary displayed in Korean |
| 4:00 | New tab → push notification received | PWA + Web Push |
| 4:30 | Admin login → delete a message | Audit log recorded automatically |
| 5:00 | Security events dashboard | Risk Score, block recommendation |

### Pre-Demo Checklist
- [ ] Open two browsers (normal + incognito)
- [ ] Log in to the admin account in advance
- [ ] Prepare a few messages for the load test
- [ ] Cut the network, then restore → show automatic WS reconnection
- [ ] Refresh the page → explain that messages auto-expire after 12 hours

---

## 8. Technical Challenges & Troubleshooting

### 🔥 Challenge 1: WebSocket Session Sync

**Problem**: Durable Objects are single-threaded so race conditions are rare, but **when multiple WebSockets attach to the same channel, message fan-out is required**

**Solution**:
```javascript
// Inside the ChatRoom DO
this.sessions = new Map(); // sessionId → WebSocket

broadcast(message) {
  this.sessions.forEach((ws, sid) => {
    if (sid !== senderId) ws.send(JSON.stringify(message));
  });
}
```

### 🔥 Challenge 2: 100MB File Upload + Workers Limits

**Problem**: Workers impose a body size limit and can't buffer the whole request body in memory

**Solution**: File uploads are **proxied to an external service (file.kalpha.kr)** and the Worker only adds the `Authorization: Bearer` header

### 🔥 Challenge 3: HMAC Signing + Ephemeral Secret

**Problem**: To sign every message, the client must hold the secret → leak risk

**Solution**:
- The secret is imported as a **non-extractable key via the Web Crypto API**
- Used **only in-memory** when sending messages (never localStorage)
- The secret is discarded on WS close

### 🔥 Challenge 4: 9 Themes + Tailwind

**Problem**: Tailwind's `dark:` variant supports only 2 themes

**Solution**: Implemented 9 themes with **CSS Custom Properties + `[data-theme="xxx"]` selectors**
```css
[data-theme="dark"]  { --c-bg-900: #111827; --c-tx-100: #F3F4F6; ... }
[data-theme="light"] { --c-bg-900: #F9FAFB; --c-tx-100: #111827; ... }
```

### 🔥 Challenge 5: PWA + Push + Offline

**Problem**: How should the Service Worker communicate with the page and messages?

**Solution**:
```javascript
// sw.js — notify the page when a push arrives
self.addEventListener('push', e => {
  const data = e.data.json();
  e.waitUntil(self.registration.showNotification(data.title, data));
});
```

### 🐛 Troubleshooting War Stories
- **Cache-Control of 1 hour** → an XSS fix stayed live for an hour → fixed with a shorter TTL
- **HSTS preload application** → discovered a `kalpha.kr` domain mismatch → aligned the domains
- **Cloudflare D1 latency** → D1 isn't globally replicated → only log-type data in D1, hot path in DO memory

---

## 9. Project Stats

```
📦 Codebase
  - Server: 32 JS files (Worker + 3 DOs + handlers + utils + middleware)
  - Client: 30 source modules + 6 page wrappers (chat.js 47KB, 5 UI mixins)
  - Migrations: 5 SQL files (001–005, including the admin_logs DROP and security_events index fix)
  - Docs: 11 (README, 5 under docs/, design spec, CHANGELOG, etc.)
  - Total lines: ~15,000

🧪 Tests
  - Vitest 611 cases (41 files)
  - Full suite passes in under 20 seconds
  - Coverage modules: rate-limiter, helpers, security, classifier, risk-scorer, security-logger, security routes

🛡️ Security Controls
  - 22 security events (4 categories, 4 severities)
  - Multi-layer rate limiting (4 tiers) + admin routes 120/min/IP · login lockout counter
  - Triple-ban (IP + Session + Token)
  - 11 security headers
  - HMAC + Ephemeral Token
  - Observer WS 5-minute one-time ticket (removes admin token exposure in the URL)
  - Turnstile ticket bound to the join session (2h TTL)
  - D1/log retention enforcement sweep (every 10 writes) + DeadDrop alarm GC
  - Self-hosted Prism bundle (cdnjs removed from CSP)

⚡ Performance
  - chat.bundle.js 136KB (gzip ~40KB)
  - Code splitting into 10 chunks
  - 0 race conditions thanks to DO single-threading
  - Workers AI fallback (Qwen 3 → 1.5)
```

---

## 10. Future Potential & Roadmap

### Short Term (1-2 Months)
- [x] Deployment pipeline (Cloudflare Workers Builds auto-deploy + local verification: test·lint·deploy dry-run)
- [x] Strengthened core DO (`ChatRoom.js`) tests (chat-room*.test.js, 611 total)
- [x] Client XSS hotfix (escapeHtml quotes + stored XSS chain + forced SVG file proxy attachment)
- [x] CSP hardening (0 inline handlers, scripts externalized — no unsafe-inline/eval in script-src, cdnjs removed)
- [x] Observer one-time ticket · Turnstile join binding · admin route limiter · retention enforcement sweep (2026-09-16 v2)

### Mid Term (3-6 Months)
- [ ] End-to-end encryption (E2EE) — extend secret messages
- [ ] Voice messages (WebRTC)
- [ ] Internationalization (i18n) — English UI
- [ ] Read receipts
- [ ] Emoji picker UI

### Long Term (6+ Months)
- [ ] Mobile app (React Native / Capacitor)
- [ ] SSO integration (optional)
- [ ] Automated backups + GDPR compliance tooling
- [ ] Own domain (kalpha.chat) + formal HSTS preload registration

---

## 11. Top 15 Q&A

> Assumes a 15-20 minute presentation and 10-15 minutes of Q&A. Questions judges/professors ask often + model answers.

### Q1. Why did you choose Cloudflare Workers? Advantages over AWS Lambda or Vercel?

**A**: There were three decisive reasons.

1. **Edge execution**: Cloudflare runs in 200+ POPs worldwide, so Korean users don't have to travel to US servers. Lambda is region-based, so handling Tokyo users from a Seoul region adds 100ms+ of latency.
2. **Durable Objects**: A state management model optimized for workloads that need **sticky connections** like WebSocket comes built in. On AWS you'd have to assemble API Gateway + DynamoDB + Lambda yourself.
3. **Free tier**: Cost matters for a school project, and Workers gives 100k requests/day free, D1 gives 5GB free, KV gives 100k reads/day free. Enough for a demo.

---

### Q2. What are Durable Objects? How do they differ from a regular database?

**A**: Durable Objects are a model that gives you access to **"the same instance for a given ID, anywhere in the world"**.

Differences from a regular DB:
- Regular RDB: **multiple clients can read and write the same row concurrently** → race conditions, locks needed
- Durable Objects: **one instance per ID**, and requests arriving at that instance are processed **sequentially**

How it applies to chat:
- Put the channel slug `"channel:general"` into `idFromName("channel:general")` → **always the same DO instance** responds
- That instance manages all WebSocket connections → message fan-out becomes simple
- Race conditions prevented without any lock code

---

### Q3. What is HMAC signing? Why use it instead of JWT?

**A**: **HMAC (Hash-based Message Authentication Code)** is how two parties sharing a secret key verify a message's integrity.

```javascript
// Create signature
const sig = HMAC-SHA256(secret, message)

// Verify
const expectedSig = HMAC-SHA256(secret, message)
return sig === expectedSig
```

Why not JWT:
1. **Too heavy**: JWT has a 3-part header.payload.signature structure + Base64URL + expiry/issuer claims. Too much overhead per message
2. **Hard to revoke**: JWTs are stateless, so once issued they can't be revoked before expiry. To force-terminate a user session, an admin would need a separate blacklist
3. **Overkill for our use case**: Chat messages don't need a header/payload on every send. We only need to know "did this message come from this session"

So we built our own **Ephemeral Token model** — the secret is delivered once at handshake, and after that only HMAC signatures with the secret.

---

### Q4. How do you guarantee anonymity? IP addresses are still visible, aren't they?

**A**: We provide a **3-layer anonymity guarantee**.

1. **Metadata minimization**: No nickname, email, or phone number stored. The session ID lives only in client `localStorage`, and the server uses it for verification only
2. **Ephemerality**: Messages **auto-delete after 12 hours**, and bans expire automatically
3. **Limited IP use**: IP is used only for **rate limiting + banning**. Not stored for user identification/tracking (auto-deleted after 90 days)

Honestly though, it's **not full anonymity**. Your ISP can see the traffic, and Cloudflare can see logs. True anonymity would require Tor or end-to-end encryption (E2EE). That's on the roadmap.

---

### Q5. Have you done load testing? What happens with many concurrent users?

**A**: No formal load test (cost), but I did an **architectural analysis**.

- **Worker**: auto-scales — 100× traffic just spins up 100 instances
- **Durable Object**: one instance per channel → up to 1,000 concurrent users in a single channel is fine (single-threaded and sequential, but 1,000 WebSocket fan-outs take milliseconds)
- **Likely bottleneck**: D1 (SQLite, not globally replicated). So only log-type data goes to D1 and the hot path (message send/receive) lives in DO memory

If it were a truly large service:
- Distribute channels across regions
- Fan out via DO-to-DO RPC
- Queue AI summaries for async processing

---

### Q6. What if admin credentials are stolen? There's no 2FA, is there?

**A**: Honestly, this **needs hardening for production**. For a school project a single password is fine, but in production I would:

1. Add **2FA (TOTP)** — the next step after `verifyAdminToken` in `auth.js`
2. **Session invalidation UI** — view all active admin sessions + force logout (12h sliding TTL, server-side revocation on logout, 401 auto-logout already applied)
3. **IP allowlist** — restrict admin page access to specific IPs
4. **Reduce HMAC_SECRET's role** — admin tokens were already split into opaque random KV tokens. HMAC_SECRET is now used only for internal DO tokens, Turnstile tickets, and authorId derivation

This is tracked in the issue tracker as `feat: 2fa-admin`.

---

### Q7. Messages are deleted after 12 hours? Are they really deleted? Is there a backup?

**A**: Really deleted. Three mechanisms:

1. **Memory**: spliced out of the ChatRoom DO's internal `this.messages` array
2. **DO Storage**: `state.storage.delete()` is called
3. **D1**: cleaned up once past `MESSAGE_RETENTION_MS`

**There are no backups.** That's deliberate. With an anonymous chat, backups are a liability. Note however that **Cloudflare's own infrastructure logs** (network logs, audit logs) may be retained for 30 days. Those cannot be deleted without user consent.

For GDPR, when a "right to be forgotten" request arrives → we run a script that deletes from D1 + DO Storage + KV.

---

### Q8. How does AI summarization work? Doesn't user data go to an AI company?

**A**: We use **Workers AI**. The Qwen 1.5 7B / Qwen 3 30B models are **self-hosted** inside Cloudflare's infrastructure, so no data leaves.

The prompt includes:
- Only the latest 50 messages (not the whole history)
- sessionId, IP, and nickname are **explicitly excluded**
- The system prompt instructs: "Do not output PII (names, phone numbers, emails)"

There is no summary cache. Instead, repeated requests from the same user are limited by a 15-second rate limit.

---

### Q9. Why no end-to-end encryption (E2EE)? Admins can read messages, can't they?

**A**: Correct. Currently only **transport is encrypted with TLS**, and the server sees plaintext messages. That means admins can read messages at will.

Why we don't do E2EE:
1. **In an anonymous chat you don't know who the other party is** — there's no mechanism to exchange public keys
2. **Search/AI summaries get harder** — the server needs to see message content
3. **Beyond a school project's scope** — integrating a proven library like Signal Protocol is a semester's worth of work on its own

Going forward, we plan to apply E2EE starting with **Dead Drop (secret messages)**. 1:1 communication makes public key exchange clear, and it's exactly the feature admins must not be able to read, so the case is strong.

---

### Q10. Why didn't you use React/Vue? Is vanilla JS enough?

**A**: **Portfolio differentiation** is the biggest reason.

Implementing 30 source modules (+6 page wrappers) in vanilla JS — chat, search, lightbox, modals, context menus — demonstrates:
- A **deep understanding** of DOM APIs, event bubbling, async handling, and memory management
- **Stories to tell** when an interviewer asks "How did you do this without React?"
- Smaller bundle (React + ReactDOM is ~140KB; ours is 0KB)

Challenges that came up while building an SPA in vanilla JS:
- State: mixin pattern (`Object.assign(UIManager.prototype, ...)`) + Pub/Sub
- Routing: URL hash + `popstate`
- Memory: explicit `URL.createObjectURL` revoke, event listener cleanup
- Modules: ES Modules + esbuild code splitting

That said, **it's unrealistic for large teams.** It was possible because this is a one-person project.

---

### Q11. Why do you allow `'unsafe-inline'` and `'unsafe-eval'` in CSP?

**A**: We **don't allow them** anymore in `script-src`. The initial version allowed them because of 100+ inline handlers (`onclick="..."`), but everything was refactored to `addEventListener` + `data-*`, and inline scripts were split into external files (`theme-init.js`, `announcements-page.js`), removing them entirely.

Current state:
- No `'unsafe-inline'`/`'unsafe-eval'` in `script-src` (strict CSP)
- **0** inline handlers (`onclick=`/`onerror=` grep returns 0)
- Stored XSS chain (unquoted `escapeHtml` + raw `innerHTML`) **fixed**
- Remaining: `'unsafe-inline'` in `style-src` (dynamic styles) — evaluating a nonce/hash migration

---

### Q12. Where will the first bottleneck appear as you scale?

**A**: **D1 (SQLite)**, hands down.

Cloudflare D1:
- **Not globally replicated** (single region)
- **30-100ms read/write latency**
- **Transaction limits** (one region at a time)

So currently:
- Only **log-type data** in D1 (audit logs, security events, error logs)
- **Hot path** in DO memory (messages, sessions, reactions)

When scaling becomes necessary:
- Step 1: move logs to **Workers Analytics Engine** (faster)
- Step 2: bring in an **external DB (Postgres on Neon, PlanetScale)**
- Step 3: **real-time only in DO**, permanent storage external

---

### Q13. The license is AGPL-3.0 — why is there also a commercial license?

**A**: AGPL-3.0 carries a **"publish source + same license"** obligation. Anyone offering my service as SaaS for profit **must also publish their source code**.

I wanted to leave room for commercializing this project later, so:
- **AGPL-3.0** — for open-source users (use it freely; just publish your modifications)
- **COMMERCIAL_LICENSE.md** — businesses pay a license fee to waive the AGPL obligations

Dual licensing is a proven pattern used by companies like MongoDB, MariaDB, and Sentry.

---

### Q14. What do you want to learn from this project? (And what did you learn?)

**A**: **(Personal answer section — fill in freely)**

Examples:
- "Applying Edge Computing in the real world"
- "State management patterns (especially Sticky Connections)"
- "Implementing web security in code (CSP, HMAC, Rate Limit)"
- "Full-stack architecture design — handling every responsibility in a single instance"

---

### Q15. Is there anything you want to build next?

**A**: **(Personal answer section — fill in freely)**

Examples:
- "An E2EE messenger (learning Signal Protocol)"
- "A budgeting app with distributed transactions"
- "WebRTC-based video chat"

---

## 12. Appendix: Presentation Script

> Based on a 5-minute talk + 5-minute Q&A. Speak naturally, but make sure to include the key keywords.

### 0:00 - 0:30 Intro

> "Hello, the project I'm presenting today is **Anonymous Chat**.  
> It's an anonymous real-time chat built on Cloudflare Workers; in one sentence, it combines **'the lightness of KakaoTalk + the anonymity of DCInside + 12-hour auto-destruction'**.  
> My presentation order will be tech stack → architecture → core features → security design → demo → Q&A."

### 0:30 - 1:30 Why I Built It + Stack

> "First, why I built it: I wanted to fix the shortcomings of existing chat services.  
> KakaoTalk is heavy, DCInside/Reddit require sign-up, and Twitter stores things forever.  
> I wanted something 'lightweight without sign-up that leaves no trace.'  
> The stack is Cloudflare Workers + Durable Objects + D1 + KV, all **serverless**.  
> In particular, Durable Objects guarantee **one instance per channel**, enabling message fan-out without race conditions."

### 1:30 - 2:30 Architecture & Core Features

> "The architecture has 4 layers — browser → Worker → Durable Objects → Storage.  
> The core features are anonymous entry, 9 themes, real-time WebSocket chat, 100MB file uploads, AI summaries, push notifications, PWA, an admin dashboard, and a secret-message feature called **Dead Drop** — 14 in total."

### 2:30 - 3:30 Security (Main Focus)

> "The part I'm **most proud of** is the security design.  
> First, the **Ephemeral Token model** — a 32-byte secret is issued per session and signs every message with HMAC-SHA256. The secret is discarded immediately on WS close.  
> Second, the **Triple-ban system** — multi-layer bans via IP, session, and token.  
> Third, **11 security headers** including CSP, HSTS, and COOP/COEP.  
> Finally, **Risk Scoring** — 22 security events are scored, and when the cumulative score crosses a threshold it recommends an automatic block."

### 3:30 - 4:30 Demo

> "Now let me show you. *(demo starts)*  
> I join as 'Presenter1' and send a message — *(show reaction)* — it appears instantly, and I can switch themes too...  
> *(demo file upload, reactions, AI summary, push notification in order)*"

### 4:30 - 5:00 Wrap-up

> "To wrap up, the core values of this project are **anonymity + ephemerality + real-time**.  
> It started as a school project, but I plan to grow it into a portfolio piece, and the next steps are **CI/CD** and **E2EE**.  
> That concludes my presentation. Thank you."

---

## 📎 Appendix: Cheat Sheet (One-Page Interview Summary)

```
Project: Anonymous Chat
Stack: Cloudflare Workers + DO + D1 + KV + Workers AI
Scale: 32 server files, 30 client source modules + 6 page wrappers, 611 tests passing
Key designs:
  1. Ephemeral Token (HMAC signing, 32-byte secret)
  2. Triple-ban (IP + Session + Token)
  3. 4-tier rate limit + admin route limiter
  4. 9-theme CSS Custom Properties
  5. 3 Durable Objects (ChatRoom/ChannelRegistry/DeadDropStore)
  6. Risk Scoring (22 events, auto-block recommendation)
  7. Observer one-time ticket + Turnstile join binding
Hardest challenge: WebSocket fan-out in DO (solved: Map<sid, ws>)
Proudest part: full-stack application of security headers + HMAC + Rate Limiting
Next steps: E2EE, test coverage thresholds, mobile app
License: AGPL-3.0 + separate commercial license
```

---

**Created**: 2026-06-24  
**Project Version**: v1.0  
**Related Docs**: [README.en.md](../README.en.md) · [docs/ARCHITECTURE.en.md](../docs/ARCHITECTURE.en.md) · [docs/SECURITY.md](../docs/SECURITY.md) (Korean)
