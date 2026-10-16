> 🌐 **English** | [한국어](./ARCHITECTURE.md)

> ℹ️ This is an English translation of [ARCHITECTURE.md](./ARCHITECTURE.md). The Korean version is canonical and may be more up to date.

# Architecture

> Anonymous Chat's system architecture and data flow

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Components](#components)
3. [Data Flows](#data-flows)
4. [Security Boundaries](#security-boundaries)
5. [Build Pipeline](#build-pipeline)
6. [Performance Characteristics](#performance-characteristics)
7. [Extension Points](#extension-points)

---

## System Overview

```mermaid
flowchart TB
    Client[Browser client<br/>chat.js / admin-core/admin-ui/admin-main<br/>pages/page-*.js]

    subgraph Edge["Cloudflare Edge"]
        DNS[DNS]
        Worker["Worker<br/>worker.js router + [assets] static assets"]
    end

    subgraph DO["Durable Objects"]
        ChatRoom["ChatRoom DO<br/>(1 per channel)"]
        ChannelReg["ChannelRegistry DO<br/>(singleton)"]
        DeadDrop["DeadDropStore DO<br/>(singleton)"]
    end

    subgraph Storage["Storage"]
        D1[(D1 Database<br/>logs)]
        D1_sec[(D1<br/>security_events)]
        KV[(KV<br/>push subscriptions)]
        AI[Workers AI<br/>Qwen 3 30B]
    end

    External[External API<br/>Kalpha: files/security headers]

    subgraph Security["Security Monitoring"]
        Classifier[security-classifier<br/>XSS/SQL/path traversal]
        Scorer[risk-scorer<br/>risky IP scoring]
        SecLogger[security-logger<br/>D1 writes + dedup]
        SecAPI[handlers/security<br/>8 APIs]
    end

    Client -->|HTTPS/WS| DNS
    DNS --> Worker

    Worker -->|forwardToDO| ChatRoom
    Worker -->|forwardToDO| ChannelReg
    Worker -->|forwardToDO| DeadDrop

    ChatRoom -->|INSERT/SELECT| D1
    ChatRoom -->|KV list| KV
    ChatRoom -->|AI.run| AI
    ChatRoom -->|fetch| External

    Worker -->|log event| Classifier
    Classifier -->|score| Scorer
    Scorer -->|write| SecLogger
    SecLogger -->|INSERT| D1_sec
    SecAPI -->|SELECT| D1_sec
    Worker -->|fetch| External
    Worker -->|security API| SecAPI
```

---

## Components

### 1. Worker (`src/worker.js`, 558 lines)

Cloudflare Workers entry point (static assets are served through the `[assets]` binding). HTTP routing, WebSocket upgrades, and static asset fallback handling.

**Route Table**

| Category | Count | Path |
|---|---|---|
| Public endpoints | 22 | `/api/*`, `/ws`, `/metrics`, `/health` |
| Admin endpoints | 32 | `/api/admin/*` (allowed methods specified per route) |
| SPA fallback | – | unmatched → `/index.html` |

**Main Helpers**

| Function | Responsibility |
|---|---|
| `matchRoute()` | Declarative route matching (supports a method or an array of methods) |
| `handleChannelCreate` / `handleChannelJoin` / `handleChannelList` | Channel create/join/list handlers |
| `serveStaticAssets()` | ASSETS binding + SPA fallback |
| `checkRateLimit()` | Lazy-init rate-limiter (Workers-compatible) |

---

### 2. ChatRoom Durable Object (`src/durable-objects/ChatRoom.js`, 1735 lines)

The core WebSocket handler. One instance per channel (1 main room + N channels).

**Responsibilities**

| Area | Description |
|---|---|
| Session management | `sessions` Map, `ipConnections` Map |
| Message storage | DO Storage 12 hours, max 2000 (96KiB byte cap) |
| Bans | IP + SessionID |
| Announcements | Normal/emergency + scheduling |
| Reactions | Emoji toggle |
| Push | Offline users |
| AI summary | Workers AI calls |
| Auto cleanup | Schedules a DO alarm on last leave → empty channel self-deletes (10-minute TTL) |

**Helper Modules**

| File | Lines | Responsibility |
|---|---|---|
| `chat-room/admin.js` | 1156 | 19 `/admin/*` routes (including ban-ip, verify-session) |
| `chat-room/messages.js` | 218 | validation, search, AI sanitization |
| `chat-room/announcements.js` | 5 | `isEmergencyActive` helper |

**WebSocket Message Types**

| Direction | Count | Types |
|---|---|---|
| Inbound | 7 | `ping`, `join`, `message`, `edit`, `delete`, `reaction`, `typing` |
| Outbound | 19 | `handshake`, `pong`, `banned`, `history`, `announcement`, `system`, `error`, `message`, `message_edited`, `message_deleted`, `message_reaction`, `typing`, `user_count`, `emergency_cleared`, `summary`, `kicked`, `all_messages_deleted`, `admin_event`, `channel_deleted` |

---

### 3. ChannelRegistry Durable Object (`src/durable-objects/ChannelRegistry.js`, 418 lines)

Channel metadata singleton. Maps slug → channel info.

**Responsibilities**
- Channel create/read/delete
- `lastActive` refresh
- Empty-channel auto cleanup (alarm-only — no sweep on fetch, minimum 5-minute interval, verifies activeConnections is 0 before deletion)
- Admin channel list/force delete

---

### 4. DeadDropStore Durable Object (`src/durable-objects/DeadDropStore.js`, 183 lines)

One-time secret message singleton.

**Features**
- 30-minute TTL
- Permanently deleted after a single read
- 10,000-character limit
- 404/410 distinguishes expired/consumed
- DO alarm-based expiry cleanup (reschedules to the earliest expiry on save; on alarm, cleans up and then reschedules/deletes)

---

### 5. Handlers (`src/handlers/`)

| File | Lines | Responsibility |
|---|---|---|
| `admin.js` | 675 | 24 handlers (login + 23 withAuth types, including observer-ticket) |
| `websocket.js` | 136 | WebSocket upgrade + observer ticket/ban pre-checks |
| `push.js` | 351 | VAPID/FCM subscription management + delivery |
| `summary.js` | 216 | Workers AI summary (4 modes, 15-second rate limit) |
| `preview.js` | 279 | OG tag scraper (1-hour edge cache, SSRF denylist) |
| `turnstile.js` | 183 | Cloudflare Turnstile verification + Turnstile/observer ticket issuance and verification |
| `health.js` | 17 | `/health`, `/metrics` |

---

### 6. Middleware/Utilities

| File | Responsibility |
|---|---|
| `middleware/auth.js` | Opaque KV token issuance/verification (12-hour sliding), rate limit |
| `utils/do.js` | DO routing (`getChatRoom`, `getChannelRoom`, `forwardToDO`) |
| `utils/validate.js` | Message/channel/nickname/session/Dead Drop validation |
| `utils/errors.js` | `jsonError`, `jsonSuccess`, `textError`, `emptyResponse` |
| `utils/helpers.js` | `sanitizeInput`, HMAC helpers, `safeJson` |
| `utils/rate-limiter.js` | In-memory window counter |
| `utils/security.js` | `constantTimeCompare`, `isAllowedOrigin` |
| `utils/security-classifier.js` | XSS/SQL/path traversal pattern matching (22 event types classified) |
| `utils/risk-scorer.js` | Risky IP scoring based on time weighting + category diversity |
| `utils/security-logger.js` | D1 security_events writes + 60-second dedup + 90-day cleanup |
| `utils/logger.js` | D1 admin/audit/error logger + security event re-export |
| `utils/web-push.js` | VAPID JWT + RFC 8291 encryption |
| `utils/fcm-auth.js` | Google OAuth JWT for FCM v1 |
| `config/constants.js` | All magic numbers (shared server + client) |
| `config/cors.js` | CORS headers |
| `constants/security-events.js` | 22 security event definitions (category/severity/score) |

---

## Data Flows

### 1. Message Send (most frequent path)

```mermaid
sequenceDiagram
    participant C as Client
    participant DO as ChatRoom DO

    C->>DO: WS: {type:'message', content, signature<br/>=HMAC(sessionSecret, ...)}

    Note over DO: handleMessage
    DO->>DO: validateClientMessage
    DO->>DO: checkRateLimit (1s/30min)
    DO->>DO: sessionSecret lookup (Map)
    DO->>DO: recompute HMAC(sessionSecret, payload) and compare
    DO->>DO: generateMessageSignature (HMAC_SECRET,<br/>metadata for broadcast)
    DO->>DO: storage.put('messages') (sessionId retained)
    DO->>DO: broadcast({...signature}, sessionId excluded · authorId used)

    DO-->>C: broadcast to all sessions

    Note over DO: throttledPushNotification
    DO->>DO: 1.5s throttle
    DO->>DO: sendPushToOfflineUsers<br/>(iterate KV subscribers)
```

### 2. WebSocket Handshake (Ephemeral Token)

```mermaid
sequenceDiagram
    participant C as Client
    participant W as Worker
    participant DO as ChatRoom DO

    C->>W: GET /ws?sessionId=&channel= (Turnstile ticket included)

    Note over W: 1. Origin validation (fail-closed if missing)<br/>2. sessionId validation (regex)<br/>3. Turnstile/observer ticket validation (bound to sessionId)<br/>4. Observers (admin_obs_*) require an observer ticket instead of an admin token<br/>5. ChannelRegistry channel lookup (404 if missing)
    W->>W: 6. /api/check-ban (preflight)
    W->>DO: checkBan
    DO-->>W: {banned: false}
    W-->>C: 101 Switching Protocols

    C->>DO: WS: {type:'join', sessionId}

    Note over DO: handleJoin
    DO->>DO: restore session from storage
    DO->>DO: send 100-message history batch (RECENT_MESSAGES_BATCH)
    DO->>DO: broadcast user_count
    DO->>DO: generate 32-byte random secret + capability key<br/>store in session Map
    DO-->>C: WS: {type:'handshake', secret:'<64hex>', key, authorId}
    Note over C,DO: on reconnect, close 4401 without a valid key<br/>(4401 Session mismatch if join sessionId doesn't match the ticket)
    DO-->>C: WS: {type:'history', messages:[...100]}
    DO-->>C: WS: {type:'user_count', count: 12}

    Note over C: secret kept in memory
    C->>DO: WS: {type:'message', content, signature<br/>=HMAC(secret, {content,sessionId,timestamp})}

    Note over DO: handleMessage<br/>1. sessionSecret lookup<br/>2. recompute signature and compare (±30s freshness)<br/>3. reject on mismatch
    DO-->>C: WS: {type:'message', message, signature}

    Note over DO: discard secret from Map on close
```

### 3. Channel Create/Join

```mermaid
sequenceDiagram
    participant C as Client
    participant W as Worker
    participant CR as ChannelRegistry DO

    C->>W: POST /api/channels/create {name:'kalpha'}
    W->>W: channelRequest('create')
    W->>CR: X-Admin-Internal-Token + /create

    Note over CR: 1. toSlug('kalpha')<br/>2. duplicate check<br/>3. storage.put<br/>4. persist (every 5 seconds)
    CR-->>W: {slug, name, createdAt}
    W-->>C: {success, slug}

    C->>W: POST /api/channels/join {slug:'kalpha'}
    W->>CR: /touch
    Note over CR: lastActive refresh
    CR-->>W: {success}
    W-->>C: {success}

    Note over C,CR: next connection: GET /ws?channel=kalpha
```

### 4. AI Summary

```mermaid
sequenceDiagram
    participant C as Client
    participant W as Worker
    participant DO as ChatRoom DO
    participant AI as Workers AI

    C->>W: POST /api/summary {mode:'default'|'topic'|'mood'|'conflict', channel?}

    Note over W: 1. Rate limit (15s)
    W->>DO: fetch /messages/recent (HMAC)
    Note over DO: sessionId stripped
    DO-->>W: {messages: [50]}

    W->>AI: env.AI.run(model, prompt)
    Note over AI: Qwen inference (8s timeout)
    AI-->>W: {response}

    W->>DO: /broadcast-summary (HMAC)
    Note over DO: type:'summary'<br/>broadcast to all sessions
    DO-->>C: WS: {type:'summary', text}
```

### 5. Push Notifications (offline users)

```mermaid
sequenceDiagram
    participant DO as ChatRoom DO
    participant PH as Push Handler
    participant KV as KV
    participant VAPID as Web Push
    participant FCM as FCM v1

    Note over DO: after message broadcast<br/>throttledPushNotification
    DO->>PH: 1. throttledPushNotification

    PH->>KV: 2. KV.list() (iterate subscribers)
    PH->>PH: 3. sendPushToOfflineUsers
    PH->>PH: 4. exclude onlineSessionIds

    alt VAPID
        PH->>VAPID: ECDH + aes128gcm
        VAPID-->>PH: ok
    else FCM
        PH->>PH: getFCMAccessToken
        PH->>FCM: send FCM v1
        FCM-->>PH: ok
    end

    Note over PH: 5. 404/410 → KV cleanup
```

---

## Security Boundaries

### Authentication Token Types

| Type | Format | Location | Characteristics |
|---|---|---|---|
| **Admin token** | opaque 32-byte random value (KV `token:<t>`) | `auth.js` | 12-hour sliding TTL, KV revoked on logout, automatic logout on 401 |
| **Observer ticket** | `HMAC(observer:<sessionId>:<ts>)` | `handlers/admin.js` + `handlers/turnstile.js` | `POST /api/admin/observer-ticket` issues with a 5-minute TTL, verified by `/ws` (admin token not exposed in the URL) |
| **Internal token** | `X-Admin-Internal-Token` | `worker.js` ↔ DO | SSRF prevention |
| **Message signature (Ephemeral Token)** | `HMAC(sessionSecret, JSON.stringify({content, sessionId, timestamp}))` | `ChatRoom.js` + `signature.js` | 32-byte per-session secret + capability key (rotated on re-entry), authorId (16hex) replaces sessionId, ±30-second freshness, discarded on close/4401 |

### Rate Limiting

| Layer | Location | Rule |
|---|---|---|
| **Global** | `src/utils/rate-limiter.js` | per-worker in-memory, 5-minute cleanup |
| **Per-endpoint** | `API_RATE_LIMIT` constants | metrics, health, config, turnstile, upload, push, check-ban, logs/error, preview, summary, secret-store/read, announcements/emergency, channels, search, vapid, ws |
| **Admin API** | `src/worker.js` (`API_RATE_LIMIT.ADMIN`) | `/api/admin/*` 120 requests/minute per IP |
| **Per-user** | ChatRoom | 1-second cooldown, 30/minute sliding window (reactions 3s, typing start 2s throttle) |
| **Admin login** | `checkRateLimit`/`incrementRateLimit` | blocked after 5 attempts/5 minutes |

### Input Validation

| Input | Function | Rule |
|---|---|---|
| Message | `validateClientMessage` | branches by type |
| Dead Drop | `validateDeadDropMessage` | ≤10,000 characters |
| Channel name | `validateChannelName` | ≤20 characters, trim |
| Nickname | `validateNickname` | ≤12 characters, trim |
| sessionId | `validateSessionId` | `[a-zA-Z0-9_-]{1,200}` |
| File | `validateFileInfo` | url/filename/filetype lengths |
| Strings | `sanitizeInput` | strip control characters + normalize line breaks |

### Data Retention

| Data | Retention | Auto-deletion |
|---|---|---|
| Messages | 12 hours (memory + DO Storage) | ✅ (5-minute cleanup) |
| Announcements | permanent, history max 100 (memory + DO Storage) | manual |
| Dead Drop | 30-minute TTL, deleted after a single read | ✅ TTL + DO alarm |
| Audit logs | D1 (audit_logs, 90 days) | ✅ periodic forced sweep (1 in 10) + probabilistic |
| Admin logs | D1 (admin_activity_logs, 30 days) | ✅ periodic forced sweep (1 in 10) + probabilistic |
| Error logs | D1 (error_logs, 30 days) | ✅ periodic forced sweep (1 in 10) + probabilistic |
| Security events | D1 (security_events, 90-day retention) | ✅ periodic forced sweep (1 in 10) + probabilistic |
| Push subscriptions | 30-day TTL (KV) | ✅ TTL |
| Bans | expire according to the time setting (permanent option) | ✅ on expiry |
| Session capability keys | KV (30-minute TTL, max 500) | ✅ TTL (keys for connected sessions are excluded from eviction) |

---

## Build Pipeline

```mermaid
flowchart LR
    subgraph Server["Server"]
        Worker1[src/worker.js<br/>ESM]
        Worker1 --> Runtime[Cloudflare Workers<br/>+ Static Assets (public/)]
    end

    subgraph Client["Client"]
        Chat[public/js/chat.js<br/>+ 30 source modules + 6 page wrappers]
        Admin[public/js/admin-core.js / admin-ui.js / admin-main.js<br/>+ security-center.js + 6 pages]
        TailwindB[tailwind build<br/>45KB]

        Chat -->|esbuild| ChatBundle[chat.bundle.js]
        Admin -->|esbuild| AdminCore[admin-core.bundle.js]
        Admin -->|esbuild| AdminPages[admin-*.bundle.js<br/>+ security-center.bundle.js<br/>10 bundles total]
        Tailwind -.->|replacement| TailwindB
    end
```

**Client Bundle Note**: Prism.js is bundled locally through the `code-highlight.js` entry and does not use a CDN script (`_headers` CSP keeps `script-src 'self'`).

---

## Performance Characteristics

| Metric | Result |
|---|---|
| Message history loading | 100 messages, 500ms → **20ms** (25x, DocumentFragment) |
| Event listeners | 5-6 per message → 5 on the container (delegation) |
| Tailwind | 300KB CDN → **45KB** build |
| Bundles | 19 modules → **10** (chat, admin-core, admin-main, 6 admin pages, security-center) |
| WS Reconnect | exponential backoff, max 10 attempts/30s |
| AI Timeout | 8 seconds + 15-second rate limit |
| OG Cache | 1-hour edge + 50-client memory |
| Push Throttle | 1.5 seconds (debounce) |

---

## Extension Points

| Target | Location | Procedure |
|---|---|---|
| New DO | `src/durable-objects/` | register in `wrangler.toml` `[[durable_objects.bindings]]` |
| New route | `worker.js` | add to the `routes` array |
| New handler | `src/handlers/` | add a module, import it in `worker.js` |
| New constants | `src/config/constants.js` | shared server + client |
| New theme | `themes.css` | add CSS Custom Properties, add to the `theme.js` `THEMES` array |
| New mixin | `public/js/ui-*.js` | attach via `Object.assign` at the end of `ui.js` |
