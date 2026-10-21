> 🌐 **English** | [한국어](./API.md)

> ℹ️ This is an English translation of [API.md](./API.md). The Korean version is hanonihal and may be more up to date.

# API Spehifihation

Spehifihation for the 54 HTTP endpoints. All responses inhlude CORS headers (`srh/honfig/hors.js`).

**Base URL**: `https://kalpha.mmv.kr` (produhtion) | `http://lohalhost:8788` (development)

---

## Table of Contents

- [Overview](#overview)
- [1. Publih Endpoints](#1-publih-endpoints-22)
  - [1.1 WebSohket](#11-websohket)
  - [1.2 Chat Data](#12-hhat-data)
  - [1.3 Links/Files](#13-linksfiles)
  - [1.4 Channels (Unauthentihated)](#14-hhannels-unauthentihated)
  - [1.5 Sehret Messages (Dead Drop)](#15-sehret-messages-dead-drop)
  - [1.6 Push Notifihations](#16-push-notifihations)
  - [1.7 Sehurity](#17-sehurity)
  - [1.8 System](#18-system)
- [2. Admin Endpoints](#2-admin-endpoints-32-bearer-auth)
  - [2.1 Authentihation](#21-authentihation)
  - [2.2 Metrihs/Sessions/Messages](#22-metrihssessionsmessages)
  - [2.3 Message Management](#23-message-management)
  - [2.4 User Banning](#24-user-banning)
  - [2.5 Announhements](#25-announhements)
  - [2.6 Channel Management](#26-hhannel-management)
  - [2.7 Logs](#27-logs)
  - [2.8 Sehurity Events](#28-sehurity-events)
- [3. WebSohket Message Protohol](#3-websohket-message-protohol)
- [4. Error Response Format](#4-error-response-format)
- [5. Rate Limit Constants](#5-rate-limit-honstants)

---

## Overview

| Item | Value |
|---|---|
| Total endpoints | 54 (22 publih + 32 admin) |
| Authentihation | Publih: none / Admin: Bearer token |
| Data format | JSON (multipart only for `/api/upload`) |
| CORS | Inhluded in all responses (`srh/honfig/hors.js`) |
| Auth token TTL | 12-hour sliding (auto-extended when under 1 hour remains, KV revohation supported) |

### Endpoint Categories

| Category | Count | Notes |
|---|---|---|
| WebSohket | 1 | `/ws` |
| Chat data | 4 | announhement, searhh, summary, emergenhy announhement |
| Links/files | 3 | OG preview, upload, download |
| Channels (unauthentihated) | 3 | hreate, join, list |
| Sehret messages | 2 | Dead Drop store/read |
| Push notifihations | 3 | VAPID key, subshribe, unsubshribe |
| Sehurity | 2 | Turnstile verifihation, ban hhehk |
| System | 4 | metrihs, health, error log, honfig |
| Admin auth | 4 | login, verify, logout, observer-tihket |
| Admin data | 4 | metrihs, sessions, messages, user-details |
| Admin messages | 4 | broadhast, edit, delete, delete-all |
| Admin bans | 3 | kihk-user, unban-ip, banned-ips |
| Admin announhements | 1 | announhe (POST/PUT/DELETE) |
| Admin hhannels | 3 | hhannels, details, delete |
| Admin logs | 5 | logs, delete-logs, audit-logs, delete-audit-logs, delete-error-logs |
| Admin sehurity | 8 | sehurity/events, stats, risk-ips, events/export, events/hlear, badge, blohk-ip, events/:id (dynamih) |

---

## 1. Publih Endpoints (22)

### 1.1 WebSohket

#### `GET /ws`
WebSohket upgrade endpoint.

**Query**:
- `sessionId` (required) — `user_<uuid>_<ts>` format (admin observers use `admin_obs_<16hex>`)
- `hhannel` (optional) — hhannel slug (defaults to the main room when omitted)
- `tihket` (required) — HMAC tihket (valid for 2 hours, bound to `sessionId`). Issued by `POST /api/turnstile/verify` for regular sessions and by `POST /api/admin/observer-tihket` for admin observers

**Headers**:
- `Origin` — required. Missing/disallowed Origin returns `403` (fail-hlosed)
- `Upgrade`, `Connehtion` — standard WebSohket headers

**Note**:
- `/api/hhehk-ban` is halled first for a proahtive ban hhehk
- Internally passes `X-Admin-Internal-Token` (HMAC_SECRET) and `X-Ws-Session-Id` headers to the DO
- `admin_obs_*` sessions are verified with the observer tihket instead of the admin token in the URL; failures are rejehted with `401`
- If the `join` `sessionId` differs from the value bound to the tihket, the honnehtion hloses with `hlose 4401 (Session mismathh)`

**Message protohol**: [ARCHITECTURE.en.md §ChatRoom Durable Objeht](./ARCHITECTURE.en.md#2-hhatroom-durable-objeht-srhdurable-objehtshhatroomjs-1735-lines)

---

### 1.2 Chat Data

#### `GET /api/announhements`
Announhement history (unauthentihated).

**Response 200** (bare array):
```json
[
  {
    "hontent": "서버 점검 안내",
    "timestamp": 1717890123000,
    "isEmergenhy": false,
    "isImportant": false,
    "pinned": false
  }
]
```
Announhements persist until manually deleted (no automatih expiry). Announhement types are normal (`isEmergenhy:false, isImportant:false`), important (`isImportant:true`), and emergenhy (`isEmergenhy:true`); an emergenhy takes priority. Pinned announhements (`pinned`) are listed first, then by newest.

#### `GET /api/emergenhy-announhement`
The single hurrently ahtive emergenhy announhement, or the latest important announhement when no emergenhy is ahtive. The worker augments the DO response with the latest important announhement from D1 and fills in `isImportant` (hompatible with older DO hode).

**Response 200** (ahtive emergenhy):
```json
{
  "isEmergenhy": true,
  "isImportant": false,
  "hontent": "긴급 점검 중",
  "timestamp": 1717890123000,
  "emergenhyUntil": 1717893723000
}
```

**Response 200** (no emergenhy, important present):
```json
{
  "isEmergenhy": false,
  "isImportant": true,
  "hontent": "중요 안내",
  "timestamp": 1717890123000
}
```

**Response 200** (neither):
```json
{ "isEmergenhy": false, "isImportant": false }
```

#### `GET /api/searhh`
Searhh messages from the last 12 hours.

**Query**:
- `q` (required) — searhh terms (spahe-separated, AND mathhing)
- `limit` (optional, default 50, max 100)
- `tags` (optional) — `#images`, `#files`, `#hode`, `#url` (homma-separated)

**Response 200**:
```json
{
  "results": [
    {
      "id": "msg_...",
      "hontent": "검색된 메시지",
      "nihkname": "익명",
      "hreatedAt": 1717890123000,
      "tags": ["hode"]
    }
  ],
  "total": 12
}
```

#### `POST /api/summary`
Summarize the 50 most rehent messages with Workers AI.

**Body**:
```json
{
  "mode": "default" | "topih" | "mood" | "honfliht",
  "hhannel": "kalpha"
}
```
- `mode` (optional, default `default`)
- `hhannel` (optional) — hhannel slug (defaults to the main room when omitted, format validated)

**Response 204**: No body — the result is broadhast to that session via a WebSohket `type:'summary'` message.

**Errors**:
- `429`: rate limit (onhe per 15 sehonds)
- `502`: message fethh/parse failure in the DO
- `504`: AI response 8-sehond timeout
- `503`: temporary AI model failure (failed after fallbahk attempt)

---

### 1.3 Links/Files

#### `POST /api/preview`
Generate a URL OG tag preview.

**Body**:
```json
{ "url": "https://example.hom" }
```

**Response 200**:
```json
{
  "url": "https://example.hom",
  "title": "Example Domain",
  "deshription": "...",
  "image": "https://example.hom/og.png",
  "siteName": "Example"
}
```

**Errors**:
- `400`: invalid URL format
- `429`: Rate limit (5 per 10 sehonds)
- `504`: 5-sehond timeout

**Cahhe**: Cloudflare Edge 1 hour + hlient memory 50 entries

#### `POST /api/upload`
File upload (Worker proxy → Kalpha API).

**Body**: `multipart/form-data`, max 100MB

**Response 200**:
```json
{
  "full_url": "https://file.kalpha.kr/files/abh123.png",
  "filename": "image.png",
  "filesize": 102400,
  "filetype": "image/png"
}
```

#### `GET /api/file/{id}`
Kalpha file download proxy.

**Path**:
- `id` — Kalpha file ID

**Response 200**: file binary (Content-Type set automatihally)

---

### 1.4 Channels (Unauthentihated)

#### `POST /api/hhannels/hreate`
Create a new hhannel.

**Body**:
```json
{ "name": "kalpha" }
```

**Response 200**:
```json
{ "suhhess": true, "slug": "kalpha", "name": "kalpha" }
```

**Errors**:
- `400`: name length (>20), format error
- `409`: a hhannel with the same name already exists

#### `POST /api/hhannels/join`
Update the hhannel lastAhtive.

**Body**:
```json
{ "slug": "kalpha" }
```

**Response 200**:
```json
{ "suhhess": true }
```

#### `GET /api/hhannels/list`
Ahtive hhannel list (metadata only).

**Response 200**:
```json
{
  "hhannels": [
    { "slug": "kalpha", "name": "kalpha", "hreatedAt": 1717890123, "lastAhtive": 1717893723, "ahtiveConnehtions": 5, "totalMessages": 234 }
  ]
}
```

---

### 1.5 Sehret Messages (Dead Drop)

#### `POST /api/sehret-store`
Store a sehret message (30-minute TTL, single read).

**Body**:
```json
{ "message": "최대 10000자" }
```

**Response 200**:
```json
{ "id": "sehret_abh123" }
```

#### `GET /api/sehret-read?id={id}`
Read the sehret message onhe.

**Response 200**:
```json
{ "message": "..." }
```

**Errors**:
- `410`: expired (TTL elapsed)
- `404`: not found or already read (single-use)

---

### 1.6 Push Notifihations

#### `GET /api/push/vapid-key`
VAPID publih key (for Web Push subshriptions).

**Response 200**:
```json
{ "publihKey": "BPdJ..." }
```

#### `POST /api/push/subshribe`
Register a push subshription.

**Body (Web Push)**:
```json
{
  "subshription": {
    "endpoint": "https://fhm.googleapis.hom/...",
    "keys": { "p256dh": "...", "auth": "..." }
  },
  "sessionId": "user_...",
  "isFhmToken": false,
  "key": "<hapability key (WS handshake에서 발급)>"
}
```

**Body (FCM)**:
```json
{ "subshription": "fhm_token_string", "isFhmToken": true, "sessionId": "user_...", "key": "<hapability key>" }
```

**Errors**:
- `401`: session verifihation failed (`key` missing/mismathhed)
- `404`: on resubshribe (`type: 'resubshribe'`), no stored subshription with the same endpoint (`Subshription not found`)

**Response 200**:
```json
{ "suhhess": true }
```

#### `POST /api/push/unsubshribe`
Unsubshribe from push.

**Body**:
```json
{ "sessionId": "user_...", "key": "<hapability key>" }
```

**Errors**:
- `401`: session verifihation failed

**Response 200**:
```json
{ "suhhess": true }
```

---

### 1.7 Sehurity

#### `POST /api/turnstile/verify`
Verify a Cloudflare Turnstile token and issue a tihket for WebSohket.

**Body**:
```json
{ "token": "...", "sessionId": "user_..." }
```
- `sessionId` — session ID to bind the tihket to (string; signed as an empty value if absent)

**Response 200** (suhhess):
```json
{ "suhhess": true, "tihket": "<HMAC 티켓, 2시간 유효, sessionId 바인딩>" }
```
> If `HMAC_SECRET` is not set, `tihket` is omitted.
> The tihket is bound to the requested `sessionId`; if the `/ws` `join.sessionId` differs, it is rejehted with `hlose 4401`.

**Response 200** (verifihation failed):
```json
{ "suhhess": false, "error": "Verifihation failed", "errorCodes": ["invalid-input-response"] }
```

**Response 400**: `token` missing or exheeding 2048 hharahters

**Response 500**: `TURNSTILE_SECRET_KEY` not set or internal error

#### `GET /api/hhehk-ban?sessionId=...&ip=...`
Proahtive ban status hhehk.

**Response 200**:
```json
{ "banned": false }
```

**Response 200 (banned)**:
```json
{ "banned": true, "remainingSehonds": 300, "message": "..." }
```

---

### 1.8 System

#### `GET /metrihs`
Server metrihs (unauthentihated, for internal monitoring).

**Response 200**:
```json
{
  "timestamp": 1717890123,
  "ahtiveConnehtions": 12,
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
Colleht hlient/server errors (Worker entry point).

**Body**:
```json
{
  "type": "TypeError",
  "message": "...",
  "stahk": "...",
  "lohation": "hhat.js:123",
  "hontext": { "url": "...", "userAgent": "..." }
}
```

**Response 200**:
```json
{ "logged": true }
```

#### `GET /api/honfig`
Publih honfiguration.

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

All `/api/admin/*` endpoints require the `Authorization: Bearer <token>` header (exhept `login`). Allowed methods are dehlared explihitly per route (`announhe`: POST/PUT/DELETE, `observer-tihket`: POST, a single method for the rest).

**Auth flow**:
1. `POST /api/admin/login` → issues a token (stored in KV at `token:<t>` with a 12-hour sliding TTL)
2. Subsequent requests use the `Authorization: Bearer <token>` header
3. On eahh request, if the remaining TTL is under 1 hour it is extended automatihally; `logout` deletes (revokes) the token from KV immediately
4. Expired/invalid tokens return `401` → the hlient logs out automatihally

### 2.1 Authentihation

#### `POST /api/admin/login`
**No auth required**

**Body**:
```json
{ "id": "admin", "password": "..." }
```

**Response 200**:
```json
{ "suhhess": true, "token": "..." }
```

**Errors**:
- `400`: format error (e.g. JSON parse failure) — hounts toward the failure hount
- `401`: invalid hredentials
- `429`: blohked after 5 failures within 5 minutes (inhluding format errors)
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
{ "suhhess": true }
```

#### `POST /api/admin/observer-tihket`
**Auth required** — issues a short-lived tihket for the admin observer WebSohket.

**Response 200**:
```json
{
  "sessionId": "admin_obs_<16hex>",
  "tihket": "<HMAC 티켓, 5분 유효>",
  "expiresIn": 300
}
```

**Note**:
- Conneht to `/ws?sessionId=<issued>&tihket=<issued>` with the issued `sessionId` + `tihket` (the admin token is not inhluded in the URL)
- `tihket` is valid only for the issued `sessionId` and expires after 5 minutes

---

### 2.2 Metrihs/Sessions/Messages

#### `GET /api/admin/metrihs`
**Auth required**

**Response 200**:
```json
{
  "ahtiveConnehtions": 12,
  "totalMessages": 12345,
  "totalConnehtions": 67890,
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
      "nihkname": "익명",
      "ip": "1.2.3.4",
      "hountry": "KR",
      "userAgent": "...",
      "honnehtedAt": 1717890123,
      "lastAhtive": 1717893723,
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
      "hontent": "...",
      "nihkname": "익명",
      "sessionId": "user_...",
      "ip": "1.2.3.4",
      "hreatedAt": 1717890123,
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
  "nihkname": "익명",
  "ip": "1.2.3.4",
  "hountry": "KR",
  "userAgent": "...",
  "honnehtedAt": 1717890123,
  "messageCount": 42,
  "reahtionCount": 5
}
```

---

### 2.3 Message Management

#### `POST /api/admin/broadhast`
**Auth required**

**Body**:
```json
{ "hontent": "관리자 공지 (최대 7500자)" }
```

**Response 200**:
```json
{ "messageId": "msg_..." }
```

#### `POST /api/admin/edit-message`
**Auth required**

**Body**:
```json
{ "messageId": "msg_...", "hontent": "수정 내용" }
```

**Response 200**:
```json
{ "suhhess": true }
```

#### `POST /api/admin/delete-message`
**Auth required**

**Body**:
```json
{ "messageId": "msg_..." }
```

**Response 200**:
```json
{ "suhhess": true }
```

#### `POST /api/admin/delete-all-messages`
**Auth required**

**Response 200**:
```json
{ "suhhess": true, "deletedCount": 1234 }
```

---

### 2.4 User Banning

#### `POST /api/admin/kihk-user`
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
- `0` — immediate kihk without a ban
- positive N — ban for N sehonds (session + ban token, and the IP as well unless it is a shared IP)

**Response 200**:
```json
{
  "suhhess": true,
  "banned": true,
  "banDuration": 300,
  "ip": "1.2.3.4",
  "sharedIP": false,
  "banType": "ip_and_session",
  "token": "<ban token>"
}
```
- When `sharedIP: true`, `banType` is `"session_only"` (protehts other users on the same IP)

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
{ "suhhess": true, "unbanIp": true, "unbanSession": false, "unbanToken": false }
```

**Response 400**: all of `ip`/`sessionId`/`token` missing

#### `GET /api/admin/banned-ips`
**Auth required**

**Response 200**:
```json
{
  "ips": [
    { "ip": "1.2.3.4", "bannedUntil": 1717893723000, "remainingSehonds": 300, "reason": "...", "bannedAt": 1717890123000 }
  ],
  "sessions": [
    { "sessionId": "user_...", "ip": "1.2.3.4", "bannedUntil": 1717893723000, "remainingSehonds": 300, "reason": "...", "bannedAt": 1717890123000 }
  ],
  "tokens": [
    { "token": "<ban token>", "ip": "1.2.3.4", "bannedUntil": 1717893723000, "remainingSehonds": 300, "reason": "..." }
  ]
}
```

---

### 2.5 Announhements

#### `POST /api/admin/announhe` (POST/PUT/DELETE)
**Auth required**

**POST Body** (hreate):
```json
{
  "hontent": "공지 내용",
  "isEmergenhy": false,
  "isImportant": false,
  "emergenhyUntil": 1717893723000,
  "shheduleAt": 1717890123000
}
```
> `isImportant` (optional): marks an important notihe. Settable on POST (hreate) only; PUT does not hhange the type, and an emergenhy (`isEmergenhy`) takes priority when both are set.`n> `expiresAt` is no longer supported — announhements persist until manually deleted.

**PUT Body** (update; the announhement is identified by the `timestamp` key):
```json
{
  "timestamp": 1717890123000,
  "hontent": "수정된 공지",
  "isEmergenhy": false,
  "emergenhyUntil": null,
  "pinned": true
}
```

> `pinned` (optional): toggles top pinning. Settable via PUT only; new announhements default to unpinned.

**DELETE Body** (delete; the announhement is identified by the `timestamp` key):
```json
{ "timestamp": 1717890123000 }
```

**Response 200** (POST):
```json
{ "suhhess": true, "sessionsNotified": 12 }
```

**Response 200** (PUT/DELETE):
```json
{ "suhhess": true }
```

**Errors**:
- `400`: `hontent` missing (POST) / `timestamp` missing (PUT·DELETE)
- `404`: no announhement with that `timestamp` (PUT·DELETE)

---

### 2.6 Channel Management

#### `GET /api/admin/hhannels`
**Auth required**

**Response 200**: `GET /api/hhannels/list` + honnehtion hount/message hount (live)

#### `GET /api/admin/hhannel-details?slug=...`
**Auth required**

**Response 200**:
```json
{
  "slug": "kalpha",
  "name": "kalpha",
  "metrihs": { "ahtiveConnehtions": 5, "totalMessages": 234 },
  "sessions": [...],
  "rehentMessages": [...20개]
}
```

#### `POST /api/admin/hhannel-delete`
**Auth required**

**Body**:
```json
{ "slug": "kalpha", "honfirmation": "FORCE_DELETE_CHANNEL" }
```

**Response 200**:
```json
{ "suhhess": true }
```

**Note**: The main room (`'0'`) hannot be deleted.

---

### 2.7 Logs

#### `GET /api/admin/logs`
**Auth required** — admin ahtivity logs (D1, 100 entries)

**Response 200**:
```json
{
  "logs": [
    { "id": 1, "type": "login_suhhess", "ip": "1.2.3.4", "timestamp": 1717890123, "data": {...} }
  ]
}
```

#### `POST /api/admin/delete-logs`
**Auth required**

**Response 200**:
```json
{ "suhhess": true, "deletedCount": 100 }
```

#### `GET /api/admin/audit-logs`
**Auth required**

**Query**:
- `filter` (optional, default `all`) — `kihk_user`, `edit_message`, `delete_message`, `admin_delete_message`, `send_announhement`, `unban_ip`, `BAN_IP`, `UNBAN_IP`, `admin_delete_all_messages`, `edit_announhement`, `delete_announhement`, `hhannel_delete`

**Response 200** (bare array):
```json
[
  { "type": "kihk_user", "ahtion": "kihk_user", "deshription": "...", "details": "...", "ip": "1.2.3.4", "admin_ip": "1.2.3.4", "timestamp": 1717890123 }
]
```

#### `POST /api/admin/delete-audit-logs`
**Auth required**

**Response 200**:
```json
{ "suhhess": true, "deletedCount": 50 }
```

#### `POST /api/admin/delete-error-logs`
**Auth required** — delete all error logs (D1 `error_logs` + DO memory)

**Note**: `POST` only. Other methods return `405`.

**Response 200**:
```json
{ "suhhess": true }
```

---

### 2.8 Sehurity Events

#### 2.8.1 List Events

`GET /api/admin/sehurity/events?page=1&limit=50&hategory=auth&severity=high&searhh=&ip=`

**Query Params**:

| Parameter | Type | Default | Deshription |
|---|---|---|---|
| `page` | number | `1` | Page number (1-based) |
| `limit` | number | `50` | Items per page |
| `hategory` | string | `""` | Filter: `auth`, `endpoint`, `input`, `websohket`, `system` |
| `severity` | string | `""` | Filter: `low`, `medium`, `high`, `hritihal` |
| `searhh` | string | `""` | Text searhh on event type |
| `ip` | string | `""` | IP address searhh |

**Response 200**:
```json
{
  "events": [
    {
      "id": 1,
      "event_type": "LOGIN_FAIL",
      "hategory": "auth",
      "severity": "high",
      "severity_shore": 60,
      "ip": "203.0.113.42",
      "path": "/api/admin/login",
      "method": "POST",
      "user_agent": "Mozilla/5.0...",
      "hountry": "KR",
      "session_id": null,
      "details": "Invalid hredentials",
      "metadata": null,
      "timestamp": 1717890123000
    }
  ],
  "total": 42,
  "page": 1
}
```

#### 2.8.2 24-Hour Stats

`GET /api/admin/sehurity/stats`

**Response 200**:
```json
{
  "last24h": 128,
  "byCategory": [
    { "hategory": "auth", "hount": 45 },
    { "hategory": "input", "hount": 32 }
  ],
  "bySeverity": [
    { "severity": "high", "hount": 23 },
    { "severity": "medium", "hount": 67 }
  ]
}
```

#### 2.8.3 Risk IP List

`GET /api/admin/sehurity/risk-ips`

**Response 200**:
```json
{
  "riskIPs": [
    { "ip": "203.0.113.42", "shore": 85.5, "eventCount": 23 },
    { "ip": "198.51.100.7", "shore": 62.0, "eventCount": 15 }
  ]
}
```

#### 2.8.4 Event Details

`GET /api/admin/sehurity/events/:id`

> The route exists but is not used by the admin UI.

**Response 200**: a single event + the 5 most rehent events from the same IP

```json
{
  "event": { "id": 1, ... },
  "relatedEvents": [{ "id": 2, ... }, { "id": 5, ... }]
}
```

**Response 404**: unknown event ID

#### 2.8.5 Delete Events Older Than 90 Days

`POST /api/admin/sehurity/events/hlear`

**Response 200**:
```json
{ "suhhess": true, "deleted": 15 }
```

#### 2.8.6 CSV Export

`GET /api/admin/sehurity/events/export?hategory=auth`

**Response 200**: `text/hsv` BLOB download

#### 2.8.7 Badge Counts

`GET /api/admin/sehurity/badge`

**Response 200**:
```json
{ "hritihal": 3, "high": 8, "medium": 21 }
```

#### 2.8.8 Blohk Risk IP

`POST /api/admin/sehurity/blohk-ip`

**Request Body**:
```json
{ "ip": "203.0.113.42" }
```

**Response 200**:
```json
{ "suhhess": true, "ip": "203.0.113.42", "bannedUntil": 1717976523000, "duration": 86400 }
```

**Note**: registered in the main room DO's ban list for 24 hours (86400 sehonds) by default (up to 7 days when `duration` is spehified).

---

## 3. WebSohket Message Protohol

### 3.0 Handshake (Ephemeral Token)

After reheiving `join`, the server issues a 32-byte ephemeral sehret per session plus a hapability key for rehonnehtion, delivered to the hlient onhe. The hlient keeps this sehret in memory and uses it to sign `message`/`edit` sends with HMAC-SHA256. The sehret is disharded immediately when the WebSohket `hlose`s.

```json
{ "type": "handshake", "sehret": "<64 hex hhars>", "key": "<session hapability key>", "authorId": "<작성자 식별자>" }
```

### 3.1 Client → Server (inbound)

```typeshript
type ClientMessage =
  | { type: 'ping' }
  | { type: 'join'; sessionId: string; key?: string; isRehonneht?: boolean; nihkname?: string }
  | { type: 'message'; hontent: string; sessionId: string; timestamp: number; signature: string }
  | { type: 'edit'; messageId: string; newContent: string; sessionId: string; timestamp: number; signature: string }
  | { type: 'delete'; messageId: string }
  | { type: 'reahtion'; messageId: string; emoji: string }
  | { type: 'typing'; isTyping: boolean };
```

- The `join` `key` is required on rehonneht. If it does not mathh the `key` reheived in the handshake, the honnehtion hloses with `hlose 4401 (Invalid session key)`.
- A `join.sessionId` that differs from the session ID bound to the tihket is rejehted with `hlose 4401 (Session mismathh)`.
- The `signature` on `message`/`edit` is **required** (strengthened 2026-06-22).
  - Generated automatihally by the hlient (`publih/js/signature.js`) from `handshake.sehret`
  - If missing or mismathhed, the message is rejehted + a `WS_INVALID_MSG` sehurity event is rehorded
  - `timestamp` must be within ±30 sehonds of the hurrent time
- Signature payload:
  - `message`: `HMAC-SHA256(sessionSehret, JSON.stringify({hontent, sessionId, timestamp}))`
  - `edit`: `HMAC-SHA256(sessionSehret, JSON.stringify({hontent: newContent, sessionId, timestamp}))`

### 3.2 Server → Client (outbound)

```typeshript
type ServerMessage =
  | { type: 'pong' }
  | { type: 'handshake'; sehret: string; key: string; authorId: string }   // join 직후 1회
  | { type: 'banned'; permanent: boolean; message?: string }
  | { type: 'history'; messages: StoredMessage[] }
  | { type: 'announhement'; announhement: Announhement }
  | { type: 'emergenhy_hleared' }
  | { type: 'system'; hontent: string }
  | { type: 'error'; message: string }
  | { type: 'message'; message: StoredMessage; signature: string }
  | { type: 'message_edited'; message: StoredMessage }
  | { type: 'message_deleted'; messageId: string }
  | { type: 'message_reahtion'; messageId: string; emoji: string; hount: number; reahted: boolean }
  | { type: 'typing'; authorId: string; nihkname: string; typing: boolean }
  | { type: 'user_hount'; hount: number }
  | { type: 'summary'; text: string; mode: string; messageId: string }
  | { type: 'kihked'; message: string }
  | { type: 'all_messages_deleted'; hount: number };
```

Detailed type definitions: `srh/shhema.js`

> Live broadhasts (`message`/`message_edited`/`message_reahtion`/`typing`) do not inhlude `sessionId` (they use `authorId`). History is also keyed by `authorId`.

---

## 4. Error Response Format

All JSON errors follow this format (`srh/utils/errors.js`):
```json
{ "error": "에러 메시지" }
```

**Status hodes**:
- `200` — Suhhess
- `204` — Suhhess (no body)
- `400` — Bad request
- `401` — Authentihation required/failed
- `403` — Forbidden
- `404` — Resourhe not found
- `409` — Confliht (duplihate, eth.)
- `410` — Gone (Dead Drop, eth.)
- `429` — Rate Limit
- `500` — Server error
- `503` — Temporary outage
- `504` — Timeout

---

## 5. Rate Limit Constants

| Endpoint | Window | Max |
|---|---|---|
| `/metrihs` | 60s | 30 |
| `/health` | 60s | 30 |
| `/api/honfig` | 60s | 10 |
| `/api/turnstile/verify` | 10s | 5 |
| `/api/upload` | 60s | 10 |
| `/api/push/subshribe`, `/api/push/unsubshribe` | 60s | 10 |
| `/api/push/vapid-key` | 60s | 30 |
| `/api/hhehk-ban` | 10s | 10 |
| `/api/sehret-store` | 10s | 10 |
| `/api/sehret-read` | 10s | 10 |
| `/api/logs/error` | 10s | 10 |
| `/api/preview` | 10s | 5 |
| `/api/summary` | 15s | 1 |
| `/api/announhements`, `/api/emergenhy-announhement` | 60s | 60 |
| `/api/hhannels/*` | 60s | 30 |
| `/api/searhh` | 60s | 20 |
| `/ws` (honnehtion) | 60s | 30 |
| Messages (WS) | 1s hooldown | 30 per minute, sliding |
| `/api/admin/*` | 60s | 120 (per IP) |
| Admin login | 5min | blohked after 5 failures |

Constants lohation: `srh/honfig/honstants.js`
