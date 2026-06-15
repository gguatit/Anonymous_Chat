# 기여 가이드

Anonymous Chat 프로젝트에 기여하는 방법입니다.

## 행동 강령

- 모든 참여자는 상호 존중을 원칙으로 합니다.
- 건설적인 피드백을 지향합니다.
- 보안 취약점은 공개 이슈가 아닌 [SECURITY.md](./SECURITY.md) 절차에 따라 신고합니다.

## 이슈 등록

이슈를 등록하기 전 다음을 확인합니다:
1. [CHANGELOG.md](./CHANGELOG.md) / [FEATURE_IDEAS.md](./FEATURE_IDEAS.md)에 동일 내용 없음
2. [docs/](./docs/) 디렉토리에서 관련 문서 확인
3. 중복 이슈 검색

### 버그 리포트 포함 사항
- 재현 절차 (1, 2, 3)
- 예상 결과 vs 실제 결과
- 브라우저/기기/환경 정보
- 콘솔 오류 메시지 전문
- 관련 스크린샷

### 기능 제안 포함 사항
- 해결하려는 문제
- 제안하는 해결 방법 + 대안
- 사용자/관리자 관점의 영향 범위
- 보안/성능 우려사항

## Pull Request

### 브랜치
브랜치 명명: `feature/`, `bugfix/`, `hotfix/`, `chore/` 접두사 사용
- 예: `feature/channel-templates`, `bugfix/fix-websocket-reconnect`, `chore/bump-deps`

### 커밋
Conventional Commits 형식 사용:
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

## 코딩 컨벤션

### JavaScript
- ESM 모듈 사용 (`import`/`export`)
- 함수/클래스 단위 JSDoc (서버 측 핵심 로직)
- 매직 넘버는 `src/config/constants.js`에 추가
- 비동기 함수는 `async`/`await` 사용
- 에러는 `Error` 객체로 throw
- `===`/`!==` 사용 (`==`/`!=` 금지)

### 클라이언트 (public/js)
- UI 매니저는 mixin 패턴 (`ui-*.js`)
- DOM 조작은 `UIManager` 또는 `chat.js`로 한정
- `escapeHtml()` 적용 (XSS 방지)
- 새 유틸은 `public/js/utils.js` 우선

### Worker (src/)
- 핸들러는 `src/handlers/`에 모듈화
- DO는 `src/durable-objects/`에 (보조 모듈은 `chat-room/` 같은 서브디렉토리)
- 새 상수는 `src/config/constants.js`에 추가 (서버 + 클라이언트 공유)
- 입력 검증은 `src/utils/validate.js`에 추가
- 에러 응답은 `src/utils/errors.js`의 `jsonError`/`jsonSuccess` 사용

### CSS
- 7개 테마 모두 지원 (CSS Custom Properties)
- Tailwind 클래스 사용 + `themes.css` 오버라이드
- 다크/라이트/미드나잇/애미시스트/선셋/사쿠라/이브닝나이트 모두 테스트

## 보안 기여

보안 관련 변경 (인증, 권한, 입력 검증, 시크릿 처리):
- [SECURITY.md](./SECURITY.md) + [docs/SECURITY.md](./docs/SECURITY.md) 업데이트
- 변경 사항을 PR 본문에 명시
- 위험 평가 + 완화 방법 기술

## 테스트

```bash
npm test                 # 전체 테스트 (Vitest)
npm run test:watch       # 워치 모드
```

새 핸들러/유틸 추가 시:
- `test/` 디렉토리에 `.test.js` 파일 추가
- 1 describe = 1 모듈, 1 it = 1 케이스
- 엣지 케이스 (빈 값, 잘못된 형식, 경계값) 포함

## 릴리스 프로세스

1. `main` 브랜치에 PR 머지
2. [CHANGELOG.md](./CHANGELOG.md) 자동 반영 (PR 본문의 `## 변경 요약` 참고)
3. `wrangler pages deploy public`로 프로덕션 배포
4. D1 마이그레이션은 별도 `wrangler d1 migrations apply` 실행

## 문의

- 일반: GitHub Issues
- 보안: dev@kalpha.kr (PGP 키는 SECURITY.md 참고)
- 라이선스: dev@kalpha.kr
