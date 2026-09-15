# Anonymous_Chat 심층 분석 보고서

> 작성일: 2026-09-14
> 분석 대상: HEAD `9c0b12c` (2026-07-23)
> 범위: 서버(Worker + Durable Objects + 핸들러), 클라이언트(public/js + HTML + PWA), 테스트, 문서, 배포/운영
> 성격: 읽기 전용 분석. 본 보고서 작성 시점에 코드는 수정되지 않았습니다.

---

## 1. 요약

**총평: 아키텍처 설계는 견고하나, 접근 제어와 클라이언트 출력 이스케이프에 구조적 결함이 있으며, 운영 파이프라인(린트/CI/배포 문서)이 실제 코드와 어긋나 있습니다.**

- **심각도 분포**: CRITICAL 3건, HIGH 11건, MEDIUM 18건, LOW 15건
- **가장 위험한 축 2가지**
  1. **인증/권한 경계 붕괴** — 익명 사용자가 `sessionId` 문자열 조작만으로 관리자 옵저버가 되고(CRITICAL), 공개된 `sessionId`로 타인 세션을 탈취할 수 있습니다(CRITICAL).
  2. **저장형 XSS → 관리자 토큰 탈취** — 따옴표를 이스케이프하지 않는 `escapeHtml`과 `unsafe-inline` CSP가 결합해, 공개 엔드포인트(`/api/logs/error`)를 통해 관리자 화면에서 스크립트가 실행됩니다(CRITICAL).
- **긍정 요소**: 계층적 메시지 검증, 세션별 임시 시크릿 기반 HMAC, DO 관리자 표면의 HMAC 게이트, DeadDrop의 레이스 프리 읽기, 의존성 없는 Web Push/FCM 구현, 빠른 테스트 스위트(320건/~10초) 등 설계 수준의 보안 장치는 다수 존재합니다.
- **운영 리스크**: `npm run lint`가 생성물 파일 때문에 실패해 `npm run build` 자체가 깨져 있고, CI가 없으며, 배포 문서가 Pages와 Worker를 혼용하고 있어 문서대로 배포하면 바인딩/마이그레이션이 누락됩니다.

### 아키텍처 한눈에 보기

```
[브라우저]
  ├─ chat.bundle.js ── WebSocket(/ws) ──┐
  ├─ admin-*.bundle.js ─ REST(/api/admin/*) ──┐
  └─ PWA(sw.js: 푸시 전용)                    │
                                              ▼
[Cloudflare Worker: src/worker.js]  ← HTTP→HTTPS, CORS, 레이트리밋, 정적 자산
  ├─ /api/admin/*  → handlers/admin.js (admin 토큰) → forwardToDO (X-HMAC-Secret)
  ├─ /ws           → handlers/websocket.js (Upgrade/Origin/ban 사전검사) → ChatRoom
  └─ 공개 라우트    → announcements / channels / push / search / preview / secret 등
                                              │
        ┌─────────────────────────────────────┼─────────────────────┐
        ▼                                     ▼                     ▼
  [ChatRoom DO ×N]                    [ChannelRegistry DO]    [DeadDropStore DO]
  main-room + channel:<slug>          채널 메타데이터 싱글턴    1회 읽기 시크릿 싱글턴
  메시지/밴/공지/세션 (KV 등)          (SQLite)                (SQLite)
        │
        ├─ D1(DB_ADMIN): admin_activity_logs, audit_logs, error_logs, security_events
        ├─ KV: ADMIN_TOKENS, PUSH_SUBSCRIPTIONS
        ├─ Workers AI: /summary (/topic · /mood · /conflict)
        └─ Web Push(VAPID) / FCM v1
```

---

## 2. 방법론

- **병렬 심층 조사 4개 영역**: (A) 서버 코어(worker/middleware/utils/config), (B) DO·핸들러, (C) 클라이언트·PWA·CSP, (D) 테스트·문서·운영
- **직접 코드 검증**: CRITICAL/HIGH 항목은 소스 라인을 직접 열어 확인(예: 옵저버 분기 `ChatRoom.js:313`, `/ban-ip` 라우트 부재, `escapeHtml` 구현, lint 실행 결과)
- **테스트 실행**: `npx vitest run` → 22파일 / 320건 전부 통과(~10초)
- **린트 실행**: `npm run lint` → 294 errors로 실패(원인은 §6.1)
- 증거는 모두 `파일:라인` 형식으로 표기

---

## 3. 심각도 요약

| 심각도 | 건수 | 대표 항목 |
|---|---:|---|
| CRITICAL | 3 | 옵저버 무인증(C1), 세션 하이재킹(C2), 저장형 XSS→토큰 탈취(C3) |
| HIGH | 11 | 콜드 DO 상태 소실(H1), 토큰에 비밀번호 임베드(H2), KV 128KiB 한계(H3), 밴 메인룸 전용(H4), `/ban-ip` 부재(H5), Origin prefix(H6), 푸시 소유권(H7), 본문 크기검사(H8), 시크릿 ID 로깅(H9), 배포 모순(H10), 핵심 경로 무테스트(H11) |
| MEDIUM | 18 | SSRF(M1), 레이트리밋 누락(M2), Turnstile 미강제(M5), 채널 라이프사이클(M6), 요약 스코프(M9), HMAC 재전송(M10), fail-open(M11), lint 파괴(M13), 문서 드리프트(M14) |
| LOW | 15 | CORS PUT(L1), 메서드 무구분(L2), 하드코딩 URL(L3), 죽은 코드(L7), 성능(L10) 등 |

**공격 체인 요약(가장 중요)**

```
C1: /ws?sessionId=admin_obs_*  (무인증)
      → 모든 메시지 200자 + sessionId + 원본 IP 수신
            ↓  sessionId 대량 수집
C2: /ws?sessionId=<피해자>     (기존 secret 재수신 + 라우팅 탈취)
      → 피해자 사칭, 메시지 수정/삭제, 응답 가로채기

C3: POST /api/logs/error (공개, 임의 경로 저장)
      → 관리자 보안센터 innerHTML 미이스케이프 실행
            → localStorage.admin_token 탈취 → 전체 관리자 API 장악
```

---

## 4. CRITICAL 상세

### C1. 관리자 옵저버 무인증 백도어

- **위치**: `src/durable-objects/ChatRoom.js:313`, `:359-368`
- **내용**: `isObserver`가 세션 ID 접두사 문자열만 검사합니다.

```js
const isObserver = (wsUrl.searchParams.get('sessionId') || '').startsWith('admin_obs_');
```

토큰·HMAC 등 어떤 증명도 요구하지 않으며, 조건을 만족하면 관찰자 집합에 등록됩니다. 이후 `broadcastToObservers`로 다음이 무필터 스트리밍됩니다.

| 이벤트 | 노출 데이터 | 위치 |
|---|---|---|
| `message_created` | 본문 앞 200자 + `sessionId` | `ChatRoom.js:849-855` |
| `user_left` | **원본 IP** | `ChatRoom.js:483-487` |
| `user_joined` | 마스킹 IP, 닉네임 | `ChatRoom.js:614-619` |
| kick / unban / 채널삭제 | 대상·사유 등 | 각 어드민 액션 |

- **영향**: 익명 사용자가 `wss://<host>/ws?sessionId=admin_obs_1` 한 줄로 실시간 감시자가 됩니다. 여기서 수집한 `sessionId`는 곧바로 C2의 입력이 됩니다. 실제 관리자 클라이언트(`public/js/admin-core.js:172-175`)도 동일한 접두사 방식이라 서버가 토큰을 검증할 방법 자체가 없습니다.
- **수정 방향**: 옵저버 등록을 인증 경로로 분리 — 어드민 토큰을 HMAC으로 증명(`HMAC(token, sessionId)`)하거나, 관리자 전용 REST/WS 표면(예: `/api/admin/observe`)으로 이동.

### C2. 세션 하이재킹 (public sessionId + 시크릿 재사용)

- **위치**: `src/durable-objects/ChatRoom.js:646-655`(핸드셰이크), `:565-566`(소켓 교체), `:1240-1252`(히스토리 직렬화)
- **내용**:
  1. `sessionId`는 클라이언트가 생성해 저장하는 공개 식별자입니다. 히스토리 응답(`_serializeHistoryMessages`)·검색 결과·DOM 속성에 그대로 포함됩니다.
  2. 서버는 `sessionSecrets`에 이미 시크릿이 있으면 **같은 시크릿을 새 소켓에 다시 전송**합니다.
  3. 이어서 `this.sessions.set(sessionId, websocket)`으로 기존 소켓과 교체합니다.
- **영향**: 공격자가 피해자의 `sessionId`를 알면 (a) handshake secret을 수령해 서명 메시지를 피해자로 전송/수정/삭제할 수 있고, (b) `sendToSession` 라우팅을 가로채 피해자에게 오는 응답을 탈취합니다. 피해자가 재접속하면 공격자 소켓이 교체되지만, 그 반대(공격자가 나중 접속)는 항상 성립합니다. 원래 소켓의 close 가드(`:467`)도 매핑이 이미 교체된 경우 시크릿을 삭제하지 못합니다.
- **수정 방향**: 시크릿을 연결마다 회전시키고 새 소켓에는 재전송 금지, `sessionId`와 시크릿을 분리(서버 발급 불투명 ID 도입), 히스토리에서 `sessionId` 제거(작성자 표시는 별도 공개 ID 사용).

### C3. 저장형 XSS → 관리자 토큰 탈취 체인

- **근본 원인 (a) — `escapeHtml`이 따옴표를 이스케이프하지 않음**: `public/js/utils.js:1-5`는 `&`, `<`, `>`만 처리합니다. 그런데 이 함수가 인용부호가 있는 속성 컨텍스트에 광범위하게 쓰입니다.
  - `public/js/ui-render.js:463`, `:503`, `:535-543`: `alt="${fileName}"`, `download="${fileName}"` — 서버의 파일명 검증은 길이만 확인(`src/utils/validate.js:105-107`)하므로 `x" onerror="...` 가 통과합니다.
  - `public/js/pages/page-users.js:50`: `m.ip`, `nickname`, `User-Agent` 원시 삽입
  - `public/js/admin-ui.js:80`: `title="${escapeHtml(message)}"` — `/api/logs/error`가 **공개** 엔드포인트(`src/worker.js:367`)라 누구나 도구를 심을 수 있습니다.
  - `public/js/security-headers.js:153`, `public/js/og-preview.js:66`(인라인 `onclick`) 등
- **근본 원인 (b) — raw innerHTML**: `public/js/security-center.js:41-63`, `:109-116`이 `e.ip`, `e.path`, `e.details`, `e.user_agent`를 이스케이프 없이 테이블에 삽입합니다. `path`는 404 스캔 경로(공격자 제어)이며 `security_events` D1에 저장되므로 **저장형**입니다.
- **결합 조건 — CSP**: `public/_headers:16`의 `script-src`에 `'unsafe-inline'`과 `'unsafe-eval'`이 포함되어 인라인 핸들러·주입 스크립트가 모두 실행됩니다.
- **최종 도달점**: 관리자 토큰이 `localStorage('admin_token')`(`public/js/admin-core.js:16,32`)에 있어 XSS 1회로 2시간짜리 관리자 세션 전체가 탈취됩니다.
- **수정 방향**: `escapeHtml`에 `"`/`'` 이스케이프 추가(또는 `escapeAttr` 분리), 보안센터 렌더링을 `textContent` 기반으로 교체, CSP에서 `unsafe-inline`/`unsafe-eval` 제거(인라인 스크립트 nonce/hash 전환), 장기적으로 관리자 세션을 HttpOnly 쿠키로 전환.

---

## 5. HIGH 상세

### H1. 콜드 DO에서 관리자 라우트·`/check-ban`이 초기화 전에 실행

- `ChatRoom.fetch`에서 `dispatchAdminRoute`(`ChatRoom.js:183`)와 `/check-ban`(`:232-234`)이 `await this.initializeMessages()`(`:277`)보다 먼저 실행됩니다.
- 콜드 스타트 직후 `/admin/info`·`/admin/messages`는 빈 목록을, `/check-ban`은 `{banned:false}`(fail-open)를 반환합니다. 로드되지 않은 "만료" 밴을 삭제 처리할 수도 있습니다.
- 메인룸 WS 핸드셰이크는 이후에 다시 검사하므로 실차단은 유지되지만, **관리자 콘솔의 상태 표시와 사전 밴 조회가 거짓**이 됩니다. 수정: `fetch` 상단(HMAC 게이트 직후)에서 1회 초기화 보장.

### H2. 관리자 토큰에 비밀번호가 평문 임베드

- `src/middleware/auth.js:53` — `const data = \`${password}:${Date.now()}\`;` → `:69` `btoa(data)`가 페이로드. 호출부(`src/handlers/admin.js:128`)는 `id + ':' + password`를 넘깁니다.
- 토큰을 base64 디코드하면 `ADMIN_PASSWORD`가 그대로 나옵니다. 서명 비교도 `:119`에서 `===`(비상수시간)입니다(`constantTimeCompare`는 `src/utils/security.js:9`에 이미 존재).
- TTL 2시간, `jti` 없음, 비밀번호를 바꿔도 기존 토큰은 만료까지 유효합니다. `revokeToken`(`auth.js:44`)은 테스트에서만 쓰이고 실제 로그아웃은 KV put을 재구현합니다.
- 수정: 불투명 랜덤 토큰 + 서버측 세션(ADMIN_TOKENS) + 회전/일괄 폐기(비밀번호 변경 에포크).

### H3. `messages` 단일 KV 값 128KiB 한계 — 채팅 전체 쓰기 정지 가능

- `ChatRoom.js:839-845`: 메시지 배열을 `slice(MAX_STORED_MESSAGES=2000)` 후 `storage.put('messages', this.messages)` **한 키**로 저장합니다. ChatRoom은 KV 기반 DO(`wrangler.toml` v1 `new_classes`)라 값 상한이 128KiB입니다.
- 메시지 객체 ~300–400B 기준 수백 건이면 즉시 초과 → `put` 거부 → `broadcast(message)`(`:847`) 이전에 예외 → **전송·수정·삭제·반응 등 모든 쓰기가 실패**하고 히스토리가 동결됩니다.
- 수정: 타임버킷 키로 샤딩(`messages:<bucket>`), 바이트 기준 절단, 또는 SQLite 스토리지 클래스로 마이그레이션.

### H4. 밴 강제·킥이 메인룸 전용

- `src/handlers/websocket.js:35`는 채널 참여 요청이어도 `ROOM_NAME`(main-room) 기준으로만 밴을 조회합니다. 어드민 kick도 `forwardToDO`=메인룸 고정(`src/handlers/admin.js:383-386`, `src/utils/do.js:3-6`).
- 결과: 메인룸에서 밴된 사용자가 임의 `channel:<slug>`에 자유롭게 접속하고, 채널 접속자 킥은 404가 됩니다. 채널별 밴 상태는 워커 경로로 도달할 수 없습니다.
- 수정: `/check-ban`·kick에 채널 인자 전달, 채널 DO로 라우팅, 또는 밴을 레지스트리로 중앙화.

### H5. `/ban-ip` 라우트 부재 — 보안센터 "IP 차단" 무동작 (검증 완료)

- `src/handlers/security.js:295-304`의 `blockRecommendedIP`는 DO에 `/ban-ip`를 호출하지만, `ChatRoom`에 해당 라우트가 없습니다(grep 결과 `unban-ip`만 존재: `chat-room/admin.js:105`). 요청은 WS 경로로 낙하해 `CF-Connecting-IP` 부재로 400을 반환하고, 핸들러는 응답 상태를 무시하고 `{success:true, action:'banned'}`를 돌려줍니다.
- 수정: `/ban-ip` 라우트 추가(또는 호출 제거), `resp.ok` 검사.

### H6. Origin 허용 로직: prefix 매치 + localhost 무조건 허용 + Origin 부재 시 통과

- `src/utils/security.js:39` `origin.startsWith(allowed)` → `https://kalpha.mmv.kr.evil.com` 통과. `:35`는 모든 localhost/127.0.0.1을 무조건 신뢰. `src/handlers/websocket.js:13`은 `if (origin && ...)`로 **헤더가 없으면 검사를 생략**합니다.
- HTTP CORS는 정확 매치(`src/config/cors.js:5`)라 두 체계가 불일치합니다. 수정: `new URL(origin).origin` 정확 비교, localhost는 개발 환경 한정, `/ws`는 Origin 필수 + fail-closed.

### H7. 푸시 구독 소유권 미검증

- `src/handlers/push.js:67-88`: KV 키가 `'sub:' + sessionId`(클라이언트 제공, 공개값). unsubscribe는 임의 `sessionId`의 구독을 삭제할 수 있고, resubscribe는 endpoint 매칭으로 덮어씁니다.
- 영향: 공격자가 자기 endpoint를 피해자 `sessionId`로 등록 → 피해자 오프라인 알림 프리뷰(본문 100자) 수신, 또는 구독 삭제로 알림 무력화.
- 수정: WS 핸드셰이크 시크릿에서 파생된 서버 발급 토큰으로 구독을 바인딩.

### H8. 본문 크기 검사가 `Content-Length` 헤더에만 의존

- `src/utils/helpers.js:47-51`은 헤더 값만 비교 → chunked/헤더 부재 시 통과, 위조 가능합니다.
- 무제한 읽기 경로: `/api/secret-store`(`src/worker.js:147` `await req.text()`), `/api/logs/error`(`:371`), 업로드 프록시(`:318-364`)는 `new Headers(request.headers)`로 클라이언트 헤더를 전부 업로드 서비스로 전달합니다.
- 수정: 스트림 바이트 카운팅 리더로 상한 초과 시 중단.

### H9. DeadDropStore가 미열람 시크릿 ID 전체를 로그에 기록

- `src/durable-objects/DeadDropStore.js:120`: `not found` 로그에 `Object.keys(this.secrets)`를 출력합니다. ID 하나가 곧 열람 자격증명인데, 잘못된 `GET /api/secret-read?id=x` 한 번으로 전체 ID가 영속 로그(observability `persist=true`)에 남습니다.
- 수정: 요청 ID 해시 또는 개수만 기록.

### H10. 배포 대상 모순 (Worker vs Pages)

- `package.json:10`은 `wrangler deploy`(Worker, `main=src/worker.js` + `[assets]`)인데, `README.md:127,260`, `docs/DEPLOYMENT.md:194,245`, `CONTRIBUTING.md:214`, `pre-deploy-check.sh:42-50`은 전부 `wrangler pages deploy public`을 안내합니다. `functions/_middleware.js`는 `wrangler pages dev` 전용 브리지입니다.
- 문서를 따라 Pages로 배포하면 `wrangler.toml`의 KV/D1/DO 바인딩·마이그레이션이 적용되지 않습니다. 추가로 `docs/DEPLOYMENT.md:108`은 D1 바인딩을 `DB`로 표기(코드는 `DB_ADMIN`), `FILE_API_KEY`가 `.dev.vars.example`/DEPLOYMENT에 누락(없으면 업로드/다운로드 503), DO 마이그레이션 문법이 틀렸고(`[[durable_objects.migrations]]`), 빌드 스크립트 예시도 실제와 다릅니다.
- 수정: Worker+assets로 단일화하고 모든 문서/스크립트 정정.

### H11. 보안·메시지 핵심 경로가 사실상 무테스트

- 어떤 테스트도 다음을 import하지 않습니다: `src/worker.js`, `src/handlers/preview.js`, `src/handlers/summary.js`, `src/utils/web-push.js`, `src/utils/fcm-auth.js`, `src/utils/logger.js`.
- `test/web-push.test.js`는 헬퍼를 재구현해 자체 로직만 테스트(=프로덕션 코드 미검증), `test/worker-routes.test.js`는 라우트 배열을 하드코딩(이미 `/api/secret-store`, `/api/secret-read`, `/api/file/:id`, `security/events/:id` 누락).
- `handleWebSocket`과 `check-ban` 오류 경로(fail-open)도 미검증입니다. 수정: 실제 모듈 import + Worker 라우터 스모크 테스트.

---

## 6. MEDIUM

### 6.1 빌드/품질 (즉시 조치 권장)

- **M13 — lint 파괴**: `eslint.config.js`의 ignores에 `public/js/*.bundle.js`만 있고 `public/js/chunks/`가 없어, 생성물 294 errors(대부분 `no-var`/`prefer-const`, 183개 자동수정 가능)로 `npm run lint`가 실패합니다. 그 결과 `npm run build`(= `css && bundle && lint`)도 실패해 품질 게이트가 무력화되어 있습니다. (참고: complexity 경고 다수 — `worker.js` fetch 59, `ChatRoom.fetch` 42, `dispatchAdminRoute` 47 등)
- **M15 — CI 부재**: `.github/`가 없습니다. 320개 테스트·lint·시크릿 스캔이 로컬에서만 돌고, `pre-deploy-check.sh`는 `whoami` + `--dry-run`만 수행하며 Windows 개발 환경에서 bash 스크립트입니다.
- **M16 — 이중 락파일**: `bun.lock`과 `package-lock.json`이 모두 tracked. 문서는 전부 npm 기준인데 bun.lock이 수동 재동기화(commit `2e94698`)된 이력이 있어 드리프트 위험이 큽니다.
- **M17 — 빌드 산출물 커밋**: `public/js/*.bundle.js`, `chunks/`, 소스맵(578KB/170KB), `tailwind.min.css`가 tracked. `.gitignore`는 `dist/`만 제외합니다. 커밋 `8c5386b`("재빌드 누락")가 staleness 실증이며, `admin.bundle.js.map`은 짝이 없는 orphan입니다.

### 6.2 보안/서버

- **M1 — preview SSRF**: `handlers/preview.js`에 private/loopback/link-local/메타데이터 차단이 없고 `redirect: 'manual'`도 없어 리다이렉트를 추적합니다. `rateLimitMap`(`:10`)은 무한 증가, 본문 캡 검사가 마지막 청크 추가 후라 초과 가능(`:117-122`).
- **M2 — 레이트리밋 누락 라우트**: `/api/announcements`, `/api/emergency-announcement`, `/api/channels/*`, `/api/push/vapid-key`, `/api/search`, `/api/check-ban`(`API_RATE_LIMIT.CHECK_BAN` 정의만 되고 미사용), `/api/secret-read`, `/ws`. 특히 `secret-read`는 ID 추측 오라클입니다.
- **M3 — 레이트리미터 구조**: per-isolate 메모리 고정 윈도우(`utils/rate-limiter.js:7-10`), `setInterval` 정리 미보장, `destroy()` 미호출, 경계 버스트 2배.
- **M5 — Turnstile 미강제**: `handlers/turnstile.js`는 siteverify 프록시만 하고, `/ws`·채널 생성 등 어디에서도 검증 티켓을 요구하지 않아 봇이 위젯을 건너뛰고 직접 접속할 수 있습니다.
- **M6 — 채널 라이프사이클**: 생성 상한/레이트리밋 없음 + `data.sessionId` 신뢰(`ChannelRegistry.js:166-222`). 어드민 삭제는 레지스트리 항목만 지우고 DO `/destroy`를 호출하지 않아 삭제된 채널이 10분 TTL까지 히스토리·밴을 유지한 채 접속 가능합니다(`/ws?channel=`은 레지스트리 미조회).
- **M9 — 요약 기능**: `/messages/recent`가 메인룸 고정(`src/utils/do.js:3-6`)이라 채널 사용자도 메인룸 요약을 받고, 결과도 메인룸에 브로드캐스트됩니다. 채팅 원문을 필터 없이 프롬프트에 삽입(`summary.js:68-73`)해 프롬프트 인젝션 표면이 있고, `AI_SUMMARY.TIMEOUT_MS=8000`은 정의만 되고 미사용입니다.
- **M10 — 메시지 HMAC 한계**: 서명 대상이 `{content, sessionId, timestamp}`뿐이고 timestamp 신선도 미검증(재전송으로 중복 메시지 가능). `file`/`files`/`replyTo`는 서명 제외, edit은 `newContent`만 서명(`messageId` 미포함)이라 유효 서명을 다른 메시지에 전용 가능. `helpers.js:28`은 `===` 비교.
- **M11 — fail-open**: 밴 체크 오류 시 연결 지속(`websocket.js:62-65`), check-ban 오류 시 `banned:false`(`:114-119`), `ADMIN_TOKENS` KV 부재 시 차단하지 않음(`auth.js:6`), `incrementRateLimit` 무음 실패, D1 삭제 오류를 삼키고 success 반환(`admin.js:222-228`).
- **M12 — 검증 3중 중복**: `validate.js:6`과 `chat-room/messages.js:65`의 동명 `validateMessage`가 둘 다 호출되고(`ChatRoom.js:671,:759`), 길이·파일URL 재검사가 인라인으로 반복(`:960,:806,:824`). `validateNickname`은 미사용(닉네임은 `substring`).
- **M7 — D1 보존정책 없음**: `audit_logs`/`error_logs`는 무정리(`utils/logger.js:36-58`), `admin_activity_logs`(30일)·`security_events`(90일)만 확률적 정리.
- **M8 — 타이머 의존 정리**: `setInterval`(`ChatRoom.js:40`, `ChannelRegistry.js:19`) 기반이라 evict 시 정리가 유실되고 WS Hibernation(`state.acceptWebSocket`)을 못 씁니다. DeadDropStore는 주기 GC가 없어 단일 `secrets` JSON이 포화될 수 있습니다.

### 6.3 문서/계약

- **M14 — API 문서 드리프트**(`docs/API.md`): 엔드포인트 수가 51/43/20+23으로 제각각(실제 ~53 = 공개 22 + 관리자 31). `delete-error-logs`는 GET으로 표기됐지만 POST 전용(405), `summary`는 200 바디 표기지만 실제 204+WS, 업로드 응답 필드명 불일치(`full_url/filesize` vs `url/size`), 푸시 구독/해지 본문 스키마 불일치, DeadDrop 404/410 의미 반전, logout 인증 표기 오류 등.
- **M18 — 수치 드리프트**: README "112건" 3곳(`:7,:84,:182`)+"57건"(`:118`), DEVELOPMENT "112/10파일", CONTRIBUTING 112, PRESENTATION 112, CHANGELOG 마지막 항목이 21커밋 뒤(2026-06-22), FEATURE_IDEAS "332" — 실제 320/22파일.

---

## 7. LOW (요약표)

| # | 내용 | 위치 |
|---|---|---|
| L1 | CORS `Allow-Methods`에 PUT 누락(공지 수정은 PUT 사용) | `src/config/cors.js:11` vs `handlers/admin.js:403` |
| L2 | 라우트 메서드 `null`이 모든 HTTP 메서드 허용 → `DELETE /api/admin/logout`, `GET /api/admin/login` 등 핸들러 도달 | `src/worker.js:209` |
| L3 | 다운로드 프록시가 `file.kalpha.kr` 하드코딩(`FILE_UPLOAD_URL` 미사용, 업로드는 env 사용) | `src/worker.js:290` vs `:327` |
| L4 | dev origin이 8787로 등록됐으나 실제 dev 서버는 8788 | `constants.js:15-16` vs `package.json:8` |
| L5 | `hostname.includes('localhost')` 부분문자열 검사로 HTTPS 리다이렉트 우회 가능 | `src/worker.js:251` |
| L6 | 로그에 콘텐츠/식별자 노출(AI 응답 80자, raw sessionId, OAuth 오류 본문) | `summary.js:175`, `ChatRoom.js:732,747`, `fcm-auth.js:48` |
| L7 | 죽은 코드: 클라이언트 레거시 admin 8종 + `prism-bundle.js` + orphan map, 서버 `jsonSuccess`/`extractErrorMessage`/`validateNickname`/`revokeToken`/`UPLOAD.RATE_LIMIT`, `ApiClient.put/del`, `displayError` 인자 무시, `displayAnnouncement` 빈 함수, `enableDragAndDrop` 미호출 | 각 파일 |
| L8 | 클라이언트 중복: debounce ×4, showNotification ×3, 페이지 로컬 escapeHtml(따옴표 처리 불일치), 모달 show/hide 중복 | `page-logs.js:4` 등 |
| L9 | sw.js는 푸시 전용(캐싱 없음), manifest `share_target` 미구현(깨진 기능), `purpose:"any maskable"` 클리핑 위험 | `public/sw.js`, `manifest.json` |
| L10 | 성능: Prism+autoloader+highlight.js 풀빌드+테마 2개가 blocking(index.html:54-59)으로 이중 스택, sakura 35 DOM, evernight 동일 GIF 18장, 번들 133KB+소스맵 공개, 서버 상수 클라이언트 인라인 | `index.html`, `public/js/*` |
| L11 | WS 클라이언트 CONNECTING 가드 없음(병렬 소켓 가능), `_sendSigned` OPEN 검사~전송 사이 갭, `kick_token` localStorage+URL 노출 | `public/js/websocket.js:32,145-153,204-211` |
| L12 | D1 orphan 테이블 `admin_logs`(001, 002로 대체) | `migrations/001` |
| L13 | `.fva/` 미gitignore, SECURITY.md 신고 경로 모호(root vs docs SLA 48h/24h 불일치), docs/SECURITY.md 경로 오류·"strict CSP" 주장과 실제 불일치 | 각 문서 |
| L14 | `compatibility_date` 2025-05-28로 노후(workers-types 2026-07 대비), `ENVIRONMENT` var 미사용 | `wrangler.toml` |
| L15 | ARCHITECTURE.md 카운트 오류(관리자 23 vs 실제 31, WS 타입 17 vs 15, 번들 2 vs 10), worker.js를 Pages 진입점으로 프레이밍 | `docs/ARCHITECTURE.md` |

---

## 8. 강점 (설계 수준에서 유지해야 할 것)

1. **계층적 메시지 검증**: 형식 검사 → 길이(7500) → 1초 쿨다운 → 분당 30건 → 소유권+10분 수정창 → 이모지 화이트리스트(100개/이모지 캡). (`validate.js`, `chat-room/messages.js:65-93`, `ChatRoom.js:858-1108`)
2. **세션별 임시 시크릿 + 서버측 HMAC 검증**: 시크릿은 메모리에만 존재하고 서버가 모든 메시지/수정 서명을 재검증. (단, C2의 재사용 문제는 별도)
3. **DO 관리자 표면의 HMAC 게이트**: `/admin/*`, `/destroy`, `/messages/recent`, `/broadcast-summary`가 내부 토큰을 요구(`ChatRoom.js:165-170`), 레지스트리도 내부 토큰 검증.
4. **DeadDrop의 delete-before-response**: 레이스 프리 1회 읽기 + UUID 자격증명 + TTL.
5. **의존성 없는 Web Push 구현**: RFC 8291/8292 암호화 정확, FCM v1 + RS256 JWT도 정확. (단, 토큰 캐시 부재는 M4)
6. **테스트 스위트**: 320건/~10초, 보안 유틸(classifier/risk-scorer/logger/validate 81건) 커버리지 양호, DO 스토리지 목킹으로 핸드셰이크/밴 흐름 검증.
7. **설정 구조**: `wrangler.toml`의 버전드 DO 마이그레이션, KV/D1/AI 바인딩, 시크릿은 `wrangler secret put`으로만 안내, `.dev.vars` gitignore 처리.
8. **CORS/자격증명 위생**: HTTP CORS 정확 매치, 자격증명 constant-time 비교 후 토큰 발급, 로그인 KV 스로틀(지수 sleep).
9. **데이터 위생**: 12시간 보존을 로드 시점+cleanup에서 이중 적용, 인메모리 바운드(메시지 2000/공지 100/로그 500), SQL 바인드 파라미터, CSV 이스케이프, 다운로드 프록시가 API 키를 서버측에서 주입(키가 브라우저에 노출되지 않음).
10. **부채 관리 문화**: `FEATURE_IDEAS.md`로 알려진 부채를 정직하게 추적, Phase 0 데드코드 제거, 최근 보안 수정 6건의 CHANGELOG 기록.

---

## 9. 테스트·문서·운영 현황

### 9.1 테스트 (22파일 / 320건)

- **잘 커버된 영역**: `middleware/auth`, `rate-limiter`, `validate`, `utils/security`, `security-classifier`/`risk-scorer`/`logger`, DO 3종(목킹), `chat-room/messages`.
- **사각지대**: `src/worker.js`(라우터), `handlers/preview.js`, `handlers/summary.js`, `utils/web-push.js`, `utils/fcm-auth.js`, `utils/logger.js` — import 자체가 없음. `handleWebSocket` 미테스트.
- **형식적 테스트**: `test/web-push.test.js`(헬퍼 재구현), `test/worker-routes.test.js`(라우트 하드코딩) — 통과해도 프로덕션 드리프트를 감지하지 못함.
- **커버리지 설정 없음**: `vitest.config.js`에 coverage provider/threshold 부재(문서는 `test:coverage`를 안내하지만 스크립트 자체가 없음).

### 9.2 문서 드리프트

| 문서 | 문제 |
|---|---|
| README.md | 테스트 수 112/57로 표기(실제 320), 배포 커맨드 Pages로 표기(실제 Worker) |
| docs/API.md | 엔드포인트 수 51/43/20+23 모순(실제 ~53), 메서드/바디/상태코드 다수 불일치(§6.3) |
| docs/DEPLOYMENT.md | D1 바인딩 `DB`(실제 `DB_ADMIN`), `FILE_API_KEY` 누락, DO 마이그레이션 문법 오류, 빌드 스크립트 허위, Pages 롤백 절차 오류 |
| docs/DEVELOPMENT.md | 테스트 수/파일 목록 노후, 존재하지 않는 스크립트(`dev:open`, `build:watch`, `test:coverage`) 안내 |
| docs/ARCHITECTURE.md | 카운트 오류(23/17/2), Pages 진입점 프레이밍 |
| CHANGELOG.md | 마지막 항목 2026-06-22 — 21커밋 누락, keep-a-changelog 미준수 |
| CONTRIBUTING.md / portfolio | 테스트 수 112 표기 |

### 9.3 운영

- **CI 없음**: `.github/` 부재로 테스트/lint/빌드/시크릿 스캔 게이트가 전혀 없음.
- **lint/build 파괴**: §6.1(M13) — 생성물이 lint 대상에 포함되어 `npm run build` 실패.
- **배포 모순**: §5(H10) — Worker vs Pages 문서 혼용.
- **빌드 산출물 커밋 + 이중 락파일**: §6.1(M16, M17).
- **보안 위생**: `.dev.vars` 자체는 gitignore/untracked로 양호하나 `.fva/`(툴 캐시)가 미gitignore.

---

## 10. 권장 로드맵

### P0 — 즉시 (보안 크리티컬, 1~2일)

1. **옵저버 인증 도입**(C1): `admin_obs_` 접두사 신뢰 제거, 토큰 HMAC 증명 또는 인증된 관리자 경로로 이동
2. **세션 시크릿 회전/바인딩**(C2): 새 소켓에 시크릿 재전송 금지, 히스토리에서 `sessionId` 제거
3. **XSS 근본 원인 차단**(C3): `escapeHtml` 따옴표 이스케이프 + 보안센터/사용자 상세 렌더링 `textContent` 전환 + CSP `unsafe-inline`/`unsafe-eval` 제거(nonce/hash)
4. **H9 즉시 패치**: DeadDrop 로그에서 ID 목록 제거

### P1 — 단기 (안정성/보안, 1~2주)

5. 콜드 DO 초기화 순서 수정(H1)
6. 관리자 토큰 재설계: 불투명 토큰 + 서버 세션 + constant-time 비교 + 비밀번호 변경 시 무효화(H2)
7. `messages` 샤딩/바이트 캡 또는 SQLite DO 마이그레이션(H3)
8. 채널 밴 강제 일원화(H4), `/ban-ip` 수정(H5), Origin 정확 매치+필수화(H6)
9. 푸시 구독 소유권 증명(H7), 본문 스트림 캡(H8)
10. preview SSRF 차단(redirect manual + 사설 IP denylist)(M1), 누락 라우트에 레이트리밋 적용 + `/api/secret-read`·`/ws` 포함(M2)
11. Turnstile 서버 티켓(M5), 채널 생성 상한/소유권/삭제 시 DO destroy(M6)
12. **lint 복구**(ignores에 `public/js/chunks/**` 추가) + `npm run build` 그린화(M13)

### P2 — 중기 (운영/품질 인프라, 2~4주)

13. CI 워크플로 구성: `npm ci && npm test && npm run lint && wrangler deploy --dry-run`(M15)
14. 문서 전면 정정: README/API/ARCHITECTURE/DEPLOYMENT/DEVELOPMENT, CHANGELOG 백필(2026-06-23~07-23)(M14, M18, H10)
15. 죽은 코드 삭제(레거시 admin 8종, orphan map, 미사용 export)(L7) + 빌드 산출물 gitignore 전환(M17) + `bun.lock` 제거 또는 단일화(M16) + `.fva/` gitignore(L13)
16. Fail-open 정책 재검토: 밴 체크/로그인 스로틀은 fail-closed(M11)
17. 레이트리미터를 DO 기반으로 승격 검토(M3), `alarm()`/Hibernation 도입(M8), DeadDrop 주기 GC(M8)

### P3 — 장기 (품질/성능)

18. 라우터/보안 경로 테스트 보강: `worker.js` 스모크, `preview`, `summary`, `web-push` 실모듈 테스트(H11), 커버리지 임계값
19. 메시지 HMAC 확장: 전 필드 서명 + timestamp 신선도 + 서버 nonce(M10)
20. 요약 스코프 채널 대응 + 프롬프트 인젝션 완화 + 타임아웃 적용(M9)
21. 클라이언트 정리: 중복 util 통합, 하이라이트 스택 단일화, 소스맵 비공개, dynamic import 정리(L8, L10)
22. 채널/레지스트리 정합성(숫자 슬러그 숨김 제거 또는 접속 차단)(M6)

---

## 11. 결론

Anonymous_Chat은 개인 프로젝트 수준을 넘어서는 설계 밀도(HMAC 서명, ephemeral secret, DO 경계, DeadDrop, RFC 준수 Web Push, 320 테스트)를 갖추고 있습니다. 그러나 **신뢰 경계가 문자열 관례(`admin_obs_` 접두사, 공개 `sessionId`)에 의존하는 지점**과 **출력 이스케이프의 단일 결함(`escapeHtml`)이 CSP 약화와 결합하는 지점**이 각각 CRITICAL 체인을 형성합니다. 이 두 축은 소수의 파일 수정으로 닫을 수 있으면서 프로젝트 성숙도를 크게 끌어올리는 고효율 개선 대상입니다.

동시에 lint 실패·CI 부재·배포 문서 모순은 "코드는 좋은데 파이프라인이 코드를 신뢰하지 않는" 상태를 보여줍니다. P0(보안 3건) → `lint` 복구 → CI 도입의 순서로 진행하면, 이후 모든 변경(본 보고서의 수정 포함)이 자동 검증 위에서 이루어질 수 있습니다.

---

*본 보고서의 모든 발견은 HEAD `9c0b12c` 기준이며, 라인 번호는 해당 커밋에서 유효합니다.*
