# Changelog

프로젝트의 모든 주요 변경 사항을 시간 역순으로 기록합니다. 코드베이스 검증 기반으로 작성되었습니다.

---

## 2026-06-10

### 신규 기능

- **Highlight.js 코드 자동 감지**: 언어를 지정하지 않은 코드 블록에 대해 190개 언어를 자동 감지합니다. Prism은 명시적 언어 지정 시 유지됩니다.
- **Kalpha API 연동**: file.kalpha.kr 파일 서버와 api.kalpha.kr API 프록시를 연동합니다.
- **파일 업로드 100MB 통일**: Worker 제한에 맞춰 파일 업로드 최대 크기를 100MB로 통일합니다.

### 개선

- **Prism CSS 로컬 번들화**: CDN 의존성 제거로 일광성을 확보했습니다. 테마는 One Dark로 고정합니다.
- **Prism JS 처리 방식 변경**: 번들 제거 후 CDN 글로벌로 복원하여 ESBuild 호환성 이슈를 해결합니다.
- **푸터 카드 가시성**: themes.css의 불투명도를 0.3에서 0.5로 상향하고 누락된 카드 오버라이드를 추가합니다.
- **CSP 갱신**: kalpha.kr iframe 허용을 추가하고 cdnjs.cloudflare.com 정책을 정리합니다.

### 버그 수정

- `chat.js`: `this.ui.sanitizeInput` 참조를 `escapeHtml`로 교체하여 UI 분할 후 잔여 버그를 제거합니다.
- `utils.js`: `/api/file/` 프록시 URL을 허용하도록 isValidUrl을 갱신합니다.
- `code-highlight.js`: `Prism` 참조를 `window.Prism`으로 변경하여 ES module strict mode 호환성을 확보합니다.
- file.kalpha.kr API 미지원으로 chunk 업로드 코드를 제거합니다.

---

## 2026-06-09

### 개선

- **서버 모듈 분할**: `ChatRoom.js`를 2446줄에서 1024줄로 축소(-58%)합니다. 관리자 핸들러, 메시지, 공지 모듈을 분리합니다.
- **클라이언트 모듈 분할**: `ui.js`를 1779줄에서 546줄로 축소(-69%)하고 6개 모듈로 분리합니다. `admin-data.js` 1432줄을 6개 모듈로 분리합니다.
- **매직 넘버 정리**: 서버 44개 + 클라이언트 60개의 하드코딩 값을 `src/config/constants.js`로 중앙화합니다.
- **JSDoc 문서화**: `src/schema.js`로 타입을 정의하고 모든 DO 클래스에 JSDoc을 추가합니다.
- **Tailwind CSS 최적화**: CDN 300KB를 빌드 45KB로 교체합니다.
- **JS 번들링**: ESBuild로 클라이언트 19개 파일을 2개 번들로 통합합니다.
- **Prism.js 내장화**: CDN 의존성을 제거하고 core + 22개 언어를 번들에 포함합니다.
- **이벤트 위임 패턴 도입**: 메시지당 5-6개 리스너를 컨테이너당 5개로 줄입니다.
- **입력 검증 표준화**: `src/utils/validate.js`로 모든 메시지 타입의 구조 검증을 추가합니다.
- **에러 처리 표준화**: `src/utils/errors.js`로 6가지 혼재된 에러 포맷을 1가지로 통일합니다.
- **API 클라이언트 중앙화**: `public/js/api-client.js`로 fetch 호출을 일원화합니다.
- **속도 제한기 개선**: `src/utils/rate-limiter.js` lazy init 패턴으로 Workers 호환성을 확보합니다.
- **ESLint 강화**: 33개 에러를 0개로 줄이고 eqeqeq, no-throw-literal, max-depth 규칙을 강화합니다.
- **Prettier 도입**: 코드 포맷팅 자동화를 추가합니다.
- **테스트 추가**: Vitest + 57개 유닛 테스트를 추가합니다.

### 버그 수정

- **토큰 만료 검사 무력화**: `auth.js`의 토큰 파싱 버그를 수정합니다.
- **validate.js 누락 보완**: `VALID_TYPES`에 'message' 타입을 추가하고 typing, edit 필드명 오타를 수정합니다.
- **이벤트 위임 회귀**: 우클릭 컨텍스트 메뉴가 사라지는 버그를 수정합니다.
- **isEmergencyActive 호출 오류**: admin announcement의 잘못된 메서드 호출을 수정합니다.
- **sanitizeInput 참조 깨짐**: UI 분할 후 `escapeHtml`로 교체합니다.

### 신규 기능

- **file.kalpha.kr 파일 서버 연동**: 외부 API를 file.kalpha.kr로 전환하고 Worker 프록시로 Bearer 인증을 처리합니다.
- **파일 업로드 250MB**: 50MB에서 250MB로 상향합니다.
- **Kalpha API 연동**: `KALPHA_API_URL` 환경변수를 추가하여 보안 헤더 분석을 지원합니다.

---

## 2026-05-26

### 신규 기능

- **AI 요약 4가지 모드**: 종합, 주제, 분위기, 논쟁 분석 모드를 추가합니다. 명령어는 `/summary`, `/topic`, `/mood`, `/conflict`입니다.
  - 모드별 전용 시스템 프롬프트 (9~12개 절대 규칙)
  - 주제 분석: 주제별 글머리 + 참여자 수 표시
  - 분위기 분석: 유머, 진지함, 긍정, 부정 수치 + 대표 발언
  - 논쟁 분석: 의견 충돌 중립적 나열, 없으면 "발견되지 않음" 표시
  - 모드별 UI 색상: indigo(종합), emerald(주제), amber(분위기), red(논쟁)
  - 요약 결과는 모든 사용자에게 공유됩니다 (indigo 카드)

### 개선

- AI 레이트 리밋을 30초에서 15초로 완화합니다.
- AI 시스템 프롬프트를 강화하여 9개 절대 규칙(대화 참여 금지, 환각 방지, 개인정보 차단)을 적용합니다.
- AI 피드백 루프를 방지하기 위해 `/messages/recent`에서 AI 요약 메시지를 제외합니다.
- temperature를 0.7에서 0.4로 낮춰 응답 일관성을 향상시킵니다.
- `/` 명령어 팝업에서 4개 명령어 키보드/클릭 선택을 지원합니다.

### 버그 수정

- `_renderSingleMessage`에서 `type:'summary'` 히스토리 배치 렌더링을 지원합니다.
- AI 요약 중복 출력을 messageId 기반 dedup으로 방지합니다.
- AI가 채팅에 답장하는 문제를 프롬프트 규칙 #0 추가로 해결합니다.
- 레이트 리밋 태그 격리를 위해 `checkRateLimit`에 `tag` 파라미터를 추가합니다.

### 문서

- `README.md`: AI 요약 4가지 모드 설명을 업데이트합니다.
- `FEATURE_IDEAS.md`: 31번 AI 대화 요약 모드별 분석을 반영합니다.
- `help.html`: AI 요약 섹션에 4개 모드 설명을 추가합니다.

---

## 2026-05-25

### 신규 기능

- **AI 대화 요약**: `/summary` 또는 `/요약` 명령어로 Workers AI가 최근 대화를 요약합니다.
  - `@cf/qwen/qwen3-30b-a3b-fp8` 모델 사용 (실패 시 `qwen1.5-7b-chat` fallback)
  - 직전 50개 메시지 수집 후 sessionId를 제거하여 AI에 전송 (개인정보 보호)
  - 한국어 3~5문장 자연스러운 요약 출력
  - 15초 레이트 리밋, 8초 타임아웃, indigo 스타일 카드 표시
- **`wrangler.toml` AI 바인딩**: `[ai] binding = "AI"`를 추가합니다.

### 인프라

- **ChatRoom DO `/messages/recent` 엔드포인트**: Worker에서 DO 내부로 메시지를 조회합니다. HMAC 인증을 사용하고 sessionId를 제거합니다.

### 문서

- `help.html`: AI 대화 요약 섹션을 추가합니다.
- `privacy.html`: AI 대화 요약 정보 수집 항목과 Cloudflare Workers AI 제3자 제공사를 추가합니다.
- `FEATURE_IDEAS.md`: 1번 다크/라이트 모드, 15번 메시지 반응, 31번 AI 대화 요약을 완료로 표시합니다.

---

## 2026-05-20

### 신규 기능

- **7가지 테마 시스템**: dark(기본), light, midnight, amethyst, sunset, sakura, evernight를 제공합니다.
  - CSS custom properties 기반 아키텍처 (~70개 변수/테마, 300+ 클래스 매핑)
  - platform-info 패널에서 컬러 닷 + 라벨 선택, 1클릭 즉시 전환
  - localStorage 저장으로 새로고침 후 유지
  - meta theme-color 동기화
  - sakura 테마: 35개 벚꽃 파티클 애니메이션 (4색상, 4중 드리프트)
  - evernight 테마: 18개 GIF 파티클 애니메이션
- **메시지 반응**: 6가지 이모지(좋아요, 하트, 웃음, 놀람, 슬픔, 화남)를 토글 방식으로 지원합니다.
  - 우클릭 컨텍스트 메뉴 "반응 추가" 또는 더블클릭으로 자동 좋아요
  - 반응한 이모지는 파란색 하이라이트, 자신의 반응 토글 가능
  - 실시간 WebSocket 브로드캐스트, DO Storage 저장
  - 반응 추가 시 팝 애니메이션 효과

### 문서

- `help.html`: 테마 변경, 메시지 반응 섹션을 추가하고 관리자 전용 문구(채널 강제 삭제, 차단)를 삭제하며 제한사항을 업데이트합니다.
- `privacy.html` (v1.2): Turnstile, OG Preview, 반응, 채널, PWA 캐시 데이터 수집 항목을 추가합니다. 시행일은 2026-04-09로 유지합니다.
- `announcements.html`, `administrator.html`: 테마 지원 (data-theme, themes.css, theme-color-meta)을 추가합니다.

### 디자인

- **CSS themes.css (816줄)**: 모든 Tailwind 컬러 클래스를 완전 오버라이드하고 전체 테마에서 색감 조화를 최적화합니다.

---

## 2026-05-18

### 신규 기능

- **긴급공지 시스템**: 관리자가 긴급공지를 발송하면 모든 사용자가 공지사항 페이지로 강제 리다이렉트됩니다.
  - 공지 발송 시 긴급공지 체크박스 + 만료시간(1h/6h/24h/무기한) 설정
  - 긴급공지 수신 시 `announcements.html`로 자동 이동, 10초 최소 체류 후 채팅 복귀 가능
  - 동일 긴급공지 재접속 시 리다이렉션 미발생 (localStorage 기반 1회 제한)
  - 긴급공지 해제 시 WebSocket `emergency_cleared` broadcast 후 폴링으로 자동 채팅 복귀
  - 관리자 메시지/공지 입력 구역 완전 분리, 수정 모달에 긴급 토글 추가

### 인프라

- **D1 로그 테이블 3개 분리**: 단일 `admin_logs`를 `admin_activity_logs`, `audit_logs`, `error_logs`로 분리합니다.
  - 감사 로그와 오류 로그를 DO Storage에서 D1로 이전
  - 로그 삭제 시 D1 테이블 각각 DELETE + DO in-memory 정리

### 버그 수정

- **Storage 쓰기 누락 방지**: `ChatRoom.js` 메시지 전송/수정/삭제/어드민 broadcast 등 6곳의 `storage.put()`에 `await`를 추가하여 DO eviction 시 메시지 데이터 소실을 방지합니다.
- **재접속 close-race 수정**: WebSocket close 핸들러에 `sessions.get(sessionId) !== websocket` 가드를 추가하여 재접속 시 새 WebSocket이 삭제되는 버그를 수정합니다.
- **분당 메시지 레이트 리밋 무력화 수정**: `joinTime` 기반 윈도우를 슬라이딩 1분 윈도우(`_minuteWindowStart`, `_minuteMessageCount`)로 교체하여 입장 1분 후 레이트 리밋이 영구 해제되는 버그를 수정합니다.
- **Broadcast 죽은 세션 정리 키 오류 수정**: `ipConnections.get(sid)` 호출을 userMetadata 기반 IP 조회로 교체합니다.

### 보안

- **메시지 서명 검증 강제화**: `handleMessage`, `handleEdit`에서 서명 생략 시 거부합니다.
- **API 레이트 리밋 추가**: `/api/config`, `/api/upload`, `/api/push/*`, `/api/turnstile/verify`, `/metrics`, `/health`, `/api/logs/error` 등 취약 엔드포인트에 레이트 리밋을 적용합니다.
- **클라이언트 XSS 방지**: `file-upload.js` 파일명에 `escapeHtml()`을 적용합니다.
- **Error forward 헤더 필터링**: client error 로그 전달 시 `content-type` 등 safe header만 전달합니다.
- **sessionId 검증**: WebSocket 연결 전 sessionId 길이 제한(100자) 및 허용 문자 검증을 추가합니다.
- **HMAC_SECRET fallback 제거**: `admin.js`, `websocket.js`의 fallback 패턴을 제거하고 명시적 오류를 발생시킵니다.

### 코드 품질

- **Magic number 상수화**: `MESSAGE_RETENTION_MS`, `MAX_STORED_MESSAGES`, `MESSAGE_EDIT_WINDOW_MS`, `SESSION_TIMEOUT_MS`, `CLEANUP_INTERVAL_MS`, `PUSH_THROTTLE_MS`, `DEFAULT_NICKNAME`, `MAX_NICKNAME_LENGTH`, `ROOM_NAME`, `CHANNEL_PREFIX`, `AUTH.*`, `PUSH_SUBSCRIPTION_TTL` 등 25개 상수를 도입합니다.
- **`sanitizeInput` 통합**: `ChatRoom.js`와 `ChannelRegistry.js`의 중복 구현을 `utils/helpers.js`로 통합합니다.
- **채널 핸들러 중복 제거**: `worker.js`의 3개 채널 핸들러를 `channelRequest()` 하나로 통합하여 약 60줄을 감소시킵니다.
- **Admin 핸들러 response status 전달**: `handleAdminMetrics`, `handleAdminSessions`, `handleAdminMessages`에서 DO 응답 status 코드 누락을 수정합니다.
- **세션 목록 빌더 중복 제거**: `/admin/info`와 `/admin/sessions`의 동일 코드를 `getSessionList()` 메서드로 추출합니다.
- **죽은 WebSocket 정리**: `broadcast()`와 `sendToSession()`에서 send 실패 시 세션을 자동 정리합니다.
- **Dead code 제거**: `getFilesInfo()`, `getFileInfo()` (file-upload.js), `getReadUrl()` (dead-drop.js), `SECURITY.BANNED_IPS`, `SECURITY.IP_WHITELIST`를 제거합니다.
- **`auth.js`, `push.js` 상수화**: 하드코딩된 시간/횟수를 `AUTH.*`, `PUSH_SUBSCRIPTION_TTL` 상수로 교체합니다.
- **파일 업로드 URL 환경변수화**: `FILE_UPLOAD_URL` 환경변수를 추가합니다 (기본값: `https://file.kalpha.kr/api/files`).

### 인프라

- **ESLint 강화**: `no-unused-vars`를 error로, `no-console`을 warn으로, `no-eval`과 `no-implied-eval`을 추가하고, `prefer-const`를 error로, 복잡도 경고를 추가합니다.
- **`.dev.vars.example` 보완**: `ADMIN_ID`, `ADMIN_PASSWORD`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `TURNSTILE_SECRET_KEY`, `FCM_SERVICE_ACCOUNT`, `FILE_UPLOAD_URL`을 문서화합니다.
- **`wrangler.toml`**: `FILE_UPLOAD_URL`, `FCM_SERVICE_ACCOUNT` 시크릿 주석을 추가합니다.
- **`package.json`**: `test` 스크립트를 추가합니다.

### 개선

- Client-side document event listener 정리: lightbox keydown handler 참조를 저장하고 재등록 시 이전 리스너를 제거합니다.
- Unknown WebSocket message type 수신 시 클라이언트에 오류를 전송합니다.
- JSON parse 실패 시 sessionId가 없어도 WebSocket을 통해 오류 전송을 시도합니다.

### 인프라 변경 (KV → D1)

- **관리자 로그 저장소 마이그레이션**: `KV.list()` 일일 호출 한도(1,000회/일) 초과 문제를 해결합니다.
  - `ADMIN_LOGS` KV를 `anonymous-chat-db` D1 데이터베이스로 전환
  - 읽기: `KV.list()` + `KV.get()` N회에서 `SELECT ... LIMIT 100` 단일 쿼리로 변경
  - 쓰기: `KV.put()` 개별 키에서 `INSERT` 파라미터화 쿼리로 변경 (SQL injection 방지)
  - 삭제: `KV.list()` + `KV.delete()` N회에서 `DELETE FROM admin_logs` 단일 쿼리로 변경
  - 30일 자동 정리: 쓰기 시 10% 확률로 오래된 로그 정리
- **GitHub Actions 배포 워크플로 제거**: Cloudflare Pages Git 연동으로 대체합니다.

### 보안

- 모든 D1 쿼리에 `?` 파라미터 바인딩을 적용하여 SQL injection을 방지합니다.
- 입력값에 `String()`/`Number()` 강제 형변환을 적용합니다.

---

## 2026-04-29

### 신규 기능

- **채널 시스템**: 메인 채팅방 외에 독립된 채널을 생성하고 참가할 수 있습니다.
  - 빈 공간 우클릭 → "채널 추가" / "채널 참가" 컨텍스트 메뉴
  - 이름(slug) 기반: `kalpha` 입력으로 생성 → 동일 이름으로 참가
  - 채널별 독립된 ChatRoom Durable Object (메시지/세션/밴 완전 분리)
  - 접속자 0명 상태 10분 지속 시 자동 삭제
  - 채널 메시지는 푸시 알림 발송 제외 (메인룸만 알림)
  - 관리자 삭제 시 해당 채널 사용자는 메인 채널로 자동 이동

### 아키텍처

- `ChannelRegistry` Durable Object 신규 추가
  - 채널 메타데이터 관리 (slug → name, createdBy, createdAt, lastActive)
  - `/create`, `/join`, `/touch`, `/delete`, `/list` API
  - 관리자용 `/admin/channels`, `/admin/channel-delete`
- `ChatRoom` DO 채널 지원
  - `X-Channel-Slug` 헤더로 채널 식별
  - `channelSlug` 필드, `emptySince` TTL 추적, 자동 삭제 로직
  - `/admin/info` 엔드포인트: metrics + sessions + messages 통합
  - `/admin/force-delete`: 관리자 강제 삭제 (confirmation 검증 + 메인룸 보호)
- `getChannelRoom()` / `forwardToChannelDO()` 유틸을 `src/utils/do.js`에 추가합니다.

### 관리자 대시보드

- **채널 목록 패널**: 활성 채널 테이블 (이름, 생성자, 생성일, 실시간 접속자/메시지 수)
- **상세 보기 모달**: 채널별 접속자 목록 + 최근 메시지 20개
- **강제 삭제**: confirm 확인 후 DO 데이터 전부 삭제 + Registry에서 제거
- 채널 삭제 감사 로그 기록 (`type: channel_delete`)

### 버그 수정

- **채널 중복 생성**: 구 버전 number key 데이터와 신 버전 slug key 데이터가 공존하던 문제를 해결합니다.
  - `initialize()`에서 숫자 key 항목 자동 필터링
  - 생성 시 slug key + name 이중 중복 체크
  - 목록 조회 시 숫자 key 제외
- **채널 참가 모달 입력 문제**: `type="number"`를 `type="text" inputmode="numeric"`으로 변경합니다.
- **메시지 textarea 스크롤**: `#message-input`에 `scrollbar-width: none`을 적용합니다.
- **채널 참가/생성 모달 겹침**: 모달 열 때 반대 모달을 강제 닫습니다.
- **관리자 로그인 기록 섞임**: `channel_delete` 등 비로그인 로그가 로그인 기록에 표시되던 문제를 타입 필터링으로 해결합니다.
- **채널 삭제 IP 누락**: `logAdminActivity` 호출 시 `CF-Connecting-IP`를 추가합니다.

---

## 2026-04-28

### 신규 기능

- **OG Link Preview**: 채팅 내 URL 아래에 제목, 설명, 이미지 카드를 자동 표시합니다.
  - `POST /api/preview` Worker 엔드포인트 (외부 URL fetch + OG 태그 파싱)
  - Cloudflare Edge Cache 1시간 + 클라이언트 메모리 캐시 최대 50개
  - Rate limit 적용 (IP당 10초 5회), 5초 타임아웃
  - 비-HTML 리소스, 이미지 URL은 프리뷰 제외

### 버그 수정

- **WebSocket 재연결 시 "입장했습니다" 중복 출력**: `close` 이벤트에서 `userMetadata`를 삭제하지 않도록 수정합니다.
- **search.js 메서드 중복 정의**: `syncTagsFromInput()`의 2중 선언을 제거합니다.
- **admin.js `escapeHtml` 중복 정의**: 같은 메서드 2번 선언을 제거합니다.
- **`delete-audit-logs` 엔드포인트 인증 누락**: 관리자 API에 인증 검증을 추가합니다.

### 보안

- **Turnstile Site Key 환경변수화**: 하드코딩된 Site Key를 `wrangler.toml` vars + `/api/config` 엔드포인트로 분리합니다.
- **requireAdminAuth 미들웨어 도입**: 17개 관리자 핸들러의 인증 boilerplate를 통합하여 140줄을 감소시킵니다.

### 코드 품질

- **공통 유틸 모듈** (`public/js/utils.js`): `escapeHtml`, `isValidUrl`, `formatFileSize`, `sendErrorReport`의 5개 파일 중복을 단일 모듈로 통합합니다.
- **라우트 테이블 도입** (`src/worker.js`): 35개 if-chain을 선언적 라우트 배열 + prefix 매칭으로 리팩토링합니다.
- **DO 포워딩 헬퍼** (`src/utils/do.js`): `forwardToDO()`로 admin.js 내 15개 DO fetch boilerplate을 통일합니다.
- **ui.js 메시지 렌더링 중복 제거**: `displayMessage`/`displayBatchMessages` 공유 렌더링 로직을 `_renderSingleMessage()`로 추출합니다.
- **레거시 코드 정리**: 사용하지 않는 `public/app.js` (471줄)를 제거합니다.
- **lint 경량화**: 28에서 20 problems로 감소(신규 에러 0건).

### 관리자 대시보드

- **관리자 로그인 기록 탭**: KV에 저장된 로그인 성공/실패/차단/로그아웃 내역을 실시간으로 확인합니다.
- **감사 로그 필터 버그 수정**: `delete_message` 필터 매핑 오류 수정, 누락 필터 3종을 추가합니다.
- **감사 로그 CSV 내보내기**: 감사 로그 탭에 CSV 내보내기 버튼을 추가합니다.
- **세션 목록 개선**: 실제 WebSocket 연결 상태(`isOnline`), 국가, User-Agent를 표시합니다.
- **사용자 상세 정보 개선**: 닉네임, 국가, User-Agent 표시를 추가합니다.
- **에러 로그 필터/검색**: 에러 타입별 필터 드롭다운 + 메시지 내용 텍스트 검색을 추가합니다.
- **`errors` 메트릭 이중계산 수정**: `metrics.errors + errorLogs.length`에서 `errorLogs.length`만 사용하도록 수정합니다.

---

## 2026-04-15

### 신규 기능

- **메시지 검색**: `GET /api/search?q=검색어` 서버 사이드 검색 API를 추가합니다.
  - 12시간 이내 모든 메시지에서 내용, 닉네임, 파일명 다중 키워드 AND 검색
  - 검색 결과 하이라이트, 클릭 시 해당 메시지로 스크롤 + 하이라이트
  - 헤더 검색 버튼 및 `Ctrl+F` 단축키 지원
  - **태그 검색**: `#images`(이미지), `#files`(파일), `#code`(코드), `#url`(URL) 태그로 유형별 필터링
    - 태그 버튼 클릭 또는 검색어에 직접 `#images` 입력 가능
    - 태그 검색 시 키워드는 무시되고 태그만 필터링에 적용
    - 검색 결과에 색상 태그 배지 표시
- **클립보드 이미지 붙여넣기**: `Ctrl+V`로 클립보드 이미지를 자동 감지하고 업로드 미리보기를 처리합니다.
- **URL 보안 헤더 분석**: Kalpha Security API(`GET /security/headers`)와 연동합니다.
  - 채팅 내 HTTP/HTTPS URL 옆에 방패+체크 아이콘 버튼 표시
  - 클릭 시 해당 사이트의 보안 헤더 분석 결과 모달 표시
  - 점수, 등급, 프로그레스 바, 헤더 설정 상태, 상세 분석 항목 제공

---

## 2026-03-27

### 신규 기능

- **공지사항 히스토리 페이지**: `announcements.html`를 신설하여 과거 공지를 전체 열람할 수 있습니다.
- **공개 공지 API** (`/api/announcements`): 비인증 공지 목록 조회 엔드포인트를 추가합니다.
- **헤더 네비게이션 버튼**: 채팅 헤더에 "공지" 버튼을 추가하여 간편 이동을 지원합니다.

---

## 2026-03-26

### 신규 기능

- **임시 닉네임**: 세션 동안 유지되는 1회성 커스텀 닉네임을 설정할 수 있습니다. 메시지에 "Anonymous" 대신 표시됩니다.
- **닉네임 잠금 (Padlock)**: 닉네임 필드 기본 잠금 상태, 잠금 해제 시 사칭 방지 면책 모달을 표시합니다.
  - 면책 동의 시 "다시 보지 않기" 체크박스 지원 (localStorage 저장)

---

## 2026-03-16

### 보안

- **강력한 내부 API 인증 (SSRF 방지)**: Worker와 Durable Object 간 통신 시 `X-Admin-Internal-Token` 인증 헤더를 강제하여 URL 파라미터 조작 및 내부 라우팅 탈취를 차단합니다.
- **Proxy URL 위조 방지**: Worker 진입단(`/api/logs/error`)에서 클라이언트 주소를 서버가 재구성하여 DO에 전송합니다.

### 시스템 오류 추적

- **클라이언트 및 서버 오류 자동 수집**: `window.onerror` 및 Promise Rejection을 통해 사용자 환경(Device, Browser, IP) 기반 스택 트레이스를 DO에 실시간 저장합니다.
- **영구 보존 및 링 버퍼**: 서버 RAM이 리셋되어도 유지가 되도록 오류 로그를 DO Storage 디스크에 영구 저장합니다. 최대 100개로 자동 순환 관리합니다.
- **에러 로그 다운로드 및 초기화**: 관리자 대시보드의 "시스템 오류 로그" 탭에서 상세 내역 확인, JSON 형식 다운로드, 서버 완전 초기화 기능을 제공합니다.
- **UI 반응성 향상**: 관리자 로그인 Syntax 오류(`Uncaught SyntaxError`) 등 프론트엔드 버그 수정 및 관리자 패널의 텍스트 오버플로우 침범을 해결합니다.

---

## 2026-03-10

### 디자인

- **Prism.js 통합**: 가볍고 성능이 뛰어난 Prism.js를 활용한 코드 하이라이팅 (Tomorrow Dark 테마)
- **코드 자동 감지 (Auto-Detection)**: 사용자가 마커를 쓰지 않아도 자체 휴리스틱 엔진(`detectLanguage`)이 15개 이상의 언어를 자동 판별하여 하이라이팅을 적용합니다.
- **다양한 형식 지원**: 다중 줄 코드 블록 및 인라인 코드 지원
- **사용자 편의성**: 코드 블록 헤더에 감지된 언어명 표시 및 원클릭 '복사' 버튼 제공
- **보안 및 이중 이스케이프 방지**: 서버사이드 제어문자 필터링과 클라이언트 사이드 HTML 이스케이프 처리를 철저히 분리합니다.

---

## 2026-02-23

### 개선

- **배치 전송 시스템 구현**: 서버에서 메시지를 개별 전송에서 배치 전송(`history` 타입)으로 변경합니다.
- **DocumentFragment 렌더링**: 클라이언트에서 DOM 업데이트를 일괄 처리하여 리플로우를 최소화합니다.
- **성능 개선**: 50개 메시지 로딩 시간 500ms에서 20ms로 단축(25배 향상), 50번의 요청을 1번의 요청으로 감소(98%).

### 푸시 알림 시스템

- **Service Worker 필터링 개선**: `visible` 체크에서 `visible AND focused` 체크로 변경합니다.
  - 탭이 백그라운드에 있을 때도 알림 표시
  - 사용자가 채팅을 보고 있을 때만 알림 차단
- **구독 상태 UI 동기화**: 페이지 새로고침 시 기존 구독 상태 자동 반영
- **멀티 디바이스 지원**: 발신자가 여러 기기 사용 시 다른 기기에도 알림 전송
- **에러 처리 강화**: VAPID 설정 오류 감지 및 명확한 로깅
- **환경 변수 검증**: 푸시 알림 설정 누락 시 경고 메시지 표시

### UI/UX

- **Platform-info 패널 업데이트**: 알림 기능 오류에 대한 명확한 경고를 추가합니다.
- **배치 렌더링 로깅**: 메시지 로딩 과정을 콘솔에서 확인할 수 있습니다.

### Android 지원

- **백그라운드 알림**: 앱이 완전히 종료된 상태에서도 푸시 알림 수신
- **VAPID 키 설정 완료**: Web Push API 완전 활성화
- **진동 패턴**: 알림 수신 시 진동 피드백 (200ms-100ms-200ms)
- **액션 버튼**: "채팅 열기", "닫기" 버튼 지원

---

## 2026-02-12

### 보안

- **비밀 메시지 접근 제어 개선**: targetSessionId 기반 엄격한 접근 제어를 도입합니다.
  - 답장 대상의 sessionId를 targetSessionId로 저장
  - 비밀 메시지는 보낸 사람과 받는 사람(targetSessionId)만 열람 가능
  - 제3자는 비밀 메시지 존재만 확인 가능, 내용 접근 불가
  - UI 레벨, 클라이언트 레벨, 서버 레벨 3중 보안 검증

### 신규 기능

- **Dead Drop API 통합**: 일회성 비밀 메시지 시스템을 도입합니다.
  - 메시지를 한 번 읽으면 영구 삭제
  - 30분 TTL (Time To Live)
  - 10000자 메시지 제한
  - API 제공: api.kalpha.kr
- **답장 기능 추가**: 특정 메시지에 답장할 수 있습니다.
  - 컨텍스트 메뉴 (우클릭/길게 누르기)
  - 답장 프리뷰 UI
  - 비밀 메시지로 보내기 옵션
  - 답장 클릭 시 원본으로 스크롤 이동

### 아키텍처

- Dead Drop API 외부 서비스 통합
- targetSessionId 필드 추가로 메시지 수신자 명확화
- 메시지 브로드캐스트에 접근 제어 메타데이터 포함
- CSP에 Dead Drop API 도메인 추가

### 문서

- README에 비밀 메시지 기능 상세 설명 추가
- 비밀 메시지 보안 흐름 시퀀스 다이어그램 추가
- 아키텍처 다이어그램에 Dead Drop API 반영
- 보안 체크리스트 업데이트

---

## 2025-12-19

### 신규 기능

- **관리자 메시지 삭제 권한 확대**: 관리자가 일반 유저의 메시지와 첨부 파일도 삭제할 수 있습니다.
  - 부적절한 콘텐츠 즉시 제거 가능
  - 시간 제한 없이 삭제 가능
  - 삭제된 메시지는 모든 사용자에게 실시간 반영
- **이중 차단 시스템 구축**: IP와 SessionID 동시 차단으로 완벽한 강퇴를 구현합니다.
  - `bannedSessions` Map 추가로 SessionID 기반 차단
  - IP 차단과 SessionID 차단 통합 운영
  - 차단 시 클라이언트 localStorage의 SessionID 자동 삭제
  - 'banned' 메시지 타입 추가로 차단 상태 명확히 전달

### 버그 수정

- **강퇴 기능 완전 개선**: 강퇴된 유저의 재접속을 완전 차단합니다.
  - join 메시지 처리 시점에 IP 및 SessionID 차단 상태 재확인
  - 기존 세션으로 재연결 시도해도 차단 적용
  - 새로고침으로 차단 우회 불가능
  - IP 변경해도 SessionID로 차단 유지
  - 차단 시간 만료 시 자동으로 새 SessionID 발급

### 개선

- 삭제 확인 메시지에 파일 삭제 경고를 추가합니다.
- 감사 로그에 원본 세션 ID, 파일 포함 여부 등 더 자세한 삭제 정보를 기록합니다.
- cleanup 함수에서 만료된 SessionID 차단도 자동 정리합니다.
- 강퇴 시 permanent 플래그로 클라이언트에게 재접속 금지를 명확히 전달합니다.
