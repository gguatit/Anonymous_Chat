# 개선 과제

> 2026-07-13 코드베이스 전면 분석 기반으로 도출된 실제 개선 과제입니다.

---

## 목차

- [범례](#범례)
- [개선 과제 목록](#개선-과제-목록)
  - [Group 1: 테스트 보강](#group-1-테스트-보강)
  - [Group 2: 코드 품질](#group-2-코드-품질)
  - [Group 3: 보안 강화](#group-3-보안-강화)
  - [Group 4: 설정/인프라](#group-4-설정인프라)
  - [Group 5: 문서 정합성](#group-5-문서-정합성)
- [우선순위 요약](#우선순위-요약)

---

## 범례

| 기호 | 의미 |
|------|------|
| [CRITICAL] | 서비스 안정성/보안에 직결, 즉시 대응 필요 |
| [HIGH] | 중대한 기술 부채, 다음 릴리스 내 해결 |
| [MEDIUM] | 점진적 해결 가능 |
| [LOW] | 여유 있을 때 처리 |

---

## 개선 과제 목록

### Group 1: 테스트 보강

#### 1. [CRITICAL] Durable Object 단위 테스트 작성

| 항목 | 내용 |
|------|------|
| 대상 | ChatRoom (1435줄), ChannelRegistry (337줄), DeadDropStore (144줄) |
| 현황 | 0% 커버리지. 프로젝트 전체 로직의 약 45%가 테스트 없음 |
| 접근 | Vitest + DO 모킹 (storage, WebSocket, D1, KV) |
| 우선 | ChatRoom.handleMessage, handleEdit, handleReaction, cleanup |

#### 2. [HIGH] 통합/E2E 테스트 작성

| 항목 | 내용 |
|------|------|
| 대상 | WebSocket 메시지 흐름, 관리자 워크플로우, 채널 CRUD, 푸시 알림 |
| 접근 | `wrangler dev` 환경에서 Playwright 또는 miniflare 테스트 |
| 우선 | 메시지 전송-서명검증-브로드캐스트 체인, 로그인-차단-재접속 시나리오 |

#### 3. [HIGH] Worker 라우터 및 핸들러 테스트

| 항목 | 내용 |
|------|------|
| 대상 | `worker.js` (424줄), `handlers/admin.js` (608줄), `handlers/push.js` (319줄), `handlers/websocket.js` (121줄) |
| 현황 | `handlers/admin.js` 중 logout만 테스트. 나머지 22개 admin 핸들러 미테스트 |
| 접근 | Miniflare DurableObject stub + D1/KV 모킹 |

#### 4. [MEDIUM] Auth 미들웨어 직접 테스트

| 항목 | 내용 |
|------|------|
| 대상 | `middleware/auth.js` (132줄) - HMAC 토큰 생성/검증/폐기 |
| 현황 | admin-handlers.test.js의 logout 테스트에서 간접 검증만 수행 |
| 접근 | `generateAdminToken`, `verifyAdminToken`, `revokeToken` 각각 단위 테스트 |

---

### Group 2: 코드 품질

#### 5. [HIGH] 데드 코드 제거

| 위치 | 내용 |
|------|------|
| `src/middleware/security-middleware.js` (46줄) | 전체 미사용. 어떤 파일에서도 import하지 않음 |
| `src/middleware/input-validator.js` 일부 | `validateRequestInput` 함수 미호출. ChatRoom의 WS 경로만 `classifyContent` 간접 사용 |
| `public/css/themes.css` | `ocean`, `forest` 테마 CSS 정의되어 있으나 `theme.js`에 등록 안 됨 (UI에서 선택 불가) |

#### 6. [HIGH] 관리자 대시보드 단일화

| 항목 | 내용 |
|------|------|
| 현황 | `admin.js` (레거시, 495줄) + `admin-core.js` (신규 SPA, 361줄) 이중화 |
| 중복 | `showNotification`, `updateLastUpdated` 등 유틸리티 함수 중복 |
| 방향 | `admin-core.js` SPA 기반으로 통합, `admin.js` 제거 |

#### 7. [HIGH] ChatRoom 모듈 추가 분할

| 항목 | 내용 |
|------|------|
| 현황 | `ChatRoom.js` 1435줄 (handleJoin/handleMessage/handleEdit/handleDelete/handleReaction이 단일 파일) |
| | `chat-room/admin.js` 1075줄 (18개 admin route handler) |
| 방향 | join/message/reaction/edit/delete 각각 `chat-room/` 서브디렉토리로 분리 |
| | admin 도 kick/announcement/message-management로 추가 분할 |
| 참고 | 2026-06-09에 `ChatRoom.js` 2446줄에서 1024줄로 1차 분할 완료. 추가 분할 필요 |

#### 8. [MEDIUM] In-memory Rate Limiter 문서화

| 항목 | 내용 |
|------|------|
| 현황 | `rate-limiter.js`는 Isolate 단위로만 상태 공유. Workers 요청 분산 시 제한 약화 |
| 방향 | 코드 주석 + SECURITY.md에 한계 명시. Durable Object 기반 Rate Limiter로 전환 검토 |

#### 9. [MEDIUM] Prettier/ESLint 들여쓰기 불일치

| 항목 | 내용 |
|------|------|
| `.prettierrc` | `tabWidth: 2` |
| `docs/DEVELOPMENT.md` | "들여쓰기: 4 spaces" |
| 방향 | `.prettierrc` 기준으로 `DEVELOPMENT.md` 수정 (실제 코드베이스가 따르는 포맷터 우선) |

#### 10. [LOW] OG Preview 파서 강화

| 항목 | 내용 |
|------|------|
| 현황 | `handlers/preview.js`가 정규식으로 OG 태그 파싱. 작은따옴표 속성, 멀티라인 meta 태그 누락 가능 |
| 방향 | `HTMLRewriter` API로 전환하여 구조적 파싱 |

---

### Group 3: 보안 강화

#### 11. [HIGH] FCM OAuth 토큰 캐싱

| 항목 | 내용 |
|------|------|
| 현황 | `utils/fcm-auth.js`가 매 푸시 알림마다 새 JWT 생성 + Google OAuth 토큰 교환 |
| 영향 | 푸시 지연, 불필요한 API 호출, Google rate limit 위험 |
| 방향 | DO 메모리 또는 KV에 50분 TTL로 액세스 토큰 캐싱 |

#### 12. [HIGH] 하드코딩된 값 환경변수화

| 값 | 위치 | 문제 |
|----|------|------|
| `https://kalpha.mmv.kr` | `constants.js` `SECURITY.ALLOWED_ORIGINS` | 다른 도메인 배포 시 코드 변경 필요 |
| `https://file.kalpha.kr/api/files` | `worker.js`, `constants.js` | 파일 서버 URL 하드코딩 |
| `@cf/qwen/qwen3-30b-a3b-fp8` | `constants.js` | AI 모델 Deprecation 시 코드 변경 |
| `mailto:admin@kalpha.kr` | `push.js` | VAPID subject 이메일 하드코딩 |
| Risk score threshold 150/300 | `risk-scorer.js` | 임계값 튜닝 불가 |

#### 13. [MEDIUM] 관리자 토큰에서 비밀번호 평문 제거

| 항목 | 내용 |
|------|------|
| 현황 | `middleware/auth.js`의 `generateAdminToken`이 `id:password:timestamp`를 base64 인코딩. HMAC 시크릿 유출 시 모든 과거 비밀번호 노출 |
| 방향 | 비밀번호 해시를 페이로드로 사용하거나, password 대신 sessionID 기반 토큰으로 전환 |

#### 14. [MEDIUM] CSRF 보호 강화

| 항목 | 내용 |
|------|------|
| 현황 | Bearer 토큰 사용 중이나, 관리자 API에 추가 CSRF 토큰 없음 |
| 방향 | Double Submit Cookie 또는 Custom Header 검증 추가 |

#### 15. [LOW] Health check 심화

| 항목 | 내용 |
|------|------|
| 현황 | `/health`는 `{"status": "healthy"}`만 반환. D1 연결, DO 도달성 체크 없음 |
| 방향 | D1 ping, ChatRoom DO health check 추가 |

#### 16. [LOW] DO cleanup 간격 최적화

| 항목 | 내용 |
|------|------|
| 현황 | DeadDropStore는 cleanup interval 없이 initialize 시 또는 read 시에만 만료 정리. 세션이 많을 경우 메모리 누적 |
| 방향 | ChatRoom과 동일한 5분 주기 cleanup 추가 |

---

### Group 4: 설정/인프라

#### 17. [MEDIUM] vitest coverage 임계치 설정

| 항목 | 내용 |
|------|------|
| 현황 | `vitest.config.js`에 coverage 설정 없음. `DEVELOPMENT.md`에는 `npm run test:coverage` 명령어만 존재 |
| 방향 | `vitest.config.js`에 Istanbul coverage thresholds 추가 (utils 80%, handlers 70%) |

#### 18. [MEDIUM] D1 schema 정리

| 항목 | 내용 |
|------|------|
| 대상 | `migrations/001_create_admin_logs.sql`의 `admin_logs` 테이블 |
| 현황 | 002 마이그레이션에서 `admin_activity_logs`로 대체됨. `admin_logs`는 orphaned |
| 방향 | 004 마이그레이션으로 `admin_logs` DROP 또는 migration 정리 문서화 |

#### 19. [LOW] deploy.sh 개선

| 항목 | 내용 |
|------|------|
| 현황 | `deploy.sh`는 dry-run만 수행. 실제 배포는 Pages Git integration에 의존 |
| 방향 | 파일명을 `pre-deploy-check.sh`로 변경하거나, 실제 배포 로직 추가 |

---

### Group 5: 문서 정합성

#### 20. [LOW] 문서 줄 수 정기 검증

| 문서 | 잘못된 값 | 실제 값 |
|------|----------|---------|
| README.md | worker.js 374줄 | 424줄 |
| README.md | ChatRoom.js 1080줄 | 1435줄 |
| README.md | chat.js 1023줄 | 1147줄 |
| ARCHITECTURE.md | worker.js 374줄 | 424줄 |
| ARCHITECTURE.md | ChatRoom.js 1080줄 | 1435줄 |
| ARCHITECTURE.md | chat-room/admin.js 808줄 | 1075줄 |
| ARCHITECTURE.md | chat-room/messages.js 184줄 | 212줄 |
| ARCHITECTURE.md | handlers/admin.js 458줄 | 608줄 |
| ARCHITECTURE.md | handlers/websocket.js 112줄 | 121줄 |
| ARCHITECTURE.md | handlers/push.js 270줄 | 319줄 |
| ARCHITECTURE.md | handlers/summary.js 159줄 | 189줄 |
| ARCHITECTURE.md | handlers/preview.js 126줄 | 148줄 |
| ARCHITECTURE.md | handlers/turnstile.js 67줄 | 77줄 |
| ARCHITECTURE.md | DeadDropStore.js 127줄 | 144줄 |
| ARCHITECTURE.md | ChannelRegistry.js 261줄 | 337줄 |
| DEVELOPMENT.md | 마이그레이션 2개 | 3개 |
| DEVELOPMENT.md | 들여쓰기 4 spaces | 2 spaces (Prettier) |
| DEVELOPMENT.md | build.js 참조 | esbuild.config.js |
| CONTRIBUTING.md | 테스트 57 cases | 111 cases |
| SECURITY.md | 알려진 제약 1개 | 4개 |

---

## 우선순위 요약

### Critical (즉시)
| # | 과제 |
|---|------|
| 1 | DO 단위 테스트 작성 |

### High (다음 릴리스)
| # | 과제 |
|---|------|
| 2 | 통합/E2E 테스트 |
| 3 | Worker 라우터/핸들러 테스트 |
| 5 | 데드 코드 제거 |
| 6 | 관리자 대시보드 단일화 |
| 7 | ChatRoom 모듈 추가 분할 |
| 11 | FCM 토큰 캐싱 |
| 12 | 하드코딩 환경변수화 |

### Medium (점진적)
| # | 과제 |
|---|------|
| 4 | Auth 미들웨어 직접 테스트 |
| 8 | Rate Limiter 문서화 |
| 9 | Prettier/ESLint 불일치 |
| 13 | 관리자 토큰 비밀번호 분리 |
| 14 | CSRF 보호 강화 |
| 17 | vitest coverage 임계치 |
| 18 | D1 schema 정리 |

### Low (여유 시)
| # | 과제 |
|---|------|
| 15 | Health check 심화 |
| 16 | DO cleanup 간격 |
| 19 | deploy.sh 개선 |
| 20 | 문서 줄 수 검증 |
| 10 | OG Preview 파서 강화 |

---

## 변경 이력

| 날짜 | 변경 |
|------|------|
| 2025-11-17 | 최초 작성 (기능 아이디어 33개) |
| 2026-06-15 | 코드베이스 재검증 기반 갱신 |
| 2026-07-13 | 코드베이스 전면 분석 기반 개선 과제로 전환 (20개 과제) |
