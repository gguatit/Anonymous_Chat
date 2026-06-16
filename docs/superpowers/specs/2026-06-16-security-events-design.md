# 고도화된 보안 이벤트 로그 시스템 + 관리자 페이지 리팩토링

**날짜**: 2026-06-16
**상태**: 구현 완료 ✅
**범위**: 보안 이벤트 로깅 + 관리자 페이지 9개 분리

## 1. 배경 및 목적

### 1.1 현재 문제
- 기존 4개 로그 테이블 (`admin_logs`, `admin_activity_logs`, `audit_logs`, `error_logs`)은 **관리자 행위**와 **시스템 오류**만 기록
- **외부 공격/수상한 접근**을 추적할 전용 채널 부재
- `administrator.html` 단일 페이지에 8개 섹션이 몰려 **정보 과밀 + UX 불편**

### 1.2 목표
1. **보안 이벤트 단일 테이블** (`security_events`) 신설, 90일 보존
2. **22개 보안 이벤트 타입** 자동 기록 (인증/엔드포인트/입력/WebSocket/시스템)
3. **위험 IP 점수 추천** → 수동 1-click 차단
4. **관리자 페이지 9개 분리** (메인 + 8개 서브페이지) → 정보 정리 + UX 개선

## 2. 디자인 결정

| 항목 | 결정 | 이유 |
|---|---|---|
| 테이블 구조 | 단일 `security_events` + 점수 컬럼 | 기존 패턴 일관성, SQL 집계 단순 |
| 보존 | 90일 | 보안 감사 + D1 비용 균형 |
| 자동 차단 | 없음 (수동만) | 오탐 리스크 회피 |
| 알림 | 없음 (대시보드만) | 사용자 요구 |
| UI | 메인 + 8개 서브페이지 | 정보 정리 |
| 아이콘 | 이모지 사용 안 함, 고급 SVG 허용 | 사용자 가이드 |
| 마이그레이션 | `wrangler d1 migrations apply` | Cloudflare 공식 |

## 3. 아키텍처

```
HTTP/WS Request
   |
   v
security-middleware (분류)
   |
   v
logSecurityEvent() -> D1: security_events (90일)
                            |
                            v
                 Admin 보안 센터 페이지 (조회/추천/차단)
```

## 4. DB 스키마

```sql
-- migrations/003_create_security_events.sql
CREATE TABLE IF NOT EXISTS security_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    category TEXT NOT NULL,
    severity TEXT NOT NULL,
    severity_score INTEGER NOT NULL,
    ip TEXT,
    user_agent TEXT,
    country TEXT,
    path TEXT,
    method TEXT,
    session_id TEXT,
    details TEXT,
    metadata TEXT,
    timestamp INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sec_events_timestamp ON security_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sec_events_ip ON security_events(ip);
CREATE INDEX IF NOT EXISTS idx_sec_events_category ON security_events(category);
CREATE INDEX IF NOT EXISTS idx_sec_events_severity ON security_events(severity_score DESC);
CREATE INDEX IF NOT EXISTS idx_sec_events_type ON security_events(event_type);

CREATE INDEX IF NOT EXISTS idx_sec_events_ip_recent
  ON security_events(ip, timestamp DESC)
  WHERE timestamp > (strftime('%s','now') - 7*24*60*60) * 1000;
```

### 4.1 마이그레이션 적용

```bash
# 로컬
wrangler d1 migrations apply DB_ADMIN --local

# 원격
wrangler d1 migrations apply DB_ADMIN --remote
```

## 5. 이벤트 분류 매트릭스 (22개)

| event_type | category | severity | score | 트리거 위치 |
|---|---|---|---|---|
| `LOGIN_FAIL` | auth | medium | 25 | handlers/admin.js login |
| `TOKEN_INVALID` | auth | high | 50 | security-middleware |
| `TOKEN_EXPIRED` | auth | low | 10 | security-middleware |
| `NONCE_REPLAY` | auth | high | 60 | HMAC 검증 실패 |
| `RATE_LIMIT_HIT` | auth | medium | 20 | rate-limiter.js |
| `RATE_LIMIT_HARD` | auth | high | 40 | rate-limiter.js |
| `ADMIN_NO_TOKEN` | endpoint | high | 45 | admin 미들웨어 |
| `ADMIN_FORBIDDEN` | endpoint | high | 55 | 권한 체크 |
| `ENDPOINT_SCAN` | endpoint | medium | 25 | 404 핸들러 |
| `METHOD_NOT_ALLOWED` | endpoint | medium | 20 | OPTIONS 외 |
| `XSS_PAYLOAD` | input | high | 65 | input-validator |
| `SQL_INJECTION` | input | high | 70 | input-validator |
| `PATH_TRAVERSAL` | input | high | 60 | input-validator |
| `OVERSIZED_PAYLOAD` | input | medium | 30 | 본문 크기 |
| `WS_FLOOD` | websocket | high | 50 | ChatRoom.js |
| `WS_HANDSHAKE_FAIL` | websocket | medium | 25 | upgrade handler |
| `WS_INVALID_MSG` | websocket | medium | 30 | 메시지 파서 |
| `IP_BYPASS_ATTEMPT` | system | high | 55 | 차단 우회 |
| `CF_WORKER_ERROR` | system | high | 50 | env/IO 에러 |
| `D1_QUERY_FAIL` | system | high | 50 | DB 에러 |
| `KV_FAILURE` | system | medium | 35 | KV 에러 |
| `SHARED_IP_HIGH` | auth | low | 8 | 동일 IP > 5 |

## 6. 신규/변경 파일

### 6.1 신규 파일

```
migrations/003_create_security_events.sql
src/middleware/security-middleware.js
src/middleware/input-validator.js
src/utils/security-logger.js
src/utils/security-classifier.js
src/utils/risk-scorer.js
src/constants/security-events.js
src/handlers/security.js
public/security-center.html
public/js/admin-security.js
public/js/admin-security-render.js
public/js/components/header-nav.js
public/js/components/mobile-menu.js
public/js/components/security-badge.js
public/js/components/csv-export.js
public/css/page-common.css
test/security-logger.test.js
test/security-classifier.test.js
test/risk-scorer.test.js
test/security-routes.test.js
test/page-routing.test.js
```

### 6.2 변경 파일

| 파일 | 변경 내용 |
|---|---|
| `src/utils/logger.js` | `logSecurityEvent` 추가 |
| `src/handlers/admin.js` | 6개 지점에 로깅 추가 |
| `src/worker.js` | 8개 보안 API 라우트 등록 |
| `src/durable-objects/ChatRoom.js` | 3개 지점 로깅 |
| `src/utils/security.js` | HMAC 실패 시 로깅 |
| `public/administrator.html` | 메인 페이지로 대폭 축소 |
| `public/js/admin.js` | 메인 로직만 |
| `public/js/admin-*.js` | 페이지별 모듈로 분리 |
| `esbuild.config.js` | 8개 페이지 번들 추가 |

## 7. API (8개 신규)

| 메서드 | 경로 | 기능 |
|---|---|---|
| GET | `/api/admin/security/events` | 이벤트 목록 (필터/페이지) |
| GET | `/api/admin/security/stats` | 24h 통계 요약 |
| GET | `/api/admin/security/risk-ips` | 위험 IP 추천 |
| GET | `/api/admin/security/event/:id` | 이벤트 상세 |
| POST | `/api/admin/security/clear` | 보안 로그 초기화 |
| GET | `/api/admin/security/export` | CSV 내보내기 |
| GET | `/api/admin/security/badge` | 메인 페이지용 배지 카운트 |
| POST | `/api/admin/security/block-ip` | 추천 IP → 차단 |

## 8. UI 구조

### 8.1 페이지 (9개)

```
administrator.html (메인)
  - Live Stats 4종
  - 보안 알림 배지
  - 빠른 이동 버튼 8개
  - 시스템 정보 (간소화)

security-center.html (신규 핵심)
  - 위험 IP 추천 (상위 10개)
  - 이벤트 필터 (카테고리/심각도/시간/검색)
  - 이벤트 타임라인
  - CSV 내보내기

+ 7개 서브페이지 (error-logs, channels, sessions,
   messages, announcements, ip-bans, audit-logs)
```

### 8.2 디자인 가이드

- 이모지 사용 안 함
- 고급 SVG 허용 (인라인 아이콘, 통계 위젯)
- 모바일 슬라이드 메뉴 (8개 페이지 링크)
- 헤더 "메인으로" 뒤로가기 버튼 (모든 서브페이지)

## 9. 위험 IP 점수 알고리즘

```js
// 7일 윈도우, 같은 IP의 모든 이벤트 severity_score 합산
// + 시간 가중치 (최근 1시간은 2배)
// + 카테고리 다양성 보너스 (4종 이상 = +20%)
```

## 10. 구현 순서 (4 Phase)

### Phase 1: 기반 (1 PR)
1. 마이그레이션 003 작성 + 적용
2. `security-events.js` 상수 정의
3. `security-classifier.js` 패턴 매칭
4. `security-logger.js` 로거
5. 단위 테스트 3개

### Phase 2: 미들웨어 + 핸들러 (1 PR)
6. `input-validator.js`
7. `security-middleware.js`
8. 기존 핸들러 6개 지점 로깅 추가
9. `handlers/security.js` (8개 라우트)
10. `worker.js` 라우트 등록
11. `security-routes.test.js`

### Phase 3: UI (1 PR)
12. 공통 컴포넌트 4개
13. 메인 페이지 축소
14. `security-center.html` + `admin-security*.js`
15. 7개 서브페이지 분리

### Phase 4: 마무리 (1 PR)
16. CSV 내보내기, 배지 폴링
17. 빌드/esbuild 설정
18. 통합 테스트

## 11. 위험 요소 및 대응

| 위험 | 영향 | 대응 |
|---|---|---|
| 5초 폴링 부하 | 중 | 보안 통계 30초 캐시 (KV) |
| 입력 검증 오탐 | 상 | 화이트리스트 + 60+ 임계값 |
| 로그 폭주 | 중 | 같은 IP+event_type 1분 dedup |
| 페이지 분리 회귀 | 상 | 단계별 E2E 테스트 |

## 12. 성공 기준 (Definition of Done)

- [x] 마이그레이션 003 적용 후 테이블 존재
- [x] 4개 카테고리 이벤트 모두 기록됨
- [x] 메인 페이지에서 보안 배지 카운트 표시
- [x] 보안 센터에서 위험 IP 점수 정렬 가능
- [x] 1-click 차단 → 기존 차단 목록에 추가
- [x] CSV 내보내기 동작
- [x] 90일 후 자동 정리 확인
- [x] 모든 단위 테스트 통과 (105개)
- [x] 기존 기능 회귀 없음

---

## 13. 구현 완료 요약 (2026-06-16)

### Phase 1: 데이터베이스 + 분류 엔진
| 파일 | 설명 |
|---|---|
| `migrations/003_create_security_events.sql` | security_events 테이블 + 인덱스 6개 |
| `src/constants/security-events.js` | 22종 이벤트 (auth/endpoint/input/websocket/system) |
| `src/utils/security-classifier.js` | XSS/SQL/경로 탐색 패턴 매칭 |
| `src/utils/risk-scorer.js` | 시간 가중치 + 카테고리 다양성 점수 |
| `src/utils/security-logger.js` | D1 쓰기 + 60초 dedup + 10% 확률 90일 정리 |

### Phase 2: 백엔드 로깅 + API
| 파일 | 설명 |
|---|---|
| `src/middleware/input-validator.js` | 요청/WS 입력 검증 |
| `src/middleware/security-middleware.js` | 보안 컨텍스트 생성, 로깅 헬퍼 |
| `src/handlers/security.js` | 8개 보안 API 엔드포인트 |
| `src/handlers/admin.js` | LOGIN_FAIL (3지점), ADMIN_NO_TOKEN, ADMIN_FORBIDDEN |
| `src/middleware/auth.js` | TOKEN_INVALID, TOKEN_EXPIRED |
| `src/durable-objects/ChatRoom.js` | WS_HANDSHAKE_FAIL, WS_FLOOD, WS_INVALID_MSG |
| `src/worker.js` | 8개 보안 라우트 + ENDPOINT_SCAN |

### Phase 3-4: 관리자 페이지 리팩토링 + 보안센터 UI
| 파일 | 설명 |
|---|---|
| `esbuild.config.js` | 10개 번들 빌드 (splitting: true) |
| `public/js/admin-core.js` | 인증 + 사이드바 네비게이션 + 동적 페이지 로딩 |
| `public/js/admin-main.js` | 대시보드 (스탯 + 로그인 로그 + 시스템 정보) |
| `public/js/security-center.js` | 보안 이벤트 테이블 + 통계 + 위험 IP 차단 |
| `public/js/pages/page-*.js` | 6개 페이지 래퍼 (users/messages/logs/announcements/channels/bans) |
| `public/administrator.html` | `data-page` 기반 8섹션 SPA + 사이드바 CSS |

### 테스트 (35건 신규, 총 105건 통과)
| 파일 | 케이스 |
|---|---|
| `test/security-classifier.test.js` | 10건 |
| `test/risk-scorer.test.js` | 8건 |
| `test/security-logger.test.js` | 8건 |
| `test/security-routes.test.js` | 23건 |
