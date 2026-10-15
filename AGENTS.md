# AGENTS.md

이 저장소에서 작업하는 AI 에이전트(및 기여자)가 따르는 규칙. 문서 동기화 누락이 잦은 지점을 정리한 것.

## 프로젝트 개요

- Cloudflare Workers 기반 익명 채팅. 진입점 `src/worker.js`, 배포 설정 `wrangler.toml`.
- 배포: `main` push → **Cloudflare Workers Builds** 자동 빌드/배포.
- **GitHub Actions·Dependabot 미사용** (2026-09-16 제거). CI 워크플로를 새로 추가하지 말 것.

## 커밋/PR 전 검증 (필수)

1. `npm test` — Vitest 전체 (현재 611 cases / 41 파일)
2. `npm run lint` — 0 errors
3. `npx wrangler deploy --dry-run`
4. (선택) `npm run format`

## 문서 동기화 규칙

| 변경 내용 | 함께 갱신할 문서 |
|---|---|
| 새 HTTP 엔드포인트 / 라우트 변경 | `docs/API.md` (+EN), `CHANGELOG.md` |
| 새 Durable Object / 구조 변경 | `docs/ARCHITECTURE.md` (+EN), `CHANGELOG.md` |
| 보안 변경 (인증·권한·검증·시크릿) | `SECURITY.md`, `docs/SECURITY.md`, `CHANGELOG.md` |
| 주요 기능 변경 | `README.md` (+EN) |
| 릴리스 | `CHANGELOG.md` — 날짜 섹션 + 상단 개요 테이블(`최근 업데이트`, `릴리스 수`) + 목차 날짜 |
| 보안 취약점 수정 | `docs/ANALYSIS.md` 현황 테이블 (FIXED/PARTIAL/EXCLUDED/REVERSED/REMAINS) |
| 개선 과제 완료 | `FEATURE_IDEAS.md` — `[DONE]`+날짜 마킹, 하단 변경 이력 행 추가, 우선순위 요약 갱신 |
| 계획서 진행 | `docs/superpowers/plans/*.md` 상태 갱신 |

### 언어 쌍 동기화 (한쪽 수정 시 반드시 동반, 9쌍)

`README` · `CONTRIBUTING` · `COMMERCIAL_LICENSE` · `docs/ARCHITECTURE` · `docs/API` · `docs/DEVELOPMENT` · `docs/DEPLOYMENT` · `portfolio/PRESENTATION` · `portfolio/QNA` — 각 `.md` ↔ `.en.md`

EN 쌍 없음(수정 시 EN 불필요): `CHANGELOG.md`, `SECURITY.md`(루트), `docs/SECURITY.md`, `FEATURE_IDEAS.md`, `docs/ANALYSIS.md`, `docs/superpowers/*`

### 수치 현행화 체크리스트

- **테스트 수** (현재 "611 cases / 41 파일") 표기: `README.md`(배지 포함), `README.en.md`, `CONTRIBUTING.md`, `CONTRIBUTING.en.md`, `docs/DEVELOPMENT.md`, `docs/DEVELOPMENT.en.md`, `portfolio/PRESENTATION.md`, `portfolio/PRESENTATION.en.md`, `portfolio/QNA.md`, `portfolio/QNA.en.md`. 테스트 추가/삭제 시 `grep "611"`으로 전부 갱신.
- **파일 줄 수** 표기: `README.md`(+EN) 구조 트리, `docs/ARCHITECTURE.md`(+EN) 컴포넌트 제목, `docs/DEVELOPMENT.md`(+EN), `portfolio/PRESENTATION.md`(+EN) 통계, `FEATURE_IDEAS.md` 현황.
- ⚠ **앵커 결합**: `docs/API.md`(+EN)에 ARCHITECTURE 제목(줄 수 포함)을 슬러그로 한 링크가 있음 → ARCHITECTURE 제목 수치 변경 시 API.md 앵커도 함께 수정.
- 줄 수 측정은 `[IO.File]::ReadAllLines(...).Length` 사용 (PowerShell `Get-Content | Measure-Object -Line`은 빈 줄을 세지 않아 부정확).

## 커밋/PR 관례

- Conventional Commits: `feat` / `fix` / `docs` / `refactor` / `test` / `chore`
- 브랜치 접두사: `feature/` `bugfix/` `hotfix/` `chore/`
- 사용자가 명시적으로 요청하기 전에는 커밋하지 않는다.
- 문서 전용(docs-only) 커밋은 CHANGELOG에 기록하지 않는다 (릴리스 단위로만).
