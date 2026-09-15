# API 명세

53개 HTTP 엔드포인트의 명세입니다. 모든 응답은 CORS 헤더를 포함합니다 (`src/config/cors.js`).

**기본 URL**: `https://kalpha.mmv.kr` (프로덕션) | `http://localhost:8788` (개발)

---

## 목차

- [개요](#개요)
- [1. 공개 엔드포인트](#1-공개-엔드포인트-22개)
  - [1.1 WebSocket](#11-websocket)
  - [1.2 채팅 데이터](#12-채팅-데이터)
  - [1.3 링크/파일](#13-링크파일)
  - [1.4 채널 (비인증)](#14-채널-비인증)
  - [1.5 비밀 메시지](#15-비밀-메시지-dead-drop)
  - [1.6 푸시 알림](#16-푸시-알림)
  - [1.7 보안](#17-보안)
  - [1.8 시스템](#18-시스템)
- [2. 관리자 엔드포인트](#2-관리자-엔드포인트-31개-bearer-인증)
  - [2.1 인증](#21-인증)
  - [2.2 메트릭/세션/메시지](#22-메트릭세션메시지)
  - [2.3 메시지 관리](#23-메시지-관리)
  - [2.4 사용자 차단](#24-사용자-차단)
  - [2.5 공지사항](#25-공지사항)
  - [2.6 채널 관리](#26-채널-관리)
  - [2.7 로그](#27-로그)
  - [2.8 보안 이벤트](#28-보안-이벤트)
- [3. WebSocket 메시지 프로토콜](#3-websocket-메시지-프로토콜)
- [4. 에러 응답 형식](#4-에러-응답-형식)
- [5. Rate Limit 상수](#5-rate-limit-상수)

---

## 개요

| 항목 | 값 |
|---|---|
| 총 엔드포인트 | 53개 (공개 22 + 관리자 31) |
| 인증 방식 | 공개: 없음 / 관리자: Bearer 토큰 |
| 데이터 형식 | JSON (multipart는 `/api/upload`만) |
| CORS | 모든 응답 포함 (`src/config/cors.js`) |
| 인증 토큰 TTL | 12시간 슬라이딩 (잔여 1시간 미만 시 자동 연장, KV revocation 지원) |

### 엔드포인트 카테고리

| 카테고리 | 개수 | 비고 |
|---|---|---|
| WebSocket | 1 | `/ws` |
| 채팅 데이터 | 4 | 공지, 검색, 요약, 긴급공지 |
| 링크/파일 | 3 | OG 미리보기, 업로드, 다운로드 |
| 채널 (비인증) | 3 | 생성, 참가, 목록 |
| 비밀 메시지 | 2 | Dead Drop store/read |
| 푸시 알림 | 3 | VAPID 키, 구독, 해제 |
| 보안 | 2 | Turnstile 검증, 차단 확인 |
| 시스템 | 4 | metrics, health, error log, config |
| 관리자 인증 | 3 | login, verify, logout |
| 관리자 데이터 | 4 | metrics, sessions, messages, user-details |
| 관리자 메시지 | 4 | broadcast, edit, delete, delete-all |
| 관리자 차단 | 3 | kick-user, unban-ip, banned-ips |
| 관리자 공지 | 1 | announce (POST/PUT/DELETE) |
| 관리자 채널 | 3 | channels, details, delete |
| 관리자 로그 | 5 | logs, delete-logs, audit-logs, delete-audit-logs, delete-error-logs |
| 관리자 보안 | 8 | security/events, stats, risk-ips, events/export, events/clear, badge, block-ip, events/:id (동적) |

---

## 1. 공개 엔드포인트 (22개)

### 1.1 WebSocket

#### `GET /ws`
WebSocket 업그레이드 엔드포인트.

**Query**:
- `sessionId` (required) — `user_<uuid>_<ts>` 형식
- `channel` (optional) — 채널 slug (생략 시 메인룸)
- `ticket` (required) — `POST /api/turnstile/verify`가 발급한 HMAC 티켓 (12시간 유효)
- `token` — `admin_obs_*` 관리자 옵저버 세션 전용 관리자 토큰 (일반 세션은 불필요)

**Headers**:
- `Origin` — 필수. 누락/비허용 Origin이면 `403` (fail-closed)
- `Upgrade`, `Connection` — WebSocket 표준

**참고**:
- 사전 차단 확인을 위해 `/api/check-ban`을 먼저 호출합니다
- 내부적으로 `X-Admin-Internal-Token` (HMAC_SECRET) 헤더를 DO에 전달
- `admin_obs_*` 세션은 `token` 검증 실패 시 `401`로 거부됩니다

**메시지 프로토콜**: [ARCHITECTURE.md §ChatRoom Durable Object](./ARCHITECTURE.md#2-chatroom-durable-object-srcdurable-objectschatroomjs-1435줄)

---

### 1.2 채팅 데이터

#### `GET /api/announcements`
공지 히스토리 조회 (비인증).

**Response 200** (bare array):
```json
[
  {
    "content": "서버 점검 안내",
    "timestamp": 1717890123000,
    "isEmergency": false,
    "emergencyUntil": null,
    "expiresAt": 1717893723000
  }
]
```

#### `GET /api/emergency-announcement`
현재 활성 긴급공지 1개.

**Response 200** (활성):
```json
{
  "isEmergency": true,
  "content": "긴급 점검 중",
  "timestamp": 1717890123000,
  "emergencyUntil": 1717893723000
}
```

**Response 200** (긴급공지 없음):
```json
{ "isEmergency": false }
```

#### `GET /api/search`
12시간 이내 메시지 검색.

**Query**:
- `q` (required) — 검색어 (공백 구분 AND 매치)
- `limit` (optional, default 50, max 100)
- `tags` (optional) — `#images`, `#files`, `#code`, `#url` (쉼표 구분)

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
Workers AI로 최근 50개 메시지 요약.

**Body**:
```json
{
  "mode": "default" | "topic" | "mood" | "conflict",
  "channel": "kalpha"
}
```
- `mode` (optional, default `default`)
- `channel` (optional) — 채널 slug (생략 시 메인룸, 형식 검증됨)

**Response 204**: 본문 없음 — 결과는 WebSocket `type:'summary'` 메시지로 해당 세션에 broadcast됨.

**Errors**:
- `429`: 레이트 리밋 (15초 1회)
- `502`: DO에서 메시지 조회/파싱 실패
- `504`: AI 응답 8초 타임아웃
- `503`: AI 모델 일시 장애 (fallback 시도 후 실패)

---

### 1.3 링크/파일

#### `POST /api/preview`
URL OG 태그 프리뷰 생성.

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
- `400`: URL 형식 오류
- `429`: Rate limit (10초 5회)
- `504`: 5초 타임아웃

**Cache**: Cloudflare Edge 1시간 + 클라이언트 메모리 50개

#### `POST /api/upload`
파일 업로드 (Worker 프록시 → Kalpha API).

**Body**: `multipart/form-data`, 최대 100MB

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
Kalpha 파일 다운로드 프록시.

**Path**:
- `id` — Kalpha 파일 ID

**Response 200**: 파일 바이너리 (Content-Type 자동)

---

### 1.4 채널 (비인증)

#### `POST /api/channels/create`
신규 채널 생성.

**Body**:
```json
{ "name": "kalpha" }
```

**Response 200**:
```json
{ "success": true, "slug": "kalpha", "name": "kalpha" }
```

**Errors**:
- `400`: 이름 길이(>20), 형식 오류
- `409`: 동일 이름 채널 존재

#### `POST /api/channels/join`
채널 lastActive 갱신.

**Body**:
```json
{ "slug": "kalpha" }
```

**Response 200**:
```json
{ "success": true }
```

#### `GET /api/channels/list`
활성 채널 목록 (메타데이터만).

**Response 200**:
```json
{
  "channels": [
    { "slug": "kalpha", "name": "kalpha", "createdAt": 1717890123, "lastActive": 1717893723, "activeConnections": 5, "totalMessages": 234 }
  ]
}
```

---

### 1.5 비밀 메시지 (Dead Drop)

#### `POST /api/secret-store`
비밀 메시지 저장 (30분 TTL, 1회 읽기).

**Body**:
```json
{ "message": "최대 10000자" }
```

**Response 200**:
```json
{ "id": "secret_abc123" }
```

#### `GET /api/secret-read?id={id}`
비밀 메시지 1회 읽기.

**Response 200**:
```json
{ "message": "..." }
```

**Errors**:
- `410`: 만료됨 (TTL 경과)
- `404`: 존재하지 않음 또는 이미 읽음 (1회용)

---

### 1.6 푸시 알림

#### `GET /api/push/vapid-key`
VAPID 공개키 (Web Push 구독용).

**Response 200**:
```json
{ "publicKey": "BPdJ..." }
```

#### `POST /api/push/subscribe`
푸시 구독 등록.

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
- `401`: 세션 검증 실패 (`key` 누락/불일치)

**Response 200**:
```json
{ "success": true }
```

#### `POST /api/push/unsubscribe`
푸시 구독 해제.

**Body**:
```json
{ "sessionId": "user_...", "key": "<capability key>" }
```

**Errors**:
- `401`: 세션 검증 실패

**Response 200**:
```json
{ "success": true }
```

---

### 1.7 보안

#### `POST /api/turnstile/verify`
Cloudflare Turnstile 토큰 검증 후 WebSocket용 티켓 발급.

**Body**:
```json
{ "token": "...", "sessionId": "user_..." }
```
- `sessionId` — 티켓을 묶을 세션 ID (문자열, 없으면 빈 값으로 서명됨)

**Response 200** (성공):
```json
{ "success": true, "ticket": "<HMAC 티켓, 12시간 유효>" }
```
> `HMAC_SECRET` 미설정 시 `ticket`은 생략됩니다.

**Response 200** (검증 실패):
```json
{ "success": false, "error": "Verification failed", "errorCodes": ["invalid-input-response"] }
```

**Response 400**: `token` 누락 또는 2048자 초과

**Response 500**: `TURNSTILE_SECRET_KEY` 미설정 또는 내부 오류

#### `GET /api/check-ban?sessionId=...&ip=...`
차단 상태 사전 확인.

**Response 200**:
```json
{ "banned": false }
```

**Response 200 (차단)**:
```json
{ "banned": true, "remainingSeconds": 300, "message": "..." }
```

---

### 1.8 시스템

#### `GET /metrics`
서버 메트릭 (비인증, 내부 모니터링용).

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
클라이언트/서버 오류 수집 (Worker 진입단).

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
공개 설정.

**Response 200**:
```json
{
  "turnstileSiteKey": "0x4AAA...",
  "fileUploadUrl": "https://file.kalpha.kr/api/files",
  "kalphaApiUrl": "https://api.kalpha.kr"
}
```

---

## 2. 관리자 엔드포인트 (31개, Bearer 인증)

모든 `/api/admin/*` 엔드포인트는 `Authorization: Bearer <token>` 헤더 필요 (단, `login` 제외).

**인증 흐름**:
1. `POST /api/admin/login` → 토큰 발급 (KV `token:<t>`에 12시간 슬라이딩 TTL로 저장)
2. `Authorization: Bearer <token>` 헤더로 후속 요청
3. 요청 시 잔여 TTL이 1시간 미만이면 자동 연장되며, `logout`은 토큰을 KV에서 즉시 삭제(revoke)
4. 만료/무효 토큰은 `401`을 반환 → 클라이언트는 자동 로그아웃 처리

### 2.1 인증

#### `POST /api/admin/login`
**인증 불필요**

**Body**:
```json
{ "id": "admin", "password": "..." }
```

**Response 200**:
```json
{ "success": true, "token": "..." }
```

**Errors**:
- `401`: 자격 증명 오류
- `429`: 5분 내 5회 실패 시 차단
- `503`: `ADMIN_ID`/`ADMIN_PASSWORD` 미설정

#### `GET /api/admin/verify`
**인증 필요**

**Response 200**:
```json
{ "valid": true }
```

#### `POST /api/admin/logout`
**인증 필요** (해당 토큰 폐기 = KV에서 삭제)

**Headers**:
- `Authorization: Bearer <token>` (폐기 대상)

**Response 200**:
```json
{ "success": true }
```

---

### 2.2 메트릭/세션/메시지

#### `GET /api/admin/metrics`
**인증 필요**

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
**인증 필요**

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
**인증 필요**

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
**인증 필요**

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

### 2.3 메시지 관리

#### `POST /api/admin/broadcast`
**인증 필요**

**Body**:
```json
{ "content": "관리자 공지 (최대 7500자)" }
```

**Response 200**:
```json
{ "messageId": "msg_..." }
```

#### `POST /api/admin/edit-message`
**인증 필요**

**Body**:
```json
{ "messageId": "msg_...", "content": "수정 내용" }
```

**Response 200**:
```json
{ "success": true }
```

#### `POST /api/admin/delete-message`
**인증 필요**

**Body**:
```json
{ "messageId": "msg_..." }
```

**Response 200**:
```json
{ "success": true }
```

#### `POST /api/admin/delete-all-messages`
**인증 필요**

**Response 200**:
```json
{ "success": true, "deletedCount": 1234 }
```

---

### 2.4 사용자 차단

#### `POST /api/admin/kick-user`
**인증 필요**

**Body**:
```json
{
  "sessionId": "user_...",
  "banDuration": 300,
  "reason": "스팸"
}
```

**`banDuration` 값**:
- `0` — 밴 없이 즉시 퇴장 (kick)
- 양수 N — N초 동안 밴 (세션 + ban 토큰, 공유 IP가 아니면 IP까지)

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
- `sharedIP: true`면 `banType: "session_only"` (같은 IP의 다른 사용자 보호)

#### `POST /api/admin/unban-ip`
**인증 필요**

**Body** (하나 이상 필수):
```json
{ "ip": "1.2.3.4" }
{ "sessionId": "user_..." }
{ "token": "<ban token>" }
```

**Response 200**:
```json
{ "success": true, "unbanIp": true, "unbanSession": false, "unbanToken": false }
```

**Response 400**: `ip`/`sessionId`/`token` 모두 누락

#### `GET /api/admin/banned-ips`
**인증 필요**

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

### 2.5 공지사항

#### `POST /api/admin/announce` (POST/PUT/DELETE)
**인증 필요**

**POST Body** (신규):
```json
{
  "content": "공지 내용",
  "isEmergency": false,
  "emergencyUntil": 1717893723000,
  "scheduleAt": 1717890123000,
  "expiresAt": 1717893723000
}
```

**PUT Body** (수정, `timestamp` 키로 공지 지정):
```json
{
  "timestamp": 1717890123000,
  "content": "수정된 공지",
  "isEmergency": false,
  "emergencyUntil": null
}
```

**DELETE Body** (삭제, `timestamp` 키로 공지 지정):
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
- `400`: `content` 누락(POST) / `timestamp` 누락(PUT·DELETE)
- `404`: 해당 `timestamp`의 공지 없음(PUT·DELETE)

---

### 2.6 채널 관리

#### `GET /api/admin/channels`
**인증 필요**

**Response 200**: `GET /api/channels/list` + 접속자 수/메시지 수 (라이브)

#### `GET /api/admin/channel-details?slug=...`
**인증 필요**

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
**인증 필요**

**Body**:
```json
{ "slug": "kalpha", "confirmation": "FORCE_DELETE_CHANNEL" }
```

**Response 200**:
```json
{ "success": true }
```

**참고**: 메인룸(`'0'`)은 삭제할 수 없습니다.

---

### 2.7 로그

#### `GET /api/admin/logs`
**인증 필요** — 관리자 활동 로그 (D1, 100개)

**Response 200**:
```json
{
  "logs": [
    { "id": 1, "type": "login_success", "ip": "1.2.3.4", "timestamp": 1717890123, "data": {...} }
  ]
}
```

#### `POST /api/admin/delete-logs`
**인증 필요**

**Response 200**:
```json
{ "success": true, "deletedCount": 100 }
```

#### `GET /api/admin/audit-logs`
**인증 필요**

**Query**:
- `filter` (optional, default `all`) — `kick_user`, `edit_message`, `delete_message`, `admin_delete_message`, `send_announcement`, `unban_ip`, `BAN_IP`, `UNBAN_IP`, `admin_delete_all_messages`, `edit_announcement`, `delete_announcement`, `channel_delete`

**Response 200** (bare array):
```json
[
  { "type": "kick_user", "action": "kick_user", "description": "...", "details": "...", "ip": "1.2.3.4", "admin_ip": "1.2.3.4", "timestamp": 1717890123 }
]
```

#### `POST /api/admin/delete-audit-logs`
**인증 필요**

**Response 200**:
```json
{ "success": true, "deletedCount": 50 }
```

#### `POST /api/admin/delete-error-logs`
**인증 필요** — 오류 로그 전체 삭제 (D1 `error_logs` + DO 메모리)

**참고**: `POST` 전용. 다른 메서드는 `405` 반환.

**Response 200**:
```json
{ "success": true }
```

---

### 2.8 보안 이벤트

#### 2.8.1 이벤트 목록 조회

`GET /api/admin/security/events?page=1&limit=50&category=auth&severity=high&search=&ip=`

**Query Params**:

| 파라미터 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `page` | number | `1` | 페이지 번호 (1-base) |
| `limit` | number | `50` | 페이지당 항목 수 |
| `category` | string | `""` | 필터: `auth`, `endpoint`, `input`, `websocket`, `system` |
| `severity` | string | `""` | 필터: `low`, `medium`, `high`, `critical` |
| `search` | string | `""` | 이벤트 타입 텍스트 검색 |
| `ip` | string | `""` | IP 주소 검색 |

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

#### 2.8.2 24시간 통계

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

#### 2.8.3 위험 IP 목록

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

#### 2.8.4 이벤트 상세

`GET /api/admin/security/events/:id`

> 라우트는 존재하지만 관리자 UI에서는 사용하지 않습니다.

**Response 200**: 단일 이벤트 + 동일 IP의 최근 이벤트 5개

```json
{
  "event": { "id": 1, ... },
  "relatedEvents": [{ "id": 2, ... }, { "id": 5, ... }]
}
```

**Response 404**: 존재하지 않는 이벤트 ID

#### 2.8.5 90일+ 이벤트 삭제

`POST /api/admin/security/events/clear`

**Response 200**:
```json
{ "success": true, "deleted": 15 }
```

#### 2.8.6 CSV 내보내기

`GET /api/admin/security/events/export?category=auth`

**Response 200**: `text/csv` BLOB 다운로드

#### 2.8.7 배지 카운트

`GET /api/admin/security/badge`

**Response 200**:
```json
{ "critical": 3, "high": 8, "medium": 21 }
```

#### 2.8.8 위험 IP 차단

`POST /api/admin/security/block-ip`

**Request Body**:
```json
{ "ip": "203.0.113.42" }
```

**Response 200**:
```json
{ "success": true, "ip": "203.0.113.42", "bannedUntil": 1717976523000, "duration": 86400 }
```

**참고**: 메인룸 DO의 밴 목록에 24시간(86400초) 기본으로 등록됩니다(`duration` 지정 시 최대 7일).

---

## 3. WebSocket 메시지 프로토콜

### 3.0 핸드셰이크 (Ephemeral Token)

`join` 수신 후 서버는 세션별 32바이트 ephemeral secret과 재연결용 capability key를 발급하여 클라이언트에 1회 전달합니다. 클라이언트는 이 secret을 메모리에 보관하고 이후 `message`/`edit` 송신 시 HMAC-SHA256 서명에 사용합니다. WebSocket `close` 시 secret은 즉시 폐기됩니다.

```json
{ "type": "handshake", "secret": "<64 hex chars>", "key": "<session capability key>", "authorId": "<작성자 식별자>" }
```

### 3.1 클라이언트 → 서버 (inbound)

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

- `join`의 `key`는 재연결 시 필수입니다. handshake에서 받은 `key`와 불일치하면 `close 4401 (Invalid session key)`로 연결이 끊깁니다.
- `message`/`edit`의 `signature`는 **필수**입니다 (2026-06-22 강화).
  - 클라이언트(`public/js/signature.js`)가 `handshake.secret`으로 자동 생성
  - 미포함 또는 불일치 시 거부 + `WS_INVALID_MSG` 보안 이벤트 기록
  - `timestamp`는 현재 시각 기준 ±30초 이내여야 합니다
- 서명 페이로드:
  - `message`: `HMAC-SHA256(sessionSecret, JSON.stringify({content, sessionId, timestamp}))`
  - `edit`: `HMAC-SHA256(sessionSecret, JSON.stringify({content: newContent, sessionId, timestamp}))`

### 3.2 서버 → 클라이언트 (outbound)

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
  | { type: 'message_edited'; messageId: string; content: string; editedAt: number }
  | { type: 'message_deleted'; messageId: string }
  | { type: 'message_reaction'; messageId: string; emoji: string; count: number; reacted: boolean }
  | { type: 'typing'; sessionId: string; nickname: string; isTyping: boolean }
  | { type: 'user_count'; count: number }
  | { type: 'summary'; text: string; mode: string; messageId: string }
  | { type: 'kicked'; message: string }
  | { type: 'all_messages_deleted'; count: number };
```

자세한 타입 정의: `src/schema.js`

---

## 4. 에러 응답 형식

모든 JSON 에러는 다음 형식을 따릅니다 (`src/utils/errors.js`):
```json
{ "error": "에러 메시지" }
```

**상태 코드**:
- `200` — 성공
- `204` — 성공 (본문 없음)
- `400` — 잘못된 요청
- `401` — 인증 필요/실패
- `403` — 권한 없음
- `404` — 리소스 없음
- `409` — 충돌 (중복 등)
- `410` — 소진됨 (Dead Drop 등)
- `429` — Rate Limit
- `500` — 서버 오류
- `503` — 일시 장애
- `504` — 타임아웃

---

## 5. Rate Limit 상수

| 엔드포인트 | 윈도우 | 최대 |
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
| `/ws` (연결) | 60s | 30 |
| 메시지 (WS) | 1s 쿨다운 | 분당 30개 슬라이딩 |
| 관리자 로그인 | 5min | 5회 실패 시 차단 |

상수 위치: `src/config/constants.js`
