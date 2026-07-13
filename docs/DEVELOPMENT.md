# 개발 가이드

Anonymous Chat의 개발 환경 설정 및 워크플로우입니다.

---

## 목차

- [개요](#개요)
- [1. 요구사항](#1-요구사항)
- [2. 설치](#2-설치)
- [3. 프로젝트 구조](#3-프로젝트-구조)
- [4. 명령어](#4-명령어)
- [5. 코딩 컨벤션](#5-코딩-컨벤션)
- [6. 새 기능 추가 워크플로우](#6-새-기능-추가-워크플로우)
- [7. 디버깅](#7-디버깅)
- [8. 테스트 작성](#8-테스트-작성)
- [9. PR 전 체크리스트](#9-pr-전-체크리스트)
- [10. 디렉토리별 책임](#10-디렉토리별-책임)
- [11. 참고](#11-참고)

---

## 개요

| 항목 | 값 |
|---|---|
| 언어 | JavaScript (ESM) |
| 런타임 | Cloudflare Workers (Node 18+ 호환) |
| 빌드 도구 | esbuild |
| 테스트 | Vitest |
| 린트 | ESLint (flat config) |
| 포맷터 | Prettier |
| 코드 통계 | 서버 33파일/6,305줄, 클라이언트 35+파일/8,685줄, 테스트 112케이스 (10파일) |

---

## 1. 요구사항

- **Node.js** 18+
- **npm** 9+
- **Wrangler** 3+ (`npm install -g wrangler`)
- **Git** 2.30+

## 2. 설치

```bash
git clone <repo>
cd Anonymous_Chat
npm install
cp .dev.vars.example .dev.vars
# .dev.vars 파일에 시크릿 값 입력 (선택)
```

## 3. 프로젝트 구조

### 3.1 서버 (Worker)
- `src/worker.js` — 메인 라우터, HTTP/WS 라우팅
- `src/handlers/` — 7개 HTTP 핸들러 모듈
- `src/middleware/auth.js` — 관리자 인증
- `src/durable-objects/ChatRoom.js` — WebSocket 핵심
- `src/durable-objects/ChannelRegistry.js` — 채널 메타데이터
- `src/durable-objects/DeadDropStore.js` — 비밀 메시지
- `src/durable-objects/chat-room/` — ChatRoom 보조 (admin, messages, announcements)
- `src/utils/` — 12개 유틸 (validate, errors, helpers, rate-limiter, security, ...)
- `src/config/constants.js` — 모든 매직 넘버 (서버+클라이언트 공유)
- `src/config/cors.js` — CORS 헤더
- `src/schema.js` — JSDoc 타입 정의 (런타임 영향 없음)

### 3.2 클라이언트
- `public/index.html` — 메인 채팅 페이지
- `public/administrator.html` — 관리자 대시보드
- `public/announcements.html` — 공지 히스토리 뷰어
- `public/help.html` — 사용 가이드
- `public/privacy.html` — 개인정보처리방침
- `public/sw.js` — Service Worker (푸시 알림)
- `public/manifest.json` — PWA 매니페스트
- `public/_headers` — 보안 헤더 정의
- `public/_redirects` — 리다이렉트 (현재 미사용, Worker가 처리)
- `public/.well-known/security.txt` — RFC 9116
- `public/js/chat.js` — 메인 클라이언트 (1023줄)
- `public/js/ui.js` — UI 매니저 + 5 mixin (render, menu, modal, edit, lightbox)
- `public/js/admin.js` — 관리자 + 8 helper (csv, messages, users, channels, logs, announcements, render, utils)
- `public/js/api-client.js` — fetch wrapper
- `public/js/websocket.js` — WebSocket 매니저 (재연결, heartbeat, ephemeral 서명)
- `public/js/signature.js` — Web Crypto API 기반 HMAC-SHA256 클라이언트 서명 헬퍼
- `public/js/session.js` — 세션 ID, 닉네임
- `public/js/theme.js` — 7 테마
- `public/js/file-upload.js` — 파일 업로드 (100MB, 클립보드, 드래그앤드롭)
- `public/js/search.js` — 메시지 검색 (키워드, 태그)
- `public/js/push-manager.js` — VAPID + FCM
- `public/js/turnstile.js` — Cloudflare Turnstile
- `public/js/og-preview.js` — OG 카드
- `public/js/security-headers.js` — Kalpha Security API
- `public/js/dead-drop.js` — 비밀 메시지
- `public/js/sakura.js` — 벚꽃 파티클
- `public/js/evernight.js` — GIF 파티클
- `public/js/code-highlight.js` — Prism + highlight.js
- `public/js/utils.js` — escapeHtml, isValidUrl, sendErrorReport
- `public/css/themes.css` — 7 테마 정의 (816줄)
- `public/css/base.css` — 기본 스타일
- `public/css/animations.css` — 애니메이션
- `public/css/code-highlight.css` — 코드 하이라이팅
- `public/css/prism-tomorrow.css` — Prism One Dark
- `public/css/tailwind.min.css` — 빌드된 Tailwind

### 3.3 테스트 (10 파일, 112 cases)
- `test/client-utils.test.js` — 14 cases (escapeHtml, isValidUrl, sanitizeUrl, formatFileSize)
- `test/constants.test.js` — 10 cases (RATE_LIMIT, AI_SUMMARY, ...)
- `test/helpers.test.js` — 12 cases (sanitizeInput, arrayBufferToHex, isValidFileUrl)
- `test/rate-limiter.test.js` — 9 cases
- `test/security.test.js` — 12 cases (constantTimeCompare, isAllowedOrigin)
- `test/security-classifier.test.js` — 9 cases (XSS/SQL/PathTraverse)
- `test/security-logger.test.js` — 8 cases (D1 INSERT, dedup, cleanup)
- `test/security-routes.test.js` — 23 cases (Security 핸들러 7종 + Middleware 3종 + Input Validator 7종)
- `test/risk-scorer.test.js` — 8 cases (시간 가중치, 카테고리 보너스)
- `test/admin-handlers.test.js` — 7 cases (handleAdminLogout 인증/토큰)

### 3.4 기타
- `migrations/` — D1 스키마 (3개: admin_logs, log_tables, security_events)
- `functions/_middleware.js` — Pages Functions 브리지
- `docs/` — 상세 문서
- `wrangler.toml` — Cloudflare 설정
- `package.json` — npm 의존성 + 스크립트
- `eslint.config.js` — ESLint flat config
- `.prettierrc` — Prettier 설정
- `vitest.config.js` — Vitest 설정
- `esbuild.config.js` — esbuild 번들 스크립트

## 4. 명령어

### 4.1 개발
```bash
npm run dev            # wrangler dev (로컬 Workers)
npm run dev:open       # 브라우저 자동 열기
```

### 4.2 빌드
```bash
npm run build          # 클라이언트 번들 (esbuild)
npm run build:watch    # 워치 모드
```

### 4.3 테스트
```bash
npm test               # vitest run
npm run test:watch     # 워치 모드
npm run test:coverage  # 커버리지 리포트
```

### 4.4 린트/포맷
```bash
npm run lint           # ESLint
npm run lint:fix       # 자동 수정
npm run format         # Prettier
```

### 4.5 배포
```bash
npm run deploy         # 빌드 + wrangler pages deploy
```

## 5. 코딩 컨벤션

### 5.1 JavaScript
- ESM 모듈 (`import`/`export`)
- 들여쓰기: 2 spaces (Prettier)
- 따옴표: 작은따옴표 (`'`) 기본, JSX 속성은 큰따옴표
- 세미콜론: 항상
- `===`/`!==` (느슨한 비교 금지)
- 함수는 화살표 함수 또는 `function` 선언
- 클래스 메서드는 메서드 단축 문법

### 5.2 JSDoc
핵심 모듈에는 JSDoc 추가 (서버 측 우선):
```js
/**
 * 메시지를 검증하고 브로드캐스트합니다.
 * @param {Object} data - 클라이언트 메시지
 * @param {string} sessionId - 세션 ID
 * @returns {Promise<{success: boolean, messageId?: string}>}
 */
async handleMessage(data, sessionId) { ... }
```

타입 정의: `src/schema.js`

### 5.3 매직 넘버
**금지**. 모두 `src/config/constants.js`에 정의:
```js
// ❌ 나쁨
if (messages.length > 500) { ... }

// ✅ 좋음
if (messages.length > MAX_STORED_MESSAGES) { ... }
```

### 5.4 에러 처리
`src/utils/errors.js`의 빌더 사용:
```js
return jsonError('잘못된 요청', 400, request.headers.get('Origin'));
return jsonSuccess({ ok: true }, 200, request.headers.get('Origin'));
```

직접 `new Response(JSON.stringify({error:...}), {...})` 작성 금지.

### 5.5 입력 검증
`src/utils/validate.js` 사용:
```js
const result = validateClientMessage(data);
if (!result.valid) return jsonError(result.error, 400, origin);
```

새 입력 타입 추가 시 `validate.js`에 함수 추가.

## 6. 새 기능 추가 워크플로우

### 6.1 새 HTTP 엔드포인트
1. `src/handlers/your-feature.js` 생성
2. `src/worker.js` `routes` 배열에 등록
3. 필요 시 `src/utils/validate.js` 검증 함수 추가
4. 필요 시 `src/config/constants.js` 상수 추가
5. `test/your-feature.test.js` 테스트 추가
6. `docs/API.md`에 명세 추가
7. `CHANGELOG.md`에 변경 기록

### 6.2 새 Durable Object
1. `src/durable-objects/YourDO.js` 생성
2. `wrangler.toml` `[[durable_objects.bindings]]` 추가
3. `wrangler.toml` `[[durable_objects.migrations]]`에 클래스 추가
4. `src/worker.js` `export { YourDO }` 추가
5. `src/utils/do.js`에 `getYourDO()`, `forwardToYourDO()` 추가
6. `docs/ARCHITECTURE.md` 업데이트
7. `CHANGELOG.md`에 기록

### 6.3 새 테마
1. `public/css/themes.css`에 CSS Custom Properties 추가
2. `public/js/theme.js` `THEMES` 배열 + `META_COLORS` 추가
3. `themes.css`에 Tailwind 클래스 오버라이드 추가
4. (선택) `themes.css`에 파티클 이펙트 추가
5. `FEATURE_IDEAS.md` 업데이트

### 6.4 새 UI 컴포넌트
1. 기존 mixin 패턴 참고 (`public/js/ui-*.js`)
2. 새 mixin 파일 (`public/js/ui-feature.js`) 생성
3. `public/js/ui.js` 끝에서 `Object.assign(UIManager.prototype, ...)` 등록
4. CSS는 `themes.css`에 추가 (테마 호환)

## 7. 디버깅

### 7.1 Worker 로그
```bash
wrangler dev              # 콘솔에 console.log 출력
wrangler tail             # 프로덕션 로그
wrangler tail --format=json
```

### 7.2 D1 쿼리
```bash
# 로컬
wrangler d1 execute anonymous-chat-db --local --command "SELECT * FROM error_logs LIMIT 5"

# 프로덕션
wrangler d1 execute anonymous-chat-db --remote --command "SELECT * FROM error_logs LIMIT 5"
```

### 7.3 DO 상태
`wrangler dev` 콘솔에서 인스턴스 ID로 추적. 또는 코드에 디버그 로그 추가.

### 7.4 클라이언트
- Chrome DevTools → Network → WS 프레임
- Application → Service Workers (푸시 디버깅)
- Application → Storage (localStorage/sessionStorage/IndexedDB)
- Application → Cache Storage
- Lighthouse → Performance/Accessibility 점수

## 8. 테스트 작성

### 8.1 Vitest 기본
```js
import { describe, it, expect } from 'vitest';
import { myFunction } from '../src/utils/my-module.js';

describe('myFunction', () => {
  it('정상 입력', () => {
    expect(myFunction('input')).toBe('output');
  });

  it('엣지: 빈 값', () => {
    expect(() => myFunction('')).toThrow();
  });
});
```

### 8.2 Workers 환경
일부 모듈은 Workers 런타임에 의존 (KV, DO, fetch). 모킹:
```js
import { vi } from 'vitest';

const env = {
  DB: { prepare: vi.fn().mockReturnValue({...}) },
  HMAC_SECRET: 'test-secret',
};
```

### 8.3 커버리지 목표
- 유틸 (`src/utils/`): 80%+
- 핸들러 (`src/handlers/`): 70%+
- DO: 통합 테스트 (별도 런타임 필요, 생략 가능)

## 9. PR 전 체크리스트

- [ ] `npm run build` 성공
- [ ] `npm test` 통과
- [ ] `npm run lint` 통과
- [ ] `npm run format` 적용
- [ ] 시크릿/키 미포함 (`git diff` 확인)
- [ ] 관련 문서 업데이트
  - [ ] `CHANGELOG.md`
  - [ ] `docs/API.md` (라우트 변경)
  - [ ] `docs/ARCHITECTURE.md` (구조 변경)
  - [ ] `docs/SECURITY.md` (보안 변경)
  - [ ] `README.md` (주요 변경)
- [ ] 브라우저 수동 테스트 (Chrome, Safari, Firefox, Mobile)
- [ ] 접근성 검증 (키보드만으로 사용 가능)
- [ ] 콘솔 오류 0건
- [ ] Lighthouse 점수 유지

## 10. 디렉토리별 책임

```
src/handlers/   ← HTTP 핸들러 (worker.js가 라우팅)
src/utils/      ← 재사용 가능한 유틸
src/middleware/ ← 인증/인가 미들웨어
src/config/     ← 상수/설정 (서버+클라이언트 공유)
src/durable-objects/  ← DO 클래스
src/durable-objects/chat-room/  ← ChatRoom 보조
public/js/      ← 클라이언트 모듈
public/css/     ← 스타일 (테마 우선)
test/           ← Vitest 유닛 테스트
migrations/     ← D1 스키마 마이그레이션
docs/           ← 상세 문서
```

## 11. 참고

- [CONTRIBUTING.md](../CONTRIBUTING.md) — 기여 가이드
- [docs/ARCHITECTURE.md](./ARCHITECTURE.md) — 아키텍처
- [docs/API.md](./API.md) — API 명세
- [docs/DEPLOYMENT.md](./DEPLOYMENT.md) — 배포 가이드
- [docs/SECURITY.md](./SECURITY.md) — 보안
- [CHANGELOG.md](../CHANGELOG.md) — 변경 이력
- [FEATURE_IDEAS.md](../FEATURE_IDEAS.md) — 기능 아이디어
