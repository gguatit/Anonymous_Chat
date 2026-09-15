# Anonymous_Chat 하드닝 구현 계획 (2026-09-15)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/ANALYSIS.md`에서 도출한 CRITICAL 3건 → HIGH 11건 → MEDIUM 18건 → LOW 15건을 4단계로 수정하고, 각 수정마다 회귀 테스트를 남긴다.

**Architecture:** 서버(Worker + Durable Objects)와 클라이언트(public/js)를 같은 배포에 동기화해 수정한다. 신뢰 경계(옵저버 인증, 세션 capability, 어드민 토큰)를 문자열 관례에서 암호학적 증명으로 교체하고, 출력 이스케이프/CSP를 닫고, 운영 파이프라인(lint/CI/문서)을 실제 코드와 일치시킨다.

**Tech Stack:** Cloudflare Workers, Durable Objects (KV class), D1, KV, Workers AI, Vitest 4 (node/happy-dom), ESLint 9 flat config, esbuild, Tailwind 3.

**확정 결정:**
- 수정 범위: 보고서 전체, Stage 단위로 진행/검증/보고.
- C2: 세션 열쇠(capability) 도입 (전면).
- 밴 정책: **현행 유지 — H4 제외** (같은 IP(로컬/NAT) 사용자 연쇄 차단 방지).
- 보류: H3 샤딩(SQLite 이전 포함), M8 WS Hibernation 재작성, 채널 킥 라우팅 개선(optional 백로그).

**공통 규칙:** TDD(실패 테스트 먼저) / 단계별 `vitest + lint + build + 로컬 스모크` 통과 후 다음 단계 / 커밋은 Task 단위, 실행 시 확인.

---

## 현재 상태 (기준선)

- HEAD `9c0b12c`, 테스트 320/320 (22파일, ~10초), `npm run lint` 실패(chunks 294 errors), `npm run build` 실패.
- 참고 문서: `docs/ANALYSIS.md` (발견 목록, file:line 근거 전부).

---

## Stage 0 — 기반 정리

### Task 0.1: lint 복구 (eslint ignores)

**Files:** Modify `eslint.config.js:39-46`

- [ ] ignores 배열에 `'public/js/chunks/**'`, `'**/*.map'` 추가 (기존 `'public/js/*.bundle.js'` 유지)
- [ ] `npm run lint` → exit 0 확인 (source 파일 잔여 에러 있으면 수정)
- [ ] `npm test` → 320 통과 확인
- [ ] 커밋: `chore(lint): exclude generated chunks and source maps from eslint`

### Task 0.2: CI 워크플로

**Files:** Create `.github/workflows/ci.yml`

- [ ] `on: [push, pull_request]`, Node 22, `npm ci` → `npm test` → `npm run lint` → `npx wrangler deploy --dry-run`
- [ ] 문법 확인: `npx --yes action-validator` 없이 YAML lint는 수동 리뷰로 대체
- [ ] 커밋: `ci: add test/lint/dry-run workflow`

### Task 0.3: .fva/ gitignore

**Files:** Modify `.gitignore`

- [ ] IDE/Tooling 섹션에 `.fva/` 추가
- [ ] `git status`에 `.fva/` 미표시 확인
- [ ] 커밋: `chore: ignore .fva tool cache`

**Stage 0 게이트:** lint exit 0, test 320 그린 → 보고 후 Stage 1.

---

## Stage 1 — P0 보안 크리티컬

### Task 1.1: C1 옵저버 무인증 차단

**Files:**
- Modify: `src/handlers/websocket.js` (handleWebSocket 진입부)
- Modify: `public/js/admin-core.js:172-175` (옵저버 WS URL에 `&token=`)
- Test: `test/handlers.test.js` (또는 신규 `test/websocket-handler.test.js`)

**동작:** `sessionId`가 `admin_obs_`로 시작하면 `token` 쿼리 필수 + `verifyAdminToken(env, token)` 통과 시에만 DO로 전달. 실패 시 401 JSON(DO 미호출).

- [ ] 실패 테스트 3건 작성: (a) 옵저버인데 token 없음 → 401, (b) 위조 token → 401, (c) 유효 token → DO fetch 호출됨
- [ ] 구현 (검사 로직은 export 가능한 헬퍼 `isAuthorizedObserver(env, url)`로 추출)
- [ ] admin-core.js 옵저버 URL에 token 추가
- [ ] `npx vitest run` 그린
- [ ] 커밋: `fix(security): require admin token for observer websocket (C1)`

**주의:** 배포 노트에 "캐시된 옛 admin 번들(≤1h)은 옵저버 접속 거부 → 새로고침 필요" 명시.

### Task 1.2: C2 세션 열쇠(capability) 도입

**Files:**
- Modify: `src/durable-objects/ChatRoom.js` (핸드셰이크 :646-655, 소켓 교체 :565-566, cleanup, storage 키)
- Modify: `src/durable-objects/chat-room/messages.js:202` (검색 결과 sessionId 제거)
- Modify: `public/js/session.js`, `public/js/websocket.js`, `public/js/chat.js` / `ui-render.js` (내 메시지 판정)
- Test: `test/chat-room.test.js`

**프로토콜:**

```
최초 join {sessionId}         → key(32B 랜덤, base64url) + secret + authorId 발급, handshake로 전달
재접속 join {sessionId, key}  → constant-time 일치 시 새 secret + 새 key(회전) 발급
key 불일치/누락(기존 세션)     → close 4401 → 클라이언트: 새 sessionId 생성 후 1회 재접속
secret은 매 연결 새로 발급 (재사용 분기 삭제)
authorId = HMAC(서버비밀, sessionId).slice(0,16) — 직렬화/검색 응답에 sessionId 대신 포함
```

**저장:** `sessionKeys`(맵) storage 영속, `{key, lastSeen}`. cleanup에서 30분 미사용 제거 + 최대 500개 상한(초과 시 오래된 것부터).

- [ ] 테스트 6건 작성: (a) 최초 연결 key+secret+authorId, (b) 정상 재접속 승인+회전, (c) key 불일치 → 4401, (d) sessionId만으로 secret 획득 불가(재전송 없음), (e) 히스토리/검색에 sessionId 부재·authorId 존재, (f) stale key cleanup
- [ ] 서버 구현 → (a)-(f) 그린
- [ ] 클라이언트: session.js key 저장(회전 반영), websocket.js join payload/4401 처리, authorId 기반 내 메시지 판정으로 교체(사용처 grep 후 일괄)
- [ ] `npx vitest run` 그린
- [ ] 커밋: `fix(security): session capability keys + no secret re-issue (C2)`

**주의:** 4401 재시도는 1회 제한(루프 방지). 멀티탭은 localStorage 키 공유로 동작.

### Task 1.3: C3 XSS 체인 차단

**Files:**
- Modify: `public/js/utils.js:1-5` (escapeHtml — `"`/`'` 추가)
- Modify: `public/js/security-center.js:41-63,109-116`, `public/js/pages/page-users.js:50` (이스케이프)
- Modify: `public/js/og-preview.js:66,69`, `public/js/admin-ui.js:80-81`, `public/js/ui-render.js:377-384` (인라인 핸들러 → 리스너)
- Modify: `public/index.html`(인라인 테마 스크립트 분리), `public/announcements.html:146-328`(외부 파일로), `public/_headers:16`(CSP)
- Create: `public/js/theme-init.js`, `public/js/announcements-page.js`
- Test: `test/client-utils.test.js`, 신규 `test/security-center-render.test.js`

**순서 중요:** (1) escapeHtml + innerHTML 싱크 → (2) 인라인 핸들러/스크립트 외부화 → (3) 맨 마지막에 CSP에서 unsafe-inline/eval 제거. 순서를 어기면 사이트가 하양 됨.

- [ ] (a) escapeHtml 따옴표 테스트 실패 → 수정 → 그린
- [ ] (b) security-center/page-users 이스케이프 + happy-dom 테스트(악성 payload로 onerror 미생성)
- [ ] (c) 인라인 핸들러/스크립트 외부화 (grep `onclick=`/`onerror=` 0건 확인)
- [ ] (d) CSP 정리: `'unsafe-inline'`/`'unsafe-eval'` 제거, `script-src 'self' https://cdnjs.cloudflare.com`
- [ ] 수동: 브라우저 콘솔 CSP 위반 0, Prism/hljs/테마 정상
- [ ] 커밋: `fix(security): quote-safe escaping + strict CSP (C3)`

### Task 1.4: H9 DeadDropStore 로그

**Files:** Modify `src/durable-objects/DeadDropStore.js:120` / Test: `test/dead-drop-store.test.js`

- [ ] 로그 스파이 테스트(전체 ID 미출력) → 수정 → 그린
- [ ] 커밋: `fix(security): stop logging all dead-drop ids (H9)`

**Stage 1 게이트:** 전체 테스트 + lint + build + 로컬 dev 스모크(옵저버 거부/재접속/4401/XSS 무해화/CSP 0 위반) → 보고.

---

## Stage 2 — P1 안정성/보안

### Task 2.1: H1 콜드 DO 초기화 (fetch 상단 `ensureInitialized()`, 실패 시 503 fail-closed, 진행중 프로미스 공유)
- Test: cold DO에서 `/admin/info`·`/admin/messages` 정확값, `/check-ban` 실제 밴 반영, storage 오류 → 503.

### Task 2.2: H2 어드민 토큰 재설계
- `auth.js`: `generateAdminToken(env)` = 랜덤 32B base64url, KV `token:<id>` → `{iat, exp(2h), jti}`. `verifyAdminToken` = KV 조회. `revokeToken` = 삭제(로그아웃에서 재사용). 비밀번호 페이로드 제거, `===` → `constantTimeCompare` 제거(KV 키 조회라 불필요).
- `test/auth.test.js` 재작성: 페이로드 비밀번호 부재 고정, 만료/폐기 검증. admin 핸들러 로그인/로그아웃 통합 확인.

### Task 2.3: H3 메시지 128KiB 멈춤
- `MESSAGES_MAX_BYTES=96KiB` 바이트 캡: 저장 전 직렬화 크기 확인, 초과 시 오래된 것부터 드롭. put 초과 모킹해도 broadcast 보장(회귀 테스트).

### Task 2.4: H5 `/ban-ip`
- `chat-room/admin.js` dispatch에 `ban-ip` 추가(HMAC 게이트), `security.js blockRecommendedIP` → `forwardToDO` 사용 + `resp.ok` 검사(실패 시 정확한 에러 반환).

### Task 2.5: H6 Origin 엄격화 (+L4/L5)
- `security.js`: `new URL(origin).origin` 정확 매치, localhost는 개발 환경만, `websocket.js` Origin 필수(fail-closed), `constants.js` 8788 반영, `worker.js:251` 부분문자열 → 정확 비교.

### Task 2.6: H7 푸시 소유권
- subscribe/unsubscribe에 capability 증명(DO `/verify-session` 내부 라우트로 sessionId+key 검증) → KV 키 `sub:<sha256(sessionId)>`. resubscribe는 기존 항목 갱신만.

### Task 2.7: H8 본문 캡
- `safeJson` 스트림 바이트 카운팅 리더, `/api/secret-store`·`/api/logs/error` 적용, 업로드 프록시 헤더 allowlist + 카운팅 413.

### Task 2.8: H10+M14 문서 정정
- 배포 Worker 단일화(README/DEPLOYMENT/CONTRIBUTING/pre-deploy-check), `DB_ADMIN`, `FILE_API_KEY`, 마이그레이션 문법, 롤백 절차, API.md 실제 응답 일치.

### Task 2.9: H11 테스트 보강
- worker 라우터 스모크(모의 바인딩), preview/summary/logger 테스트, web-push 실모듈 테스트(헬퍼 재구현 제거), fcm-auth mock fetch, worker-routes 하드코딩 제거.

**Stage 2 게이트:** 전체 검증 + 보고. **H4는 제외(사용자 결정).**

---

## Stage 3 — MEDIUM/LOW

**확정 실행:**
- M1 preview SSRF(redirect:manual, 사설IP/메타데이터 denylist, 맵 정리, 캡 클램프)
- M2 누락 라우트 레이트리밋 (CHECK_BAN 포함)
- M3 레이트리미터 프루닝+맵 상한 (DO 승격 보류)
- M6 채널 상한/삭제 시 `/destroy`/레지스트리 조회
- M7 D1 보존정책(audit/error)
- M8 `alarm()` 전환(채팅 cleanup+DeadDrop GC, Hibernation 보류)
- M9 요약 채널 스코프+타임아웃
- M10 서명 확장(전 필드+±60s+constant-time, v1/v2 과도기)
- M12 검증 일원화, L계열(각 항목), L12 orphan 테이블 DROP 마이그레이션, 문서 수치 일괄 정정(M18)

**실행 시 정책 질문:** M5 Turnstile 강제, M11 fail-closed 범위, M16 락파일 단일화, M17 산출물 git 제외.

---

## 검증 매트릭스

| 검증 | 방법 |
|---|---|
| 단위/회귀 | `npx vitest run` — 수정마다 실패 재현 테스트 |
| 정적 | `npm run lint` + (최종) `npm run build` |
| 통합 | `wrangler pages dev`(8788) + Node 내장 WebSocket 스크립트(Origin 포함) — 핸드셰이크/옵저버/재접속/4401 |
| 수동 | 브라우저 CSP 위반 0, XSS 무해, 어드민 전 기능, 테마/하이라이트 |
| 불가 | 실기기 푸시, 실제 배포 → 배포 체크리스트 |

## 배포 노트 (Stage 1 이후)

- 어드민 토큰 체계 변경 없음(C1은 기존 토큰 검증 재사용) — 단, **옵저버는 옛 캐시 번들에서 접속 거부**(refresh 필요).
- C2 배포 시: 전 세션 secret 재발급 → 접속 중 사용자는 자동 재접속(클라이언트 구현)으로 새 key 수령.
