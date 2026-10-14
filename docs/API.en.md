> 🌐 **English** | [한국어](./API.md)

> ℹ️ This is an English translation of [API.md](./API.md). The Korean version is canonical and may be more up to date.

# API Specification

Specification for the 54 HTTP endpoints. All responses include CORS headers (`src/config/cors.js`).

**Base URL**: `https://kalpha.mmv.kr` (production) | `http://localhost:8788` (development)

---

## Table of Contents

- [Overview](#overview)
- [1. Public Endpoints](#1-public-endpoints-22)
  - [1.1 WebSocket](#11-websocket)
  - [1.2 Chat Data](#12-chat-data)
  - [1.3 Links/Files](#13-linksfiles)
  - [1.4 Channels (Unauthenticated)](#14-channels-unauthenticated)
  - [1.5 Secret Messages (Dead Drop)](#15-secret-messages-dead-drop)
  - [1.6 Push Notifications](#16-push-notifications)
  - [1.7 Security](#17-security)
  - [1.8 System](#18-system)
- [2. Admin Endpoints](#2-admin-endpoints-32-bearer-auth)
  - [2.1 Authentication](#21-authentication)
  - [2.2 Metrics/Sessions/Messages](#22-metricssessionsmessages)
  - [2.3 Message Management](#23-message-management)
  - [2.4 User Banning](#24-user-banning)
  - [2.5 Announcements](#25-announcements)
  - [2.6 Channel Management](#26-channel-management)
  - [2.7 Logs](#27-logs)
  - [2.8 Security Events](#28-security-events)
- [3. WebSocket Message Protocol](#3-websocket-message-protocol)
- [4. Error Response Format](#4-error-response-format)
- [5. Rate Limit Constants](#5-rate-limit-constants)

---

## Overview

| Item | Value |
|---|---|
| Total endpoints | 54 (22 public + 32 admin) |
| Authentication | Public: none / Admin: Bearer token |
| Data format | JSON (multipart only for `/api/upload`) |
| CORS | Included in all responses (`src/config/cors.js`) |
| Auth token TTL | 12-hour sliding (auto-extended when under 1 hour remains, KV revocation supported) |

### Endpoint Categories

| Category | Count | Notes |
|---|---|---|
| WebSocket | 1 | `/ws` |
| Chat data | 4 | announcement, search, summary, emergency announcement |
| Links/files | 3 | OG preview, upload, download |
| Channels (unauthenticated) | 3 | create, join, list |
| Secret messages | 2 | Dead Drop store/read |
| Push notifications | 3 | VAPID key, subscribe, unsubscribe |
| Security | 2 | Turnstile verification, ban check |
| System | 4 | metrics, health, error log, config |
| Admin auth | 4 | login, verify, logout, observer-ticket |
| Admin data | 4 | metrics, sessions, messages, user-details |
| Admin messages | 4 | broadcast, edit, delete, delete-all |
| Admin bans | 3 | kick-user, unban-ip, banned-ips |
| Admin announcements | 1 | announce (POST/PUT/DELETE) |
| Admin channels | 3 | channels, details, delete |
| Admin logs | 5 | logs, delete-logs, audit-logs, delete-audit-logs, delete-error-logs |
| Admin security | 8 | security/events, stats, risk-ips, events/export, events/clear, badge, block-ip, events/:id (dynamic) |

---

## 1. Public Endpoints (22)

### 1.1 WebSocket

#### `GET /ws`
WebSocket upgrade endpoint.

**Query**:
- `sessionId` (required) — `user_<uuid>_<ts>` format (admin observers use `admin_obs_<16hex>`)
- `channel` (optional) — channel slug (defaults to the main room when omitted)
- `ticket` (required) — HMAC ticket (valid for 2 hours, bound to `sessionId`). Issued by `POST /api/turnstile/verify` for regular sessions and by `POST /api/admin/observer-ticket` for admin observers

**Headers**:
- `Origin` — required. Missing/disallowed Origin returns `403` (fail-closed)
- `Upgrade`, `Connection` — standard WebSocket headers

**Note**:
- `/api/check-ban` is called first for a proactive ban check
- Internally passes `X-Admin-Internal-Token` (HMAC_SECRET) and `X-Ws-Session-Id` headers to the DO
- `admin_obs_*` sessions are verified with the observer ticket instead of the admin token in the URL; failures are rejected with `401`
- If the `join` `sessionId` differs from the value bound to the ticket, the connection closes with `close 4401 (Session mismatch)`

**Message protocol**: [ARCHITECTURE.en.md §ChatRoom Durable Object](./ARCHITECTURE.en.md#2-chatroom-durable-object-srcdurable-objectschatroomjs-1642-lines)

---

### 1.2 Chat Data

#### `GET /api/announcements`
Announcement history (unauthenticated).

**Response 200** (bare array):
```json
[
  {
    "content": "서버 점검 안내",
    "timestamp": 1717890123000,
    "isEmergency": false,
    "emergencyUntil": null
  }
]
```
Announcements persist until manually deleted (no automatic expiry).

#### `GET /api/emergency-announcement`
The single currently active emergency announcement.

**Response 200** (active):
```json
{
  "isEmergency": true,
  "content": "긴급 점검 중",
  "timestamp": 1717890123000,
  "emergencyUntil": 1717893723000
}
```

**Response 200** (no emergency announcement):
```json
{ "isEmergency": false }
```

#### `GET /api/search`
Search messages from the last 12 hours.

**Query**:
- `q` (required) — search terms (space-separated, AND matching)
- `limit` (optional, default 50, max 100)
- `tags` (optional) — `#images`, `#files`, `#code`, `#url` (comma-separated)

**Response 200**:
```json
{
  "results": [
    {
      "id": "msg_...",
      "content": "검색된 메시지",
      "nickname": "익명",
      "createdAt": 1717890123000,
      "tags": ["code"]
    }
  ],
  "total": 12
}
```

#### `POST /api/summary`
Summarize the 50 most recent messages with Workers AI.

**Body**:
```json
{
  "mode": "default" | "topic" | "mood" | "conflict",
  "channel": "kalpha"
}
```
- `mode` (optional, default `default`)
- `channel` (optional) — channel slug (defaults to the main room when omitted, format validated)

**Response 204**: No body — the result is broadcast to that session via a WebSocket `type:'summary'` message.

**Errors**:
- `429`: rate limit (once per 15 seconds)
- `502`: message fetch/parse failure in the DO
- `504`: AI response 8-second timeout
- `503`: temporary AI model failure (failed after fallback attempt)

---

### 1.3 Links/Files

#### `POST /api/preview`
Generate a URL OG tag preview.

**Body**:
```json
{ "url": "https://example.com" }
```

**Response 200**:
```json
{
  "url": "https://example.com",
  "title": "Example Domain",
  "description": "...",
  "image": "https://example.com/og.png",
  "siteName": "Example"
}
```

**Errors**:
- `400`: invalid URL format
- `429`: Rate limit (5 per 10 seconds)
- `504`: 5-second timeout

**Cache**: Cloudflare Edge 1 hour + client memory 50 entries

#### `POST /api/upload`
File upload (Worker proxy → Kalpha API).

**Body**: `multipart/form-data`, max 100MB

**Response 200**:
```json
{
  "full_url": "https://file.kalpha.kr/files/abc123.png",
  "filename": "image.png",
  "filesize": 102400,
  "filetype": "image/png"
}
```

#### `GET /api/file/{id}`
Kalpha file download proxy.

**Path**:
- `id` — Kalpha file ID

**Response 200**: file binary (Content-Type set automatically)

---

### 1.4 Channels (Unauthenticated)

#### `POST /api/channels/create`
Create a new channel.

**Body**:
```json
{ "name": "kalpha" }
```

**Response 200**:
```json
{ "success": true, "slug": "kalpha", "name": "kalpha" }
```

**Errors**:
- `400`: name length (>20), format error
- `409`: a channel with the same name already exists

#### `POST /api/channels/join`
Update the channel lastActive.

**Body**:
```json
{ "slug": "kalpha" }
```

**Response 200**:
```json
{ "success": true }
```

#### `GET /api/channels/list`
Active channel list (metadata only).

**Response 200**:
```json
{
  "channels": [
    { "slug": "kalpha", "name": "kalpha", "createdAt": 1717890123, "lastActive": 1717893723, "activeConnections": 5, "totalMessages": 234 }
  ]
}
```

---

### 1.5 Secret Messages (Dead Drop)

#### `POST /api/secret-store`
Store a secret message (30-minute TTL, single read).

**Body**:
```json
{ "message": "최대 10000자" }
```

**Response 200**:
```json
{ "id": "secret_abc123" }
```

#### `GET /api/secret-read?id={id}`
Read the secret message once.

**Response 200**:
```json
{ "message": "..." }
```

**Errors**:
- `410`: expired (TTL elapsed)
- `404`: not found or already read (single-use)

---

### 1.6 Push Notifications

#### `GET /api/push/vapid-key`
VAPID public key (for Web Push subscriptions).

**Response 200**:
```json
{ "publicKey": "BPdJ..." }
```

#### `POST /api/push/subscribe`
Register a push subscription.

**Body (Web Push)**:
```json
{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/...",
    "keys": { "p256dh": "...", "auth": "..." }
  },
  "sessionId": "user_...",
  "isFcmToken": false,
  "key": "<capability key (WS handshake에서 발급)>"
}
```

**Body (FCM)**:
```json
{ "subscription": "fcm_token_string", "isFcmToken": true, "sessionId": "user_...", "key": "<capability key>" }
```

**Errors**:
- `401`: session verification failed (`key` missing/mismatched)
- `404`: on resubscribe (`type: 'resubscribe'`), no stored subscription with the same endpoint (`Subscription not found`)

**Response 200**:
```json
{ "success": true }
```

#### `POST /api/push/unsubscribe`
Unsubscribe from push.

**Body**:
```json
{ "sessionId": "user_...", "key": "<capability key>" }
```

**Errors**:
- `401`: session verification failed

**Response 200**:
```json
{ "success": true }
```

---

### 1.7 Security

#### `POST /api/turnstile/verify`
Verify a Cloudflare Turnstile token and issue a ticket for WebSocket.

**Body**:
```json
{ "token": "...", "sessionId": "user_..." }
```
- `sessionId` — session ID to bind the ticket to (string; signed as an empty value if absent)

**Response 200** (success):
```json
{ "success": true, "ticket": "<HMAC 티켓, 2시간 유효, sessionId 바인딩>" }
```
> If `HMAC_SECRET` is not set, `ticket` is omitted.
> The ticket is bound to the requested `sessionId`; if the `/ws` `join.sessionId` differs, it is rejected with `close 4401`.

**Response 200** (verification failed):
```json
{ "success": false, "error": "Verification failed", "errorCodes": ["invalid-input-response"] }
```

**Response 400**: `token` missing or exceeding 2048 characters

**Response 500**: `TURNSTILE_SECRET_KEY` not set or internal error

#### `GET /api/check-ban?sessionId=...&ip=...`
Proactive ban status check.

**Response 200**:
```json
{ "banned": false }
```

**Response 200 (banned)**:
```json
{ "banned": true, "remainingSeconds": 300, "message": "..." }
```

---

### 1.8 System

#### `GET /metrics`
Server metrics (unauthenticated, for internal monitoring).

**Response 200**:
```json
{
  "timestamp": 1717890123,
  "activeConnections": 12,
  "totalMessages": 12345
}
```

#### `GET /health`
Liveness probe.

**Response 200**:
```json
{ "status": "healthy" }
```

#### `POST /api/logs/error`
Collect client/server errors (Worker entry point).

**Body**:
```json
{
  "type": "TypeError",
  "message": "...",
  "stack": "...",
  "location": "chat.js:123",
  "context": { "url": "...", "userAgent": "..." }
}
```

**Response 200**:
```json
{ "logged": true }
```

#### `GET /api/config`
Public configuration.

**Response 200**:
```json
{
  "turnstileSiteKey": "0x4AAA...",
  "fileUploadUrl": "https://file.kalpha.kr/api/files",
  "kalphaApiUrl": "https://api.kalpha.kr"
}
```

---

## 2. Admin Endpoints (32, Bearer Auth)

All `/api/admin/*` endpoints require the `Authorization: Bearer <token>` header (except `login`). Allowed methods are declared explicitly per route (`announce`: POST/PUT/DELETE, `observer-ticket`: POST, a single method for the rest).

**Auth flow**:
1. `POST /api/admin/login` → issues a token (stored in KV at `token:<t>` with a 12-hour sliding TTL)
2. Subsequent requests use the `Authorization: Bearer <token>` header
3. On each request, if the remaining TTL is under 1 hour it is extended automatically; `logout` deletes (revokes) the token from KV immediately
4. Expired/invalid tokens return `401` → the client logs out automatically

### 2.1 Authentication

#### `POST /api/admin/login`
**No auth required**

**Body**:
```json
{ "id": "admin", "password": "..." }
```

**Response 200**:
```json
{ "success": true, "token": "..." }
```

**Errors**:
- `400`: format error (e.g. JSON parse failure) — counts toward the failure count
- `401`: invalid credentials
- `429`: blocked after 5 failures within 5 minutes (including format errors)
- `503`: `ADMIN_ID`/`ADMIN_PASSWORD` not set

#### `GET /api/admin/verify`
**Auth required**

**Response 200**:
```json
{ "valid": true }
```

#### `POST /api/admin/logout`
**Auth required** (revokes that token = deletes it from KV)

**Headers**:
- `Authorization: Bearer <token>` (the token to revoke)

**Response 200**:
```json
{ "success": true }
```

#### `POST /api/admin/observer-ticket`
**Auth required** — issues a short-lived ticket for the admin observer WebSocket.

**Response 200**:
```json
{
  "sessionId": "admin_obs_<16hex>",
  "ticket": "<HMAC 티켓, 5분 유효>",
  "expiresIn": 300
}
```

**Note**:
- Connect to `/ws?sessionId=<issued>&ticket=<issued>` with the issued `sessionId` + `ticket` (the admin token is not included in the URL)
- `ticket` is valid only for the issued `sessionId` and expires after 5 minutes

---

### 2.2 Metrics/Sessions/Messages

#### `GET /api/admin/metrics`
**Auth required**

**Response 200**:
```json
{
  "activeConnections": 12,
  "totalMessages": 12345,
  "totalConnections": 67890,
  "errors": 3,
  "bannedIPs": 2
}
```

#### `GET /api/admin/sessions`
**Auth required**

**Response 200**:
```json
{
  "sessions": [
    {
      "sessionId": "user_...",
      "nickname": "익명",
      "ip": "1.2.3.4",
      "country": "KR",
      "userAgent": "...",
      "connectedAt": 1717890123,
      "lastActive": 1717893723,
      "isOnline": true
    }
  ]
}
```

#### `GET /api/admin/messages`
**Auth required**

**Query**:
- `limit` (default 50)

**Response 200**:
```json
{
  "messages": [
    {
      "id": "msg_...",
      "content": "...",
      "nickname": "익명",
      "sessionId": "user_...",
      "ip": "1.2.3.4",
      "createdAt": 1717890123,
      "edited": false,
      "deleted": false
    }
  ]
}
```

#### `GET /api/admin/user-details?sessionId=...`
**Auth required**

**Response 200**:
```json
{
  "sessionId": "user_...",
  "nickname": "익명",
  "ip": "1.2.3.4",
  "country": "KR",
  "userAgent": "...",
  "connectedAt": 1717890123,
  "messageCount": 42,
  "reactionCount": 5
}
```

---

### 2.3 Message Management

#### `POST /api/admin/broadcast`
**Auth required**

**Body**:
```json
{ "content": "관리자 공지 (최대 7500자)" }
```

**Response 200**:
```json
{ "messageId": "msg_..." }
```

#### `POST /api/admin/edit-message`
**Auth required**

**Body**:
```json
{ "messageId": "msg_...", "content": "수정 내용" }
```

**Response 200**:
```json
{ "success": true }
```

#### `POST /api/admin/delete-message`
**Auth required**

**Body**:
```json
{ "messageId": "msg_..." }
```

**Response 200**:
```json
{ "success": true }
```

#### `POST /api/admin/delete-all-messages`
**Auth required**

**Response 200**:
```json
{ "success": true, "deletedCount": 1234 }
```

---

### 2.4 User Banning

#### `POST /api/admin/kick-user`
**Auth required**

**Body**:
```json
{
  "sessionId": "user_...",
  "banDuration": 300,
  "reason": "스팸"
}
```

**`banDuration` values**:
- `0` — immediate kick without a ban
- positive N — ban for N seconds (session + ban token, and the IP as well unless it is a shared IP)

**Response 200**:
```json
{
  "success": true,
  "banned": true,
  "banDuration": 300,
  "ip": "1.2.3.4",
  "sharedIP": false,
  "banType": "ip_and_session",
  "token": "<ban token>"
}
```
- When `sharedIP: true`, `banType` is `"session_only"` (protects other users on the same IP)

#### `POST /api/admin/unban-ip`
**Auth required**

**Body** (at least one required):
```json
{ "ip": "1.2.3.4" }
{ "sessionId": "user_..." }
{ "token": "<ban token>" }
```

**Response 200**:
```json
{ "success": true, "unbanIp": true, "unbanSession": false, "unbanToken": false }
```

**Response 400**: all of `ip`/`sessionId`/`token` missing

#### `GET /api/admin/banned-ips`
**Auth required**

**Response 200**:
```json
{
  "ips": [
    { "ip": "1.2.3.4", "bannedUntil": 1717893723000, "remainingSeconds": 300, "reason": "...", "bannedAt": 1717890123000 }
  ],
  "sessions": [
    { "sessionId": "user_...", "ip": "1.2.3.4", "bannedUntil": 1717893723000, "remainingSeconds": 300, "reason": "...", "bannedAt": 1717890123000 }
  ],
  "tokens": [
    { "token": "<ban token>", "ip": "1.2.3.4", "bannedUntil": 1717893723000, "remainingSeconds": 300, "reason": "..." }
  ]
}
```

---

### 2.5 Announcements

#### `POST /api/admin/announce` (POST/PUT/DELETE)
**Auth required**

**POST Body** (create):
```json
{
  "content": "공지 내용",
  "isEmergency": false,
  "emergencyUntil": 1717893723000,
  "scheduleAt": 1717890123000
}
```
> `expiresAt` is no longer supported — announcements persist until manually deleted.

**PUT Body** (update; the announcement is identified by the `timestamp` key):
```json
{
  "timestamp": 1717890123000,
  "content": "수정된 공지",
  "isEmergency": false,
  "emergencyUntil": null
}
```

**DELETE Body** (delete; the announcement is identified by the `timestamp` key):
```json
{ "timestamp": 1717890123000 }
```

**Response 200** (POST):
```json
{ "success": true, "sessionsNotified": 12 }
```

**Response 200** (PUT/DELETE):
```json
{ "success": true }
```

**Errors**:
- `400`: `content` missing (POST) / `timestamp` missing (PUT·DELETE)
- `404`: no announcement with that `timestamp` (PUT·DELETE)

---

### 2.6 Channel Management

#### `GET /api/admin/channels`
**Auth required**

**Response 200**: `GET /api/channels/list` + connection count/message count (live)

#### `GET /api/admin/channel-details?slug=...`
**Auth required**

**Response 200**:
```json
{
  "slug": "kalpha",
  "name": "kalpha",
  "metrics": { "activeConnections": 5, "totalMessages": 234 },
  "sessions": [...],
  "recentMessages": [...20개]
}
```

#### `POST /api/admin/channel-delete`
**Auth required**

**Body**:
```json
{ "slug": "kalpha", "confirmation": "FORCE_DELETE_CHANNEL" }
```

**Response 200**:
```json
{ "success": true }
```

**Note**: The main room (`'0'`) cannot be deleted.

---

### 2.7 Logs

#### `GET /api/admin/logs`
**Auth required** — admin activity logs (D1, 100 entries)

**Response 200**:
```json
{
  "logs": [
    { "id": 1, "type": "login_success", "ip": "1.2.3.4", "timestamp": 1717890123, "data": {...} }
  ]
}
```

#### `POST /api/admin/delete-logs`
**Auth required**

**Response 200**:
```json
{ "success": true, "deletedCount": 100 }
```

#### `GET /api/admin/audit-logs`
**Auth required**

**Query**:
- `filter` (optional, default `all`) — `kick_user`, `edit_message`, `delete_message`, `admin_delete_message`, `send_announcement`, `unban_ip`, `BAN_IP`, `UNBAN_IP`, `admin_delete_all_messages`, `edit_announcement`, `delete_announcement`, `channel_delete`

**Response 200** (bare array):
```json
[
  { "type": "kick_user", "action": "kick_user", "description": "...", "details": "...", "ip": "1.2.3.4", "admin_ip": "1.2.3.4", "timestamp": 1717890123 }
]
```

#### `POST /api/admin/delete-audit-logs`
**Auth required**

**Response 200**:
```json
{ "success": true, "deletedCount": 50 }
```

#### `POST /api/admin/delete-error-logs`
**Auth required** — delete all error logs (D1 `error_logs` + DO memory)

**Note**: `POST` only. Other methods return `405`.

**Response 200**:
```json
{ "success": true }
```

---

### 2.8 Security Events

#### 2.8.1 List Events

`GET /api/admin/security/events?page=1&limit=50&category=auth&severity=high&search=&ip=`

**Query Params**:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | number | `1` | Page number (1-based) |
| `limit` | number | `50` | Items per page |
| `category` | string | `""` | Filter: `auth`, `endpoint`, `input`, `websocket`, `system` |
| `severity` | string | `""` | Filter: `low`, `medium`, `high`, `critical` |
| `search` | string | `""` | Text search on event type |
| `ip` | string | `""` | IP address search |

**Response 200**:
```json
{
  "events": [
    {
      "id": 1,
      "event_type": "LOGIN_FAIL",
      "category": "auth",
      "severity": "high",
      "severity_score": 60,
      "ip": "203.0.113.42",
      "path": "/api/admin/login",
      "method": "POST",
      "user_agent": "Mozilla/5.0...",
      "country": "KR",
      "session_id": null,
      "details": "Invalid credentials",
      "metadata": null,
      "timestamp": 1717890123000
    }
  ],
  "total": 42,
  "page": 1
}
```

#### 2.8.2 24-Hour Stats

`GET /api/admin/security/stats`

**Response 200**:
```json
{
  "last24h": 128,
  "byCategory": [
    { "category": "auth", "count": 45 },
    { "category": "input", "count": 32 }
  ],
  "bySeverity": [
    { "severity": "high", "count": 23 },
    { "severity": "medium", "count": 67 }
  ]
}
```

#### 2.8.3 Risk IP List

`GET /api/admin/security/risk-ips`

**Response 200**:
```json
{
  "riskIPs": [
    { "ip": "203.0.113.42", "score": 85.5, "eventCount": 23 },
    { "ip": "198.51.100.7", "score": 62.0, "eventCount": 15 }
  ]
}
```

#### 2.8.4 Event Details

`GET /api/admin/security/events/:id`

> The route exists but is not used by the admin UI.

**Response 200**: a single event + the 5 most recent events from the same IP

```json
{
  "event": { "id": 1, ... },
  "relatedEvents": [{ "id": 2, ... }, { "id": 5, ... }]
}
```

**Response 404**: unknown event ID

#### 2.8.5 Delete Events Older Than 90 Days

`POST /api/admin/security/events/clear`

**Response 200**:
```json
{ "success": true, "deleted": 15 }
```

#### 2.8.6 CSV Export

`GET /api/admin/security/events/export?category=auth`

**Response 200**: `text/csv` BLOB download

#### 2.8.7 Badge Counts

`GET /api/admin/security/badge`

**Response 200**:
```json
{ "critical": 3, "high": 8, "medium": 21 }
```

#### 2.8.8 Block Risk IP

`POST /api/admin/security/block-ip`

**Request Body**:
```json
{ "ip": "203.0.113.42" }
```

**Response 200**:
```json
{ "success": true, "ip": "203.0.113.42", "bannedUntil": 1717976523000, "duration": 86400 }
```

**Note**: registered in the main room DO's ban list for 24 hours (86400 seconds) by default (up to 7 days when `duration` is specified).

---

## 3. WebSocket Message Protocol

### 3.0 Handshake (Ephemeral Token)

After receiving `join`, the server issues a 32-byte ephemeral secret per session plus a capability key for reconnection, delivered to the client once. The client keeps this secret in memory and uses it to sign `message`/`edit` sends with HMAC-SHA256. The secret is discarded immediately when the WebSocket `close`s.

```json
{ "type": "handshake", "secret": "<64 hex chars>", "key": "<session capability key>", "authorId": "<작성자 식별자>" }
```

### 3.1 Client → Server (inbound)

```typescript
type ClientMessage =
  | { type: 'ping' }
  | { type: 'join'; sessionId: string; key?: string; isReconnect?: boolean; nickname?: string }
  | { type: 'message'; content: string; sessionId: string; timestamp: number; signature: string }
  | { type: 'edit'; messageId: string; newContent: string; sessionId: string; timestamp: number; signature: string }
  | { type: 'delete'; messageId: string }
  | { type: 'reaction'; messageId: string; emoji: string }
  | { type: 'typing'; isTyping: boolean };
```

- The `join` `key` is required on reconnect. If it does not match the `key` received in the handshake, the connection closes with `close 4401 (Invalid session key)`.
- A `join.sessionId` that differs from the session ID bound to the ticket is rejected with `close 4401 (Session mismatch)`.
- The `signature` on `message`/`edit` is **required** (strengthened 2026-06-22).
  - Generated automatically by the client (`public/js/signature.js`) from `handshake.secret`
  - If missing or mismatched, the message is rejected + a `WS_INVALID_MSG` security event is recorded
  - `timestamp` must be within ±30 seconds of the current time
- Signature payload:
  - `message`: `HMAC-SHA256(sessionSecret, JSON.stringify({content, sessionId, timestamp}))`
  - `edit`: `HMAC-SHA256(sessionSecret, JSON.stringify({content: newContent, sessionId, timestamp}))`

### 3.2 Server → Client (outbound)

```typescript
type ServerMessage =
  | { type: 'pong' }
  | { type: 'handshake'; secret: string; key: string; authorId: string }   // join 직후 1회
  | { type: 'banned'; permanent: boolean; message?: string }
  | { type: 'history'; messages: StoredMessage[] }
  | { type: 'announcement'; announcement: Announcement }
  | { type: 'emergency_cleared' }
  | { type: 'system'; content: string }
  | { type: 'error'; message: string }
  | { type: 'message'; message: StoredMessage; signature: string }
  | { type: 'message_edited'; message: StoredMessage }
  | { type: 'message_deleted'; messageId: string }
  | { type: 'message_reaction'; messageId: string; emoji: string; count: number; reacted: boolean }
  | { type: 'typing'; authorId: string; nickname: string; typing: boolean }
  | { type: 'user_count'; count: number }
  | { type: 'summary'; text: string; mode: string; messageId: string }
  | { type: 'kicked'; message: string }
  | { type: 'all_messages_deleted'; count: number };
```

Detailed type definitions: `src/schema.js`

> Live broadcasts (`message`/`message_edited`/`message_reaction`/`typing`) do not include `sessionId` (they use `authorId`). History is also keyed by `authorId`.

---

## 4. Error Response Format

All JSON errors follow this format (`src/utils/errors.js`):
```json
{ "error": "에러 메시지" }
```

**Status codes**:
- `200` — Success
- `204` — Success (no body)
- `400` — Bad request
- `401` — Authentication required/failed
- `403` — Forbidden
- `404` — Resource not found
- `409` — Conflict (duplicate, etc.)
- `410` — Gone (Dead Drop, etc.)
- `429` — Rate Limit
- `500` — Server error
- `503` — Temporary outage
- `504` — Timeout

---

## 5. Rate Limit Constants

| Endpoint | Window | Max |
|---|---|---|
| `/metrics` | 60s | 30 |
| `/health` | 60s | 30 |
| `/api/config` | 60s | 10 |
| `/api/turnstile/verify` | 10s | 5 |
| `/api/upload` | 60s | 10 |
| `/api/push/subscribe`, `/api/push/unsubscribe` | 60s | 10 |
| `/api/push/vapid-key` | 60s | 30 |
| `/api/check-ban` | 10s | 10 |
| `/api/secret-store` | 10s | 10 |
| `/api/secret-read` | 10s | 10 |
| `/api/logs/error` | 10s | 10 |
| `/api/preview` | 10s | 5 |
| `/api/summary` | 15s | 1 |
| `/api/announcements`, `/api/emergency-announcement` | 60s | 60 |
| `/api/channels/*` | 60s | 30 |
| `/api/search` | 60s | 20 |
| `/ws` (connection) | 60s | 30 |
| Messages (WS) | 1s cooldown | 30 per minute, sliding |
| `/api/admin/*` | 60s | 120 (per IP) |
| Admin login | 5min | blocked after 5 failures |

Constants location: `src/config/constants.js`
