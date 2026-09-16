# Anonymous Chat v2 보안 하드닝 구현 계획 (2026-09-16)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 2026-09-16 보안분석에서 확인된 취약점 전부(CRITICAL 1 · HIGH 2 · MEDIUM 13 · LOW ~29)를 수정하고, 관련 문서(md)를 현행화한다.

**Architecture:** 서버(Worker/DO) 우선 → 클라이언트 → 구성/문서 순. 각 태스크는 TDD(실패 테스트 → 구현 → 검증). Phase 단위로 배포 가능.

**Tech Stack:** Cloudflare Workers/DO/D1/KV, vitest 4.1.8, wrangler 4.x, esbuild.

**Baseline:** HEAD `92c5b7f` · tests 496/496 (35 files) · lint 0 errors/97 warnings · build green · prod https://kalpha.mmv.kr

**공통 게이트 (모든 Phase):** `npx vitest run`(496+신규) → `npm run lint`(0 errors) → `npm run build`(exit 0) → 로컬 스모크(`wrangler dev --var ENVIRONMENT:development --port 8788`: WS 101/401/403, 관리자 로그인→공지→파일 미리보기/다운로드) → 커밋+푸시(자동배포) → Cloudflare 빌드 success 확인 → 실패 시 `wrangler rollback`.

---

## Phase 1 — P0 (CRITICAL/HIGH)

### Task 1.1: C1 — 파일 프록시 콘텐츠 타입 하드닝 (SVG XSS 차단)

**Files:**
- Modify: `src/worker.js` (파일 프록시 :308-348, 인라인 결정 :334-339)
- Test: `test/file-proxy-headers.test.js` (신규)

- [ ] **Step 1: 실패 테스트 작성**
  - 업스트림 mock: `env.FILE_UPLOAD_URL`을 로컬 mock으로, `image/svg+xml` 반환 케이스.
  - 단언: `/api/file/:id` 응답에 `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`.
  - 래스터(`image/png`)는 인라인 유지(`Content-Disposition` 비-attachment).
  - `text/html` 등은 attachment + nosniff.
- [ ] **Step 2: 실패 확인** — `npx vitest run test/file-proxy-headers.test.js` → FAIL
- [ ] **Step 3: 구현** — 인라인 허용 화이트리스트 `image/png|jpeg|gif|webp|avif`만 `inline`, 그 외 `attachment` + `nosniff`; 문서형(SVG/HTML)에는 CSP `default-src 'none'; sandbox`.
- [ ] **Step 4: 통과 확인** → 커밋 `fix: 파일 프록시 SVG/문서형 첨부 강제 + nosniff/CSP (C1)`

### Task 1.2: H1 + M4 — 키 퇴출 보호 + 라이브 sessionId 제거

**Files:**
- Modify: `src/durable-objects/ChatRoom.js` (프루닝 :1442-1448, 라이브 브로드캐스트 :875-885/:1080-1083/:1201-1209/:1233-1238)
- Modify: `public/js/ui.js` (타이핑 표시 — authorId 폴백)
- Test: `test/chat-room-session-key.test.js`(확장), `test/chat-room.test.js`(확장)

- [ ] **Step 1: 실패 테스트 3건**
  1. 연결 중 세션 키는 MAX_KEYS 퇴출에서 제외(비연결 키 우선 퇴출).
  2. 키 없는 재join은 여전히 4401(회귀).
  3. 라이브 `message`/`typing`/`message_reaction` 브로드캐스트에 `sessionId` 없음(+`authorId` 존재), 옵저버 이벤트에는 유지.
- [ ] **Step 2: 구현**
  - 프루닝: `sessions.has(sid)` 연결 세션은 퇴출 스킵; 비연결 중 lastSeen 오래된 순 퇴출; 전부 연결이면 일시 초과 허용(로그).
  - 라이브 직렬화: sessionId 제거, `authorId`로 대체(반응/타이핑 포함).
- [ ] **Step 3: 통과** → 커밋 `fix: 연결 중 세션키 퇴출 금지 + 라이브 이벤트 sessionId 제거 (H1/M4)`

### Task 1.3: H2 — Workers Logs 쿼리스트링 redact

**Files:** `wrangler.toml` (observability :79-83) · Test: `test/ops-config.test.js`(신규)

- [ ] `redact_query_string = true` 추가 + 설정 회귀 테스트(wrangler.toml 값 단언) → 커밋 `chore: Workers Logs 쿼리스트링 마스킹 (H2)`

### Task 1.4: M8 — 옵저버 원타임 티켓 (URL에서 관리자 토큰 제거)

**Files:** `src/handlers/admin.js`(신규 `handleAdminObserverTicket`), `src/worker.js`(라우트+`/ws` 게이트), `src/middleware/auth.js`(HMAC 티켓 헬퍼) · `public/js/admin-core.js`(connectObserver) · Test: `test/observer-ticket.test.js`

- [ ] 테스트: 발급=withAuth 필수, `/ws?sessionId=admin_obs_*&ticket=<관찰자 티켓>` 통과, 만료/위조 401, 기존 `token=` 파라미터 불허(401).
- [ ] 구현: `observer:${sessionId}:${ts}` HMAC, TTL 5분. 클라: 연결 전 티켓 발급 → `&ticket=`으로 접속.
- [ ] 통과 → 커밋 `fix: 옵저버 WS 인증을 5분 티켓으로 전환 — URL 토큰 노출 제거 (M8)`

## Phase 2 — P1 (MEDIUM)

### Task 2.1: M1 — Turnstile 티켓 세션 바인딩 + TTL 단축 + L-1
- worker `/ws`: 세션 검증 시 `X-Ws-Session-Id`(=최초 join 예정 sessionId) 전달·대조, 불일치 4401. `TICKET_TTL` 12h→2h. 클라: 4401 수신 시 `chatTurnstileTicket` 초기화.
- 테스트: join sessionId 불일치 4401, TTL 2h 경계, 클라 리셋(단위).

### Task 2.2: M2 — 관리자 라우트 레이트리밋 + 로그인 카운터/로그 IP
- worker: `/api/admin/*` 공통 리미터(120/분/IP). `handlers/admin.js` malformed JSON 경로도 `incrementRateLimit`. `auth.js` TOKEN_INVALID에 `ip` 포함(디덥 동작).

### Task 2.3: M3 — 레지스트리 스윕을 alarm 전용 + 5분 스로틀로
- fetch에서 `await this.cleanup()` 제거 → `alarm()`에서만. `_lastSweep` 스로틀. 테스트: fetch가 스윕 안 함, alarm이 함.

### Task 2.4: M5 — DeadDrop 만료 alarm GC
- `DeadDropStore`: store 시 가장 이른 만료로 setAlarm, `alarm()`에서 만료 정리+재예약. 테스트: 만료 후 삭제·재예약.

### Task 2.5: M6 — 반응·타이핑 스로틀
- 반응: `REACTION_RATE_LIMIT_MS` 적용(1초). 타이핑: 2초 스로틀. 테스트: 연속 반응 억제.

### Task 2.6: M7 — preview 데니리스트 보강
- IPv4-mapped IPv6(`::ffff:*`), 0.0.0.0/8, 192.0.0.0/24, 198.18.0.0/15, 멀티캐스트/예약. DNS 리바인딩 한계 문서화. 테스트: 신규 케이스 거부.

### Task 2.7: M9 — Prism self-host 번들 이관
- `prism-bundle.js` 엔트리 복원(esbuild) → `index.html` CDN 2줄 제거, 번들 로드. `_headers` CSP에서 `cdnjs` 제거. 테스트: CSP 문자열 검사, 번들 존재.

### Task 2.8: M10 — 운영 D1 마이그레이션 원장 정리
- `npx wrangler d1 execute`/`migrations apply --remote`로 004/005 멱등 적용(+원장 확인). admin_logs 제거 확인.

### Task 2.9: M11 — privacy.html 현행화(보존 90/30/30/90·D1·Workers Logs 7d·SW 캐시 서술 제거)

### Task 2.10: M12 — Dependabot 활성화 + CI audit 스텝
- `gh api`로 dependabot security updates 활성화. `ci.yml`: `permissions: contents: read`, `npm audit --audit-level=high` 스텝, action SHA 핀 고려.

### Task 2.11: M13 — 보존 삭제 문서/구현 일치(확률 정리 문구 명시)

## Phase 3 — P2 (LOW 일괄)
- 서버: null-method 라우트 메서드 명시 / kick `banDuration` 검증(0~MAX) / 관리자 직접 put → `_persistMessages()` / 퇴장 시 `scheduleEmptyAlarm()` / `deleteChannel` 소켓 종료 / 내부 HMAC `constantTimeCompare` / resubscribe 소유권.
- 클라: `get/getRaw` 401 훅 / 렌더러 `h()` 보강 / dead-drop console 제거 / `sw` openWindow origin 검증 / 소스맵 삭제 / CSV 수식 이스케이프 / 시계 스큐 안내.
- 구성: CSP `img-src`/`connect-src` 축소 검토, security.txt Policy 교정, 요약 로그 길이만, evernight GIF 중복 삭제, HSTS preload(존 설정 안내).

## Phase 4 — 문서(md) 현행화
- docs/SECURITY.md · docs/API.md(observer-ticket·/ws 인증·admin 리미트) · docs/ARCHITECTURE.md(스윕→alarm·티켓) · docs/DEPLOYMENT.md(observability·D1 원장·Prism) · README.md · CHANGELOG.md(2026-09-16) · docs/ANALYSIS.md(v2 현황) · FEATURE_IDEAS.md · docs/DEVELOPMENT.md · SECURITY.md · public/privacy.html · CONTRIBUTING/PRESENTATION/QNA 수치.

## 실행 순서
Phase 1 → 2 → 3 → 4. 각 Phase 종료 시 사용자 보고. 운영 반영은 푸시→Workers Builds 자동배포.

---

## 완료 현황 (2026-09-16)

> HEAD `1c0ecbc` · 38 commits pushed · tests **596/596 (40 files)** · lint 0 errors/96 warnings · build green · deployed https://kalpha.mmv.kr (Worker `anonymous-chat`).

| Phase | 상태 | 커밋/비고 |
|---|---|---|
| Phase 1 — C1 · H1/M4 · H2 · M8 | DONE | `e735e1d` · `e01228a` · `a782e69` · `3f09cec` |
| Phase 2 — M1 | DONE | `a67228a` (join 바인딩 + TTL 2h, 불일치 4401) |
| Phase 2 — M2 | DONE | `344b306` (120/분/IP + 로그인 카운터 + 이벤트 IP) |
| Phase 2 — M3 | DONE | `e7e6061` (alarm 전용 + 5분 스로틀) |
| Phase 2 — M5 | DONE | `0d37a41` (alarm GC + 재예약) |
| Phase 2 — M6 | DONE | `836838a` (반응 1초/타이핑 2초) |
| Phase 2 — M7 | DONE | `34f0eb4` (denylist 확장) |
| Phase 2 — M9 | DONE | `d01aebe` (Prism 자체 번들, CSP cdnjs 제거) |
| Phase 2 — M10 | DONE(기존) | 004/005 원장은 `5832e64`·`91a5245`에서 프로덕션 적용 완료 — v2 추가 작업 없음 |
| Phase 2 — M11 | DONE | `e47dc64` (privacy.html) |
| Phase 2 — M12 | DONE | `61c0afe` (Dependabot + CI audit/permissions) |
| Phase 2 — M13 | DONE | `99809ff` (쓰기 10회마다 강제 스윕) |
| Phase 3 — LOW 서버 | DONE | `a0131d4` |
| Phase 3 — LOW 클라/구성 | DONE | `1c0ecbc` (SW/CSV/401/렌더러/security.txt/소스맵·중복 GIF) |
| Phase 4 — 문서 | DONE* | README·CONTRIBUTING·SECURITY·docs/{SECURITY,API,ARCHITECTURE,DEVELOPMENT} 현행화 + CHANGELOG/ANALYSIS/FEATURE_IDEAS/PRESENTATION/본 계획서 갱신 (*작업 트리 기준, 커밋 예정) |

### 의도적 스킵 (EXCLUDED)

| 항목 | 비고 |
|---|---|
| 시계 스큐 UX 안내 (Phase 3 클라) | 사용자 판단으로 스킵 |
| CSP `img-src` 축소 (Phase 3 구성) | 현행 `https:`/`data:` 유지 — 사용자 판단으로 스킵 |
| HSTS preload 존 레벨 등록 (Phase 3 구성) | `_headers`의 `preload` 지시자는 유지, 도메인 존 설정은 별도 작업 |
