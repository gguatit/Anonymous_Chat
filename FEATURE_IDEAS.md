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

#### 1. [DONE] Durable Object 단위 테스트 작성 (2026-07-13)

| 항목 | 내용 |
|------|------|
| 대상 | ChatRoom (1435줄), ChannelRegistry (337줄), DeadDropStore (144줄) |
| 현황 | 47개 테스트 케이스 추가 (chat-room 20, channel-registry 15, dead-drop-store 12). 총 159 tests, 0 failures |
| 접근 | Vitest + DO 모킹 (storage, WebSocket, D1, KV) |
| 우선 | ChatRoom.handleMessage, handleEdit, handleReaction, cleanup, handleJoin |

#### 3. [DONE] Worker 라우터 및 핸들러 테스트 (2026-07-13)

| 항목 | 내용 |
|------|------|
| 대상 | `worker.js` route 테이블 (admin 30종, public 19종) + handler 4종 |
| 현황 | 21케이스: admin route 무결성 3, public route 검증 3, admin login/verify 5, checkBan 2, turnstile 3, vapidKey 2, dispatchAdminRoute 7 |
| 완료 | `test/worker-routes.test.js`, `test/handlers.test.js`, `test/chat-room-admin.test.js` |

#### 4. [DONE] Auth 미들웨어 직접 테스트 (2026-07-13)

| 항목 | 내용 |
|------|------|
| 대상 | `middleware/auth.js` (132줄) - HMAC 토큰 생성/검증/폐기 |
| 현황 | 20케이스: generateAdminToken 3, verifyAdminToken 7, revokeToken 2, checkRateLimit 4, incrementRateLimit 4 |
| 완료 | `test/auth.test.js` |

#### 21. [DONE] ChatRoom admin DO route handler 테스트 (2026-07-13)

| 항목 | 내용 |
|------|------|
| 대상 | `chat-room/admin.js` (1075줄, 18개 route) |
| 현황 | 7케이스: notifyAdmin, dispatchAdminRoute(metrics/info/sessions/messages/limit/unknown) |
| 완료 | `test/chat-room-admin.test.js` |

#### 22. [DONE] ChatRoom messages 모듈 테스트 (2026-07-13)

| 항목 | 내용 |
|------|------|
| 대상 | `chat-room/messages.js` (212줄) - searchMessages, validateMessage, sanitizeContentForAI, isLikelyCode |
| 현황 | 37케이스: isLikelyCode 8, containsUrl 3, generateSessionId 2, sanitizeContentForAI 6, extractErrorLocation 2, validateMessage 7, searchMessages 9 |
| 완료 | `test/chat-room-messages.test.js` |

#### 23. [DONE] Handler 모듈 직접 테스트 (4종) (2026-07-13)

| 파일 | 우선순위 | 완료 |
|------|----------|------|
| `handlers/admin.js` login/verify | High | v (invalid json, missing creds, wrong pw, no token) |
| `handlers/websocket.js` checkBan | Medium | v (valid/banned sessionId) |
| `handlers/turnstile.js` verify | Low | v (non-POST, missing token, no secret) |
| `handlers/push.js` vapidKey | Medium | v (missing key, configured key) |
| 완료 | `test/handlers.test.js` (14케이스) |

#### 24. [DONE] utils/validate.js 나머지 validator 테스트 (2026-07-13)

| 현황 | 44케이스: message 6, reaction 4, edit 4, delete 2, typing 2, ping 1, fileInfo 7, channelName 5, nickname 4, deadDrop 4, sessionId 5 |
| 완료 | `test/validate-extra.test.js` |

#### 25. [DONE] utils/helpers.js HMAC/safeJson 테스트 (2026-07-13)

| 대상 | `generateMessageSignature`, `verifyMessageSignature`, `safeJson` |
| 현황 | 8케이스 추가 (기존 12 -> 총 20). HMAC 생성/검증/변조/비밀키 불일치 5, safeJson 2, isValidFileUrl 보강 1 |
| 완료 | `test/helpers.test.js` 확장 |

#### 26. [DONE] utils/web-push.js 유틸리티 테스트 (2026-07-13)

| 대상 | base64urlEncode, base64urlDecode, concatArrays |
| 현황 | 8케이스: base64url 인코딩/디코딩/round-trip/padding/empty, concatArrays |
| 완료 | `test/web-push.test.js` |

#### 27. [DONE] 클라이언트 순수 로직 모듈 테스트 (2026-07-13)

| 파일 | 줄 | 대상 | 완료 |
|------|-----|------|------|
| `public/js/session.js` | 64 | sessionId 생성/복원, 닉네임 관리, 공지 동의 | v |
| 완료 | `test/client-modules.test.js` |

#### 28. [DONE] 서버 소형 유틸 테스트 (4개) (2026-07-13)

| 파일 | 줄 | 대상 | 완료 |
|------|-----|------|------|
| `utils/errors.js` | 27 | jsonError/jsonSuccess/textError/emptyResponse/extractErrorMessage | v |
| `utils/do.js` | 47 | getChatRoom, forwardToDO | v |
| `config/cors.js` | 20 | getCorsHeaders, handleCorsPreflightResponse | v |
| `handlers/health.js` | 17 | /health, /metrics | v |
| 완료 | `test/server-utils.test.js` (21케이스) |

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

#### 9. [DONE] Prettier/ESLint 들여쓰기 불일치 (2026-07-13)

| 항목 | 내용 |
|------|------|
| `.prettierrc` | `tabWidth: 2` |
| `docs/DEVELOPMENT.md` | "들여쓰기: 4 spaces" |
| 방향 | `.prettierrc` 기준으로 `DEVELOPMENT.md` 수정 (실제 코드베이스가 따르는 포맷터 우선) |
| 완료 | `DEVELOPMENT.md` 5.1절 "들여쓰기: 4 spaces" -> "2 spaces (Prettier)" |

#### 10. [LOW] OG Preview 파서 강화

| 항목 | 내용 |
|------|------|
| 현황 | `handlers/preview.js`가 정규식으로 OG 태그 파싱. 작은따옴표 속성, 멀티라인 meta 태그 누락 가능 |
| 방향 | `HTMLRewriter` API로 전환하여 구조적 파싱 |

#### 29. [CRITICAL] Console 로그 제거

| 항목 | 내용 |
|------|------|
| 현황 | 프로덕션 코드에 93개 console.log/warn/error 남아있음 |
| 분포 | ChatRoom.js 48개, summary.js 8개 (AI 내부 노출), push.js 12개, 기타 25개 |
| 위험 | 내부 처리 과정 노출, 성능 저하, 로그 스팸 |
| 방향 | 중앙화된 로깅 유틸리티 생성 후 전부 교체. ChatRoom은 기존 `addErrorLog` 활용 |

#### 30. [HIGH] 코드 중복 제거

| 패턴 | 반복 | 위치 |
|------|------|------|
| Response forwarding | 15회 | `admin.js` - 이미 있는 `forwardResponse` 헬퍼 일관되게 사용 |
| Ban 체크 로직 | 4회 | `ChatRoom.js` 292-309, 331, 535, 553 - `checkAndCleanBan(banMap, key, storageKey)` 추출 |
| 서명 검증 | 2회 | `ChatRoom.js` handleMessage (712-735) vs handleEdit (892-909) - `verifySessionSignature()` 추출 |

#### 31. [HIGH] 긴 함수 리팩토링

| 함수 | 줄 수 | 파일 | 분해 방향 |
|------|-------|------|----------|
| `fetch()` | 200 | ChatRoom.js | route별 handler 메서드 추출 (handleDestroy, handleAdminRoute, handleSearch) |
| `handleMessage()` | 197 | ChatRoom.js | validateMessageRequest, processMessageFiles, storeAndBroadcastMessage 분리 |
| `handleJoin()` | 156 | ChatRoom.js | checkBanStatus, initializeSession, sendInitialData 분리 |
| `cleanup()` | 135 | ChatRoom.js | cleanupBans, cleanupSessions, cleanupMessages, checkAnnouncementExpiry 분리 |
| `handleAdminLogin()` | 132 | admin.js | rate limit, 인증, 로깅 로직 분리 |

#### 32. [MEDIUM] 에러 처리 강화

| 위치 | 문제 | 해결 |
|------|------|------|
| `push.js:239` | KV list 작업에 try/catch 없음 | 래핑 후 early return |
| `admin.js:222-228` | D1 에러 무음 처리 (로그만 찍고 클라이언트에 미전파) | 에러 상태 반환 또는 응답에 포함 |

#### 33. [MEDIUM] Magic Number 문서화

| 상수 | 위치 | 현황 |
|------|------|------|
| `MESSAGE_COOLDOWN: 1000` | constants.js:5 | 주석 없음 - 왜 1초? |
| `MAX_MESSAGE_LENGTH: 7500` | constants.js:10 | 주석 없음 - 왜 7500자? |
| `/^[a-f0-9-]{32,36}$/` | worker.js:282 | File ID 검증 regex - 상수화 필요 |

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

#### 20. [DONE] 문서 줄 수 정기 검증 (2026-07-13)

| 문서 | 잘못된 값 | 실제 값 | 수정 |
|------|----------|---------|------|
| README.md | worker.js 374줄 | 424줄 | v |
| README.md | ChatRoom.js 1080줄 | 1435줄 | v |
| README.md | chat.js 1023줄 | 1147줄 | v |
| ARCHITECTURE.md | worker.js 374줄 | 424줄 | v |
| ARCHITECTURE.md | ChatRoom.js 1080줄 | 1435줄 | v |
| ARCHITECTURE.md | chat-room/admin.js 808줄 | 1075줄 | v |
| ARCHITECTURE.md | chat-room/messages.js 184줄 | 212줄 | v |
| ARCHITECTURE.md | handlers/admin.js 458줄 | 608줄 | v |
| ARCHITECTURE.md | handlers/websocket.js 112줄 | 121줄 | v |
| ARCHITECTURE.md | handlers/push.js 270줄 | 319줄 | v |
| ARCHITECTURE.md | handlers/summary.js 159줄 | 189줄 | v |
| ARCHITECTURE.md | handlers/preview.js 126줄 | 148줄 | v |
| ARCHITECTURE.md | handlers/turnstile.js 67줄 | 77줄 | v |
| ARCHITECTURE.md | DeadDropStore.js 127줄 | 144줄 | v |
| ARCHITECTURE.md | ChannelRegistry.js 261줄 | 337줄 | v |
| DEVELOPMENT.md | 마이그레이션 2개 | 3개 | v |
| DEVELOPMENT.md | 들여쓰기 4 spaces | 2 spaces (Prettier) | v |
| DEVELOPMENT.md | build.js 참조 | esbuild.config.js | v |
| CONTRIBUTING.md | 테스트 57 cases | 112 cases | v |
| SECURITY.md | 알려진 제약 1개 | 4개 | v |

---

## 우선순위 요약

### Critical (즉시)
| # | 과제 |
|---|------|
| 29 | Console 로그 93개 제거 |

### High (다음 릴리스)
| # | 과제 |
|---|------|
| 5 | 데드 코드 제거 |
| 6 | 관리자 대시보드 단일화 |
| 7 | ChatRoom 모듈 추가 분할 |
| 11 | FCM 토큰 캐싱 |
| 12 | 하드코딩 환경변수화 |
| 30 | 코드 중복 제거 (15+4+2회) |
| 31 | 긴 함수 리팩토링 (5개) |

### Medium (점진적)
| # | 과제 |
|---|------|
| 8 | Rate Limiter 문서화 |
| 13 | 관리자 토큰 비밀번호 분리 |
| 14 | CSRF 보호 강화 |
| 17 | vitest coverage 임계치 |
| 18 | D1 schema 정리 |
| 32 | 에러 처리 강화 |
| 33 | Magic Number 문서화 |

### Low (여유 시)
| # | 과제 |
|---|------|
| 10 | OG Preview 파서 강화 |
| 15 | Health check 심화 |
| 16 | DO cleanup 간격 |
| 19 | deploy.sh 개선 |

---

## 변경 이력

| 날짜 | 변경 |
|------|------|
| 2025-11-17 | 최초 작성 (기능 아이디어 33개) |
| 2026-06-15 | 코드베이스 재검증 기반 갱신 |
| 2026-07-13 | 코드베이스 전면 분석 기반 개선 과제로 전환 |
| 2026-07-13 | Phase 1: #4(24)(25)(28) 93케이스 (총 252, 16파일) |
| 2026-07-13 | Phase 2: #22(23)(27) 58케이스 (총 310, 19파일) |
| 2026-07-13 | Phase 3: #3(21)(26) 22케이스 (총 332, 22파일). 테스트 완료 |
| 2026-07-14 | 코드 품질 재분석: #29(console 93개), #30(중복), #31(긴 함수), #32(에러), #33(magic number) 추가 |
