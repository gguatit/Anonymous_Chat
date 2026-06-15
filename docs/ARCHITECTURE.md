# 아키텍처

Anonymous Chat의 시스템 아키텍처 및 데이터 흐름입니다.

## 시스템 개요

```
┌──────────────────────────────────────────────────────────────┐
│                        Cloudflare Edge                       │
│  ┌──────────┐      ┌──────────┐      ┌──────────────────┐   │
│  │   DNS    │ ───► │  Pages   │ ───► │  Worker (Pages   │   │
│  │          │      │  (CDN)   │      │  Functions)      │   │
│  └──────────┘      └──────────┘      └────┬─────────────┘   │
│                                            │                  │
│        ┌───────────────────────────────────┼────────────┐    │
│        │                                   │            │    │
│        ▼                                   ▼            ▼    │
│  ┌──────────┐  ┌──────────────────┐  ┌──────────┐  ┌──────┐ │
│  │ChatRoom  │  │ ChannelRegistry  │  │DeadDrop  │  │  D1  │ │
│  │   DO     │  │       DO         │  │Store DO  │  │      │ │
│  │(채널당)  │  │   (singleton)    │  │(singleton)│  │      │ │
│  └────┬─────┘  └──────────────────┘  └──────────┘  └──────┘ │
│       │                                                       │
│       ├────► KV (푸시 구독)                                   │
│       ├────► Workers AI (요약)                                │
│       └────► 외부 API (Kalpha: 파일/보안헤더)                │
└──────────────────────────────────────────────────────────────┘
```

## 컴포넌트

### 1. Worker (`src/worker.js`, 374줄)

Cloudflare Pages Functions 진입점. HTTP 라우팅, WebSocket 업그레이드, 정적 자산 폴백 처리.

**라우트 테이블**:
- 20개 공개 엔드포인트 (`/api/*`, `/ws`, `/metrics`, `/health`)
- 23개 관리자 엔드포인트 (`/api/admin/*`)
- SPA fallback: 미매칭 경로 → `/index.html` (404는 `ASSETS.fetch`가 반환)

**주요 헬퍼**:
- `matchRoute(routes, pathname, method)` — 선언적 라우트 매칭
- `channelRequest()` — 3개 채널 핸들러 통합 (DRY)
- `serveStaticAssets()` — ASSETS 바인딩 + SPA fallback
- `checkRateLimit()` — Lazy-init rate-limiter (Workers 호환)

### 2. ChatRoom Durable Object (`src/durable-objects/ChatRoom.js`, 1080줄)

핵심 WebSocket 핸들러. 채널당 1개 인스턴스 (메인룸 1 + 채널 N).

**책임**:
- WebSocket 세션 관리 (`sessions` Map, `ipConnections` Map)
- 메시지 저장 (DO Storage 12시간, 최대 500개)
- 차단 (IP + SessionID)
- 공지/긴급공지/스케줄링
- 메시지 반응 (이모지 토글)
- 푸시 알림 (오프라인 사용자)
- AI 요약 (Workers AI 호출)
- 자동 정리 (5분 주기)

**보조 모듈**:
- `chat-room/admin.js` (808줄) — 18개 `/admin/*` 라우트
- `chat-room/messages.js` (184줄) — 검증, 검색, AI sanitization
- `chat-room/announcements.js` (5줄) — `isEmergencyActive` 헬퍼

**WebSocket 메시지 타입**:
- Inbound (7): `ping`, `join`, `message`, `edit`, `delete`, `reaction`, `typing`
- Outbound (17): `pong`, `banned`, `history`, `announcement`, `system`, `error`, `message`, `message_edited`, `message_deleted`, `message_reaction`, `typing`, `user_count`, `emergency_cleared`, `summary`, `kicked`

### 3. ChannelRegistry Durable Object (`src/durable-objects/ChannelRegistry.js`, 261줄)

채널 메타데이터 싱글톤. slug → 채널 정보 매핑.

**책임**:
- 채널 생성/조회/삭제
- lastActive 갱신
- 빈 채널 자동 정리 (10분 TTL)
- 관리자 채널 목록/강제 삭제

### 4. DeadDropStore Durable Object (`src/durable-objects/DeadDropStore.js`, 127줄)

1회성 비밀 메시지 싱글톤.

**특징**:
- 30분 TTL
- 1회 읽기 후 영구 삭제
- 10,000자 제한
- 404/410으로 만료/소진 구분

### 5. 핸들러 (`src/handlers/`)

| 파일 | 줄 | 책임 |
|---|---|---|
| `admin.js` | 458 | 23개 `/api/admin/*` 핸들러 (withAuth 미들웨어) |
| `websocket.js` | 112 | WebSocket 업그레이드 + 차단 사전 확인 |
| `push.js` | 270 | VAPID/FCM 구독 관리 + 발송 |
| `summary.js` | 159 | Workers AI 요약 (4 모드, 15초 레이트리밋) |
| `preview.js` | 126 | OG 태그 스크래퍼 (Edge cache 1시간) |
| `turnstile.js` | 67 | Cloudflare Turnstile 검증 |
| `health.js` | 15 | `/health`, `/metrics` |

### 6. 미들웨어/유틸 (`src/middleware/`, `src/utils/`)

| 파일 | 책임 |
|---|---|
| `middleware/auth.js` | HMAC 토큰 발급/검증, Rate limit |
| `utils/do.js` | DO 라우팅 (`getChatRoom`, `getChannelRoom`, `forwardToDO`) |
| `utils/validate.js` | 메시지/채널/닉네임/세션/Dead Drop 검증 |
| `utils/errors.js` | `jsonError`, `jsonSuccess`, `textError`, `emptyResponse` |
| `utils/helpers.js` | `sanitizeInput`, HMAC 헬퍼, `safeJson` |
| `utils/rate-limiter.js` | 메모리 기반 윈도우 카운터 |
| `utils/security.js` | `constantTimeCompare`, `isAllowedOrigin` |
| `utils/logger.js` | D1 admin/audit/error 로거 |
| `utils/web-push.js` | VAPID JWT + RFC 8291 암호화 |
| `utils/fcm-auth.js` | Google OAuth JWT for FCM v1 |
| `config/constants.js` | 모든 매직 넘버 (서버+클라이언트 공유) |
| `config/cors.js` | CORS 헤더 |

## 데이터 흐름

### 1. 메시지 전송 (가장 빈번한 경로)

```
┌──────┐                              ┌──────┐
│Client│                              │Server│
└──┬───┘                              └──┬───┘
   │ 1. WS: {type:'message',           │
   │     content, targetSessionId?}    │
   │────────────────────────────────►   │
   │                                    │ 2. ChatRoom.handleMessage
   │                                    │    - validateClientMessage
   │                                    │    - checkRateLimit (1s/30min)
   │                                    │    - generateSignature (HMAC)
   │                                    │    - storage.put('messages')
   │                                    │    - broadcast({...signature})
   │                                    │
   │ ◄─────────────────────────────────│
   │ 3. broadcast: all sessions        │
   │                                    │
   │ 4. throttledPushNotification      │
   │    - 1.5s throttle                 │
   │    - sendPushToOfflineUsers       │
   │      (KV 구독자 순회, VAPID/FCM)
```

### 2. WebSocket 핸드셰이크

```
Client                          Worker                       ChatRoom DO
  │                                │                              │
  │ GET /ws?sessionId=&channel=    │                              │
  │─────────────────────────────►  │                              │
  │                                │ 1. Origin 검증               │
  │                                │ 2. sessionId 검증 (정규식)    │
  │                                │ 3. /api/check-ban (preflight)│
  │                                │───────────────────────────►  │
  │                                │                              │ 4. checkBan
  │                                │ ◄────────────────────────────│
  │                                │ 5. upgrade → DO              │
  │ ◄──────────────────────────────│                              │
  │ 101 Switching Protocols        │                              │
  │                                                              │
  │ WS: {type:'join', sessionId}                                 │
  │─────────────────────────────────────────────────────────────►│
  │                                                              │ 6. handleJoin
  │                                                              │    - storage에서 세션 복원
  │                                                              │    - 50개 히스토리 배치 전송
  │                                                              │    - broadcast user_count
  │ ◄────────────────────────────────────────────────────────────│
  │ WS: {type:'history', messages: [...]}                       │
  │ WS: {type:'user_count', count: 12}                          │
```

### 3. 채널 생성/참가

```
Client                          Worker                  ChannelRegistry DO
  │                                │                              │
  │ POST /api/channels/create      │                              │
  │ {name:'kalpha'}                │                              │
  │─────────────────────────────►  │                              │
  │                                │ channelRequest('create')     │
  │                                │  - X-Admin-Internal-Token    │
  │                                │───────────────────────────►  │
  │                                │                              │ 1. toSlug('kalpha')
  │                                │                              │ 2. 중복 체크
  │                                │                              │ 3. storage.put
  │                                │                              │ 4. persist (5초마다)
  │                                │ ◄────────────────────────────│
  │                                │ {slug, name, createdAt}      │
  │ ◄──────────────────────────────│                              │
  │ {success, slug}                │                              │
  │                                                              │
  │ POST /api/channels/join        │                              │
  │ {slug:'kalpha'}                │                              │
  │─────────────────────────────►  │                              │
  │                                │ channelRequest('join')       │
  │                                │───────────────────────────►  │
  │                                │                              │ 1. lastActive 갱신
  │                                │                              │ 2. /touch
  │                                │ ◄────────────────────────────│
  │ ◄──────────────────────────────│                              │
  │ {success}                      │                              │
  │                                                              │
  │ GET /ws?channel=kalpha        (다음 연결)                    │
```

### 4. AI 요약

```
Client                          Worker                  ChatRoom DO         Workers AI
  │                                │                       │                    │
  │ POST /api/summary              │                       │                    │
  │ {mode:'summary'}               │                       │                    │
  │─────────────────────────────►  │                       │                    │
  │                                │ 1. Rate limit (15s)   │                    │
  │                                │ 2. fetch /messages/recent              │
  │                                │  (HMAC 인증)          │                    │
  │                                │───────────────────►  │                    │
  │                                │                       │ 1. sessionId 제거 │
  │                                │ ◄─────────────────────│                    │
  │                                │ {messages: [50개]}    │                    │
  │                                │                                            │
  │                                │ 3. env.AI.run(model, prompt)              │
  │                                │───────────────────────────────────────────►│
  │                                │                       │                    │ 4. Qwen 추론
  │                                │ ◄─────────────────────────────────────────│
  │                                │ {response}                                  │
  │                                │                                                       │
  │                                │ 5. /broadcast-summary                                   │
  │                                │  (HMAC)              │                    │
  │                                │───────────────────►  │                    │
  │                                │                       │ 6. type:'summary'  │
  │                                │                       │    모든 세션에    │
  │ ◄──────────────────────────────│ ◄─────────────────────│   broadcast       │
  │ WS: {type:'summary', text}     │                       │                    │
```

### 5. 푸시 알림 (오프라인 사용자)

```
ChatRoom DO                        Push Handler                  Push Service
     │                                  │                              │
     │ 1. 메시지 broadcast 후            │                              │
     │    throttledPushNotification      │                              │
     │────────────────────────────────►  │                              │
     │                                  │ 2. KV.list() (구독자 순회)   │
     │                                  │ 3. sendPushToOfflineUsers   │
     │                                  │ 4. onlineSessionIds 제외    │
     │                                  │                              │
     │                                  │ VAPID:                       │
     │                                  │  - ECDH + aes128gcm         │
     │                                  │─────────────────────────────►│ Web Push
     │                                  │                              │
     │                                  │ FCM:                         │
     │                                  │  - getFCMAccessToken         │
     │                                  │  - send FCM v1               │
     │                                  │─────────────────────────────►│ FCM
     │                                  │                              │
     │                                  │ 5. 404/410 → KV 정리        │
```

## 보안 경계

### 인증 토큰 종류
1. **관리자 토큰** (`auth.js`): `HMAC(secret, base64(id:ts))` 형식. 2시간 만료. KV에 revocation 저장.
2. **내부 토큰** (`worker.js` ↔ DO): `X-Admin-Internal-Token` 헤더 = `HMAC_SECRET`. SSRF 방지.
3. **메시지 서명** (`ChatRoom.js`): `HMAC(secret, JSON.stringify({content, sessionId, timestamp}))`. 변조 방지.

### Rate Limiting
- **전역**: `src/utils/rate-limiter.js` (per-worker 인메모리, 5분 cleanup)
- **엔드포인트별**: `API_RATE_LIMIT` 상수 (config, push, turnstile, upload, health, check-ban)
- **사용자별**: ChatRoom (1초 쿨다운, 분당 30개 슬라이딩 윈도우)
- **관리자 로그인**: `checkRateLimit`/`incrementRateLimit` (5회/5분 차단)

### 입력 검증
- **메시지**: `validateClientMessage` (type별 분기)
- **Dead Drop**: `validateDeadDropMessage` (10000자)
- **채널명**: `validateChannelName` (≤20자, trim)
- **닉네임**: `validateNickname` (≤12자, trim)
- **sessionId**: `validateSessionId` (`[a-zA-Z0-9_-]{1,200}`)
- **파일**: `validateFileInfo` (url/filename/filetype 길이)
- **상수**: `sanitizeInput` (제어문자 제거 + 줄바꿈 정규화)

### 데이터 보존
- **메시지**: 12시간 (메모리 + DO Storage)
- **공지**: 영구 (메모리 + DO Storage)
- **Dead Drop**: 30분 TTL, 1회 읽기 후 삭제
- **감사/관리자/오류 로그**: D1 (영구, 30일 자동 정리)
- **푸시 구독**: 30일 TTL (KV)
- **차단**: 시간 설정에 따라 만료 (영구 옵션)

## 빌드 파이프라인

```
src/worker.js (ESM)
        │
        ▼
functions/_middleware.js (re-export)
        │
        ▼
Cloudflare Pages Functions (Worker runtime)

public/js/chat.js + 19 modules
        │
        ▼ esbuild
public/js/chat.bundle.js (40KB)

public/js/admin.js + 9 helpers
        │
        ▼ esbuild
public/js/admin.bundle.js (15KB)

public/css/tailwind.min.css (CDN) → 빌드 버전
```

## 성능 특성

- **메시지 히스토리 로딩**: 50개, 500ms → 20ms (25배, DocumentFragment)
- **이벤트 리스너**: 메시지당 5-6개 → 컨테이너 5개 (위임)
- **Tailwind**: 300KB CDN → 45KB 빌드
- **번들**: 19개 모듈 → 2개 (chat, admin)
- **WS Reconnect**: 지수 백오프, 최대 10회/30s
- **AI Timeout**: 8초 + 15초 레이트리밋
- **OG Cache**: 1시간 Edge + 50개 클라이언트 메모리
- **푸시 Throttle**: 1.5초 (debounce)

## 확장 포인트

- **새 DO**: `src/durable-objects/`에 추가, `wrangler.toml` `[[durable_objects.bindings]]` 등록
- **새 라우트**: `worker.js` `routes` 배열에 추가
- **새 핸들러**: `src/handlers/`에 모듈 추가, `worker.js`에서 import
- **새 상수**: `src/config/constants.js`에 추가 (서버+클라이언트 공유)
- **새 테마**: `themes.css`에 CSS Custom Properties 추가, `theme.js` `THEMES` 배열에 추가
- **새 mixin**: `public/js/ui-*.js` 생성, `ui.js` 끝에서 `Object.assign`으로 부착
