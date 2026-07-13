# 기여 가이드

Anonymous Chat 프로젝트에 기여하는 방법입니다.

---

## 목차

- [행동 강령](#행동-강령)
- [이슈 등록](#이슈-등록)
- [Pull Request](#pull-request)
- [코딩 컨벤션](#코딩-컨벤션)
- [보안 기여](#보안-기여)
- [테스트](#테스트)
- [릴리스 프로세스](#릴리스-프로세스)
- [문의](#문의)

---

## 행동 강령

| 원칙 | 설명 |
|---|---|
| 상호 존중 | 모든 참여자는 상호 존중을 원칙으로 합니다. |
| 건설적 피드백 | 비판보다 개선을 지향합니다. |
| 보안 신고 | 취약점은 공개 이슈가 아닌 [SECURITY.md](./SECURITY.md) 절차에 따라 신고합니다. |

---

## 이슈 등록

### 사전 확인

1. [CHANGELOG.md](./CHANGELOG.md)에 동일 내용 없음 확인
2. [docs/](./docs/) 디렉토리에서 관련 문서 확인
3. 중복 이슈 검색

### 버그 리포트 포함 사항

| 항목 | 설명 |
|---|---|
| 재현 절차 | 1, 2, 3 순서 |
| 예상 결과 | 정상 동작 |
| 실제 결과 | 오류/예외 동작 |
| 환경 정보 | 브라우저, 기기, OS |
| 콘솔 로그 | 오류 메시지 전문 |
| 스크린샷 | 관련 화면 |

### 기능 제안 포함 사항

| 항목 | 설명 |
|---|---|
| 문제 정의 | 해결하려는 문제 |
| 해결 방법 | 제안 + 대안 |
| 영향 범위 | 사용자/관리자 관점 |
| 우려사항 | 보안/성능/호환성 |

---

## Pull Request

### 브랜치 명명

접두사: `feature/`, `bugfix/`, `hotfix/`, `chore/`

| 종류 | 예시 |
|---|---|
| 기능 | `feature/channel-templates` |
| 버그 | `bugfix/fix-websocket-reconnect` |
| 긴급 | `hotfix/xss-sanitize` |
| 기타 | `chore/bump-deps` |

### 커밋 메시지 (Conventional Commits)

| 타입 | 용도 |
|---|---|
| `feat` | 신규 기능 |
| `fix` | 버그 수정 |
| `docs` | 문서만 변경 |
| `refactor` | 리팩토링 (기능 변화 없음) |
| `test` | 테스트 추가/수정 |
| `chore` | 빌드/의존성/도구 변경 |

**예시**

```
feat: 채널별 알림 설정 추가
fix: WebSocket 재연결 시 중복 입장 메시지
docs: API.md에 새 엔드포인트 명세
refactor: ChatRoom 메시지 검증 로직 분리
test: rate-limiter 추가 케이스
chore: 의존성 업데이트
```

### PR 체크리스트

- [ ] 코드 빌드 성공 (`npm run build`)
- [ ] 테스트 통과 (`npm test`)
- [ ] 린트 통과 (`npm run lint`)
- [ ] 새 기능/버그는 테스트 추가
- [ ] 관련 문서 (CHANGELOG, API.md, README 등) 업데이트
- [ ] 보안 영향 검토 (입력 검증, 인증, XSS 등)
- [ ] 시크릿/키 미포함 확인

---

## 코딩 컨벤션

### JavaScript (공통)

| 규칙 | 설명 |
|---|---|
| 모듈 시스템 | ESM (`import`/`export`) |
| 문서화 | 함수/클래스 단위 JSDoc (서버 측 핵심 로직) |
| 상수 | 매직 넘버는 `src/config/constants.js`에 추가 |
| 비동기 | `async`/`await` 사용 |
| 에러 | `Error` 객체로 throw |
| 비교 | `===`/`!==` 사용 (`==`/`!=` 금지) |

### 클라이언트 (`public/js/`)

| 규칙 | 설명 |
|---|---|
| UI 구조 | UI 매니저는 mixin 패턴 (`ui-*.js`) |
| DOM 조작 | `UIManager` 또는 `chat.js`로 한정 |
| XSS 방지 | `escapeHtml()` 적용 |
| 유틸 | 새 유틸은 `public/js/utils.js` 우선 |

### Worker (`src/`)

| 규칙 | 설명 |
|---|---|
| 핸들러 | `src/handlers/`에 모듈화 |
| Durable Object | `src/durable-objects/`에 (보조 모듈은 `chat-room/` 같은 서브디렉토리) |
| 상수 | 새 상수는 `src/config/constants.js`에 추가 (서버 + 클라이언트 공유) |
| 입력 검증 | `src/utils/validate.js`에 추가 |
| 에러 응답 | `src/utils/errors.js`의 `jsonError`/`jsonSuccess` 사용 |

### CSS

| 규칙 | 설명 |
|---|---|
| 테마 | 7개 모두 지원 (CSS Custom Properties) |
| 스타일링 | Tailwind 클래스 사용 + `themes.css` 오버라이드 |
| 테스트 | 다크/라이트/미드나잇/애미시스트/선셋/사쿠라/이브닝나이트 모두 확인 |

### 파일 구조

| 영역 | 위치 |
|---|---|
| 클라이언트 모듈 | `public/js/` |
| Worker 모듈 | `src/handlers/`, `src/utils/`, `src/middleware/` |
| Durable Object | `src/durable-objects/`, `src/durable-objects/chat-room/` |
| 공유 상수 | `src/config/constants.js` |
| 마이그레이션 | `migrations/` |
| 테스트 | `test/` |

---

## 보안 기여

보안 관련 변경 (인증, 권한, 입력 검증, 시크릿 처리):

| 단계 | 설명 |
|---|---|
| 문서 업데이트 | [SECURITY.md](./SECURITY.md) + [docs/SECURITY.md](./docs/SECURITY.md) |
| PR 본문 | 변경 사항 명시 |
| 위험 평가 | 위험 + 완화 방법 기술 |
| 신고 채널 | 취약점은 공개 PR 전 dev@kalpha.kr |

---

## 테스트

### 명령어

| 명령어 | 설명 |
|---|---|
| `npm test` | 전체 테스트 (Vitest) |
| `npm run test:watch` | 워치 모드 |

### 새 핸들러/유틸 추가 시

| 규칙 | 설명 |
|---|---|
| 위치 | `test/` 디렉토리에 `.test.js` 파일 |
| 구조 | 1 describe = 1 모듈, 1 it = 1 케이스 |
| 커버리지 | 엣지 케이스 (빈 값, 잘못된 형식, 경계값) 포함 |

### 테스트 디렉토리 현황

| 파일 | 케이스 수 | 대상 |
|---|---|---|
| `client-utils.test.js` | 14 | escapeHtml, isValidUrl, sanitizeUrl, formatFileSize |
| `constants.test.js` | 10 | 모든 공유 상수 |
| `helpers.test.js` | 12 | sanitizeInput, arrayBufferToHex, isValidFileUrl |
| `rate-limiter.test.js` | 9 | rate-limiter 전 기능 |
| `security.test.js` | 12 | constantTimeCompare, isAllowedOrigin |
| `security-classifier.test.js` | 9 | XSS/SQL/경로 탐색 패턴 매칭 |
| `risk-scorer.test.js` | 8 | 시간 가중치 + 카테고리 다양성 위험 점수 |
| `security-logger.test.js` | 8 | D1 INSERT, dedup, cleanup |
| `security-routes.test.js` | 23 | Security API 8종 + Middleware + Input Validator |
| `admin-handlers.test.js` | 7 | handleAdminLogout 인증/토큰 |
| **합계** | **112** | -- |

---

## 릴리스 프로세스

| 단계 | 작업 | 명령/위치 |
|---|---|---|
| 1 | `main` 브랜치에 PR 머지 | GitHub |
| 2 | [CHANGELOG.md](./CHANGELOG.md) 자동 반영 | PR 본문의 `## 변경 요약` |
| 3 | 프로덕션 배포 | `wrangler pages deploy public` |
| 4 | D1 마이그레이션 (해당 시) | `wrangler d1 migrations apply` |

---

## 문의

| 종류 | 채널 |
|---|---|
| 일반 | GitHub Issues |
| 보안 | dev@kalpha.kr (PGP 키는 SECURITY.md 참고) |
| 라이선스 | dev@kalpha.kr |
