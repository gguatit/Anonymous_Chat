# API 명세

43개 HTTP 엔드포인트의 명세입니다. 모든 응답은 CORS 헤더를 포함합니다 (`src/config/cors.js`).

**기본 URL**: `https://api.kalpha.kr` (프로덕션) | `http://localhost:8788` (개발)

---

## 1. 공개 엔드포인트 (20개)

### 1.1 WebSocket

#### `GET /ws`
WebSocket 업그레이드 엔드포인트.

**Query**:
- `sessionId` (required) — `user_<uuid>_<ts>` 형식
- `channel` (optional) — 채널 slug (생략 시 메인룸)

**Headers**:
- `Origin` — CORS 검증
- `Upgrade`, `Connection` — WebSocket 표준

**참고**:
- 사전 차단 확인을 위해 `/api/check-ban`을 먼저 호출합니다
- 내부적으로 `X-Admin-Internal-Token` (HMAC_SECRET) 헤더를 DO에 전달

**메시지 프로토콜**: [ARCHITECTURE.md §WebSocket 메시지 타입](./ARCHITECTURE.md#2-chatroom-durable-object-srcdurable-objectschatroomjs-1080줄)

---

### 1.2 채팅 데이터

#### `GET /api/announcements`
공지 히스토리 조회 (비인증).

**Response 200**:
```json
[
  {
    "id": "ann_1717890123_abc",
    "content": "서버 점검 안내",
    "isEmergency": false,
    "createdAt": 1717890123000,
    "createdBy": "admin"
  }
]
```

#### `GET /api/emergency-announcement`
현재 활성 긴급공지 1개.

**Response 200**:
```json
{
  "id": "ann_...",
  "content": "긴급 점검 중",
  "isEmergency": true,
  "emergencyUntil": 1717893723000
}
```

**Response 204**: 활성 긴급공지 없음

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
{ "mode": "summary" | "topic" | "mood" | "conflict" }
```

**Response 200**:
```json
{ "success": true, "messageId": "msg_..." }
```

**Errors**:
- `429`: 레이트 리밋 (15초 1회)
- `503`: AI 모델 일시 장애 (fallback 시도 후 실패)

**Response는 `type:'summary'` WebSocket 메시지로 모든 세션에 broadcast됨.**

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
  "url": "https://file.kalpha.kr/files/abc123.png",
  "filename": "image.png",
  "filetype": "image/png",
  "size": 102400
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
    { "slug": "kalpha", "name": "kalpha", "createdAt": 1717890123, "lastActive": 1717893723 }
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
{ "message": "...", "storedAt": 1717890123 }
```

**Errors**:
- `404`: 존재하지 않거나 만료
- `410`: 이미 읽음 (1회용)

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
  "sessionId": "user_..."
}
```

**Body (FCM)**:
```json
{ "token": "fcm_token", "type": "fcm", "sessionId": "user_..." }
```

**Response 200**:
```json
{ "success": true }
```

#### `POST /api/push/unsubscribe`
푸시 구독 해제.

**Body**:
```json
{ "endpoint": "..." }
```

**Response 200**:
```json
{ "success": true }
```

---

### 1.7 보안

#### `POST /api/turnstile/verify`
Cloudflare Turnstile 토큰 검증.

**Body**:
```json
{ "token": "..." }
```

**Response 200**:
```json
{ "success": true }
```

**Response 400**:
```json
{ "success": false, "error": "..." }
```

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
  "totalMessages": 12345,
  "totalConnections": 67890,
  "errors": 3
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

## 2. 관리자 엔드포인트 (23개, Bearer 인증)

모든 `/api/admin/*` 엔드포인트는 `Authorization: Bearer <token>` 헤더 필요 (단, `login`/`logout` 제외).

**인증 흐름**:
1. `POST /api/admin/login` → 토큰 발급
2. `Authorization: Bearer <token>` 헤더로 후속 요청
3. 토큰 2시간 만료, `revokeToken()`으로 무효화 가능

### 2.1 인증

#### `POST /api/admin/login`
**인증 불필요**

**Body**:
```json
{ "id": "admin", "password": "..." }
```

**Response 200**:
```json
{ "token": "...", "expiresAt": 1717897323000 }
```

**Errors**:
- `401`: 자격 증명 오류
- `429`: 5분 내 5회 실패 시 차단

#### `GET /api/admin/verify`
**인증 필요**

**Response 200**:
```json
{ "valid": true }
```

#### `POST /api/admin/logout`
**인증 불필요** (토큰 폐기)

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
  "banDuration": 0,
  "reason": "스팸"
}
```

**`banDuration` 값**:
- `0` — 영구
- `30` — 30초
- `300` — 5분
- `600` — 10분

**Response 200**:
```json
{ "success": true, "permanent": false }
```

#### `POST /api/admin/unban-ip`
**인증 필요**

**Body**:
```json
{ "ip": "1.2.3.4" }
```

**Response 200**:
```json
{ "success": true }
```

#### `GET /api/admin/banned-ips`
**인증 필요**

**Response 200**:
```json
{
  "bannedIPs": [
    { "ip": "1.2.3.4", "bannedAt": 1717890123, "expiresAt": 1717893723, "reason": "..." }
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
  "scheduleAt": 1717890123,
  "expiresAt": 1717893723
}
```

**PUT Body** (수정):
```json
{
  "id": "ann_...",
  "content": "수정된 공지",
  "isEmergency": false
}
```

**DELETE Body** (삭제):
```json
{ "id": "ann_..." }
```

**Response 200**:
```json
{ "success": true, "id": "ann_..." }
```

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
- `action` (optional) — `kick_user`, `edit_message`, `delete_message`, `send_announcement`, `unban_ip`, `admin_delete_all_messages`, `edit_announcement`, `delete_announcement`, `channel_delete`

**Response 200**:
```json
{
  "logs": [
    { "id": 1, "action": "kick_user", "details": "...", "metadata": {...}, "timestamp": 1717890123 }
  ]
}
```

#### `POST /api/admin/delete-audit-logs`
**인증 필요**

**Response 200**:
```json
{ "success": true, "deletedCount": 50 }
```

#### `GET /api/admin/delete-error-logs`
**인증 필요** — 오류 로그 조회

**Response 200**:
```json
{
  "logs": [
    { "id": 1, "type": "TypeError", "message": "...", "stack": "...", "location": "chat.js:123", "timestamp": 1717890123 }
  ]
}
```

**참고**: 명세상 `GET`만 지원 (응답 본문). 삭제도 동일 엔드포인트 사용 시 `POST` (별도 확인 필요).

---

## 3. WebSocket 메시지 프로토콜

### 3.1 클라이언트 → 서버 (inbound)

```typescript
type ClientMessage =
  | { type: 'ping' }
  | { type: 'join'; sessionId: string; isReconnect?: boolean; nickname?: string }
  | { type: 'message'; content: string; targetSessionId?: string; signature?: string }
  | { type: 'edit'; messageId: string; content: string; signature?: string }
  | { type: 'delete'; messageId: string }
  | { type: 'reaction'; messageId: string; emoji: string }
  | { type: 'typing'; isTyping: boolean };
```

### 3.2 서버 → 클라이언트 (outbound)

```typescript
type ServerMessage =
  | { type: 'pong' }
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
| `/metrics` | 60s | 60 |
| `/health` | 60s | 120 |
| `/api/config` | 60s | 30 |
| `/api/turnstile/verify` | 60s | 10 |
| `/api/upload` | 60s | 20 |
| `/api/push/*` | 60s | 10 |
| `/api/check-ban` | 60s | 30 |
| `/api/logs/error` | 60s | 30 |
| `/api/preview` | 10s (IP) | 5 |
| `/api/summary` | 15s | 1 |
| 메시지 (WS) | 1s 쿨다운 | 분당 30개 슬라이딩 |
| 관리자 로그인 | 5min | 5회 실패 시 차단 |

상수 위치: `src/config/constants.js`
