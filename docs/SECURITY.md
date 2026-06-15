# 보안 체크리스트

Anonymous Chat의 보안 통제 항목과 그 위치입니다. 정기적으로 검토합니다.

## 1. 인증/권한

### 1.1 관리자 인증
- ✅ **HMAC-signed base64 토큰** (`src/middleware/auth.js:42-78`)
  - 형식: `base64(id:ts).base64(HMAC(secret, id:ts))`
  - 만료: 2시간 (`AUTH.TOKEN_EXPIRY_MS`)
  - KV 기반 즉시 폐기 (`revokeToken`)
  - ❌ JWT는 사용하지 않음 (서명 알고리즘 혼동 위험 회피)
- ✅ **상수 시간 비교** (`src/utils/security.js:constantTimeCompare`)
  - 타이밍 공격 방지
  - 패스워드 비교, 메시지 서명 검증에 사용
- ✅ **Rate Limiting** (`src/middleware/auth.js:checkRateLimit`)
  - 5분 내 5회 실패 시 차단
  - KV 키: `admin:auth:{ip}`
  - TTL 5분 (`AUTH.RATE_LIMIT_EXPIRE`)

### 1.2 WebSocket 인증
- ✅ **SessionID 형식 검증** (`src/handlers/websocket.js:handleWebSocket`)
  - 정규식: `[a-zA-Z0-9_-]{1,200}`
  - 길이 제한 (100자)
- ✅ **사전 차단 확인** (`/api/check-ban`)
  - WebSocket 핸드셰이크 전에 차단 상태 확인
- ✅ **Origin 검증** (`src/handlers/websocket.js`)
  - `src/utils/security.js:isAllowedOrigin` 통과 필요

### 1.3 내부 API (Worker ↔ DO)
- ✅ **`X-Admin-Internal-Token` 헤더** (모든 DO 호출)
  - 값: `env.HMAC_SECRET`
  - SSRF 방지 (URL 파라미터로 DO 라우팅 탈취 불가)
  - 적용 위치: `src/utils/do.js:forwardToDO`, `forwardToChannelDO`

### 1.4 메시지 서명
- ✅ **HMAC-SHA256** (`src/utils/helpers.js:generateMessageSignature`)
  - 서명 대상: `{content, sessionId, timestamp}`
  - 클라이언트 → 서버 메시지 변조 방지
  - DO가 `handleMessage`/`handleEdit`에서 검증
- ✅ **서명 누락 시 거부** (생략 불가)

## 2. 입력 검증

### 2.1 메시지
- ✅ **타입별 분기 검증** (`src/utils/validate.js:validateClientMessage`)
  - `message`, `reaction`, `edit`, `delete`, `typing`, `ping`
- ✅ **길이 제한** (7500자, `SECURITY.MAX_MESSAGE_LENGTH`)
- ✅ **Sanitize** (`src/utils/helpers.js:sanitizeInput`)
  - 제어문자 제거 (`\x00-\x08\x0B\x0C\x0E-\x1F\x7F`)
  - `\r\n?` → `\n` 정규화
- ✅ **Rate Limit** (1초 쿨다운, 분당 30개)
- ✅ **빈 메시지/특수문자만** 거부

### 2.2 채널
- ✅ **이름 길이** ≤ 20자 (`CHANNEL.MAX_NAME_LENGTH`)
- ✅ **Trim** 적용
- ✅ **Slug 변환** (한글 `가-힣` 유지)

### 2.3 닉네임
- ✅ **길이** ≤ 12자 (`MAX_NICKNAME_LENGTH`)
- ✅ **기본값** "익명" (`DEFAULT_NICKNAME`)
- ✅ **잠금 옵션** (사칭 방지)

### 2.4 SessionID
- ✅ **정규식** `[a-zA-Z0-9_-]{1,200}`

### 2.5 Dead Drop
- ✅ **길이** ≤ 10000자 (`DEAD_DROP.MAX_MESSAGE_LENGTH`)
- ✅ **30분 TTL**

### 2.6 파일
- ✅ **최대 100MB** (`UPLOAD.MAX_BYTES`)
- ✅ **파일명 escapeHtml** (XSS 방지, `public/js/file-upload.js`)
- ✅ **URL 검증** (`src/utils/helpers.js:isValidFileUrl`)
  - https 또는 `/api/file/` prefix만 허용

## 3. XSS / CSRF

### 3.1 클라이언트 출력 인코딩
- ✅ **`escapeHtml()`** (`public/js/utils.js`)
  - `file-upload.js` 파일명
  - `admin-render.js` 에러 로그, 세션, 메시지
  - `chat.js` 메시지 컨텐츠
- ✅ **마크다운 렌더링 시 화이트리스트**
  - URL: `https?://`, `www.`, bare-domain
  - 비-https는 `path-style`만 허용 (`utils.isValidUrl`)
- ✅ **`.well-known/security.txt` 도메인 화이트리스트**

### 3.2 CSP (Content Security Policy)
- ✅ **strict CSP** (`public/_headers`)
  - `script-src`: cdnjs, cloudflareinsights, challenges.cloudflare.com
  - `connect-src`: file.kalpha.kr, api.kalpha.kr, wss:, ws:
  - `img-src`: file.kalpha.kr, https:, data:
  - `frame-src`: kalpha.kr
  - `object-src`: 'none'
  - `base-uri`: 'self'

### 3.3 CSRF
- ✅ **Bearer 토큰** (쿠키 미사용)
- ✅ **SameSite 정책** (쿠키 미사용으로 자연 보호)

## 4. Rate Limiting

### 4.1 다층 구조
- ✅ **전역** (`src/utils/rate-limiter.js`)
  - 인메모리, 5분 cleanup, per-worker 인스턴스
  - Stale entry 자동 제거
- ✅ **엔드포인트별** (`API_RATE_LIMIT` 상수)
  - config, push, turnstile, upload, health, check-ban, logs/error
- ✅ **사용자별 (메시지)** (ChatRoom DO)
  - 1초 쿨다운, 분당 30개 슬라이딩 윈도우
  - `joinTime` 기반 → 슬라이딩 윈도우로 교체 (2026-05-18)
- ✅ **관리자 로그인**
  - 5회 실패 → 5분 차단

### 4.2 IP 차단
- ✅ **연결 수 제한** 25개/IP (`RATE_LIMIT.MAX_CONNECTIONS_PER_IP`)
- ✅ **IP + SessionID 이중 차단** (`bannedIPs` + `bannedSessions` Map)
  - 재접속 시 sessionId 자동 삭제 (`kicked` 메시지 + 클라이언트 처리)
  - 영구 차단 옵션 (`banDuration: 0`)

## 5. SQL Injection

### 5.1 D1 쿼리
- ✅ **모든 쿼리 파라미터 바인딩** (`?` placeholder)
  - 위치: `src/handlers/admin.js`, `src/utils/logger.js`
  - 적용: `handleAdminLogs`, `handleAdminAuditLogs`, `logAdminActivity`, `logAuditLog`, `logErrorLog`
- ✅ **타입 강제 변환**
  - `String()`, `Number()` 적용
  - LIMIT, OFFSET 등 정수형 검증

## 6. 보안 헤더

### 6.1 `public/_headers`
- ✅ **X-Content-Type-Options: nosniff**
- ✅ **X-Frame-Options: ALLOW-FROM https://kalpha.kr**
- ✅ **X-XSS-Protection: 1; mode=block**
- ✅ **Referrer-Policy: strict-origin-when-cross-origin**
- ✅ **Permissions-Policy: camera=(), microphone=(), geolocation=()**
- ✅ **Strict-Transport-Security: max-age=31536000; includeSubDomains; preload**
- ✅ **Cross-Origin-Opener-Policy: same-origin**
- ✅ **Cross-Origin-Embedder-Policy: credentialless**
- ✅ **Cross-Origin-Resource-Policy: same-site**

### 6.2 CORS
- ✅ **명시적 화이트리스트** (`SECURITY.ALLOWED_ORIGINS`)
- ✅ **Origin 헤더 검증** (`src/utils/cors.js:getCorsHeaders`)
- ✅ **Preflight 204** (`handleCorsPreflightResponse`)

## 7. 봇 방지

### 7.1 Cloudflare Turnstile
- ✅ **Site Key** 환경변수 (`wrangler.toml` vars)
- ✅ **Secret Key** 시크릿 (`wrangler secret put TURNSTILE_SECRET_KEY`)
- ✅ **세션 만료 4시간** (`TURNSTILE_CLIENT.SESSION_AGE_MS`)
- ✅ **위젯 자동 폴링** (최대 50회 × 100ms)
- ✅ **에러/만료 콜백 처리** (`public/js/turnstile.js`)

## 8. 푸시 알림 보안

### 8.1 VAPID
- ✅ **공개키/개인키 환경변수** (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`)
- ✅ **구독 검증** (`subscription.endpoint`, `keys.p256dh`, `keys.auth`)

### 8.2 FCM
- ✅ **Service Account JSON 환경변수** (`FCM_SERVICE_ACCOUNT`)
- ✅ **OAuth 2.0 JWT** (`src/utils/fcm-auth.js`)
- ✅ **404/410/UNREGISTERED 자동 정리**

### 8.3 Service Worker
- ✅ **`updateViaCache: 'none'`** (강제 업데이트)
- ✅ **`clients.claim`** (즉시 제어)
- ✅ **클라이언트 visible 체크** (백그라운드에서도 알림, focused 일 때만 차단)

## 9. 데이터 보존

| 데이터 | 위치 | 보존 기간 | 자동 삭제 |
|---|---|---|---|
| 채팅 메시지 | DO Storage | 12시간 | ✅ (5분 cleanup) |
| 공지 | DO Storage | 영구 | 수동 |
| Dead Drop | DO Storage | 30분 | ✅ TTL |
| 관리자 로그 | D1 `admin_activity_logs` | 30일 | ✅ (10% 확률 정리) |
| 감사 로그 | D1 `audit_logs` | 영구 | 수동 |
| 오류 로그 | D1 `error_logs` | 영구 | 수동 |
| 푸시 구독 | KV | 30일 | ✅ TTL |
| 차단 | DO 인메모리 | 시간 설정에 따라 | ✅ 만료 시 |
| 세션 | DO 인메모리 | 30분 비활성 | ✅ |

## 10. 시크릿 관리

### 10.1 환경변수 (`.dev.vars.example`)
- `ADMIN_ID`, `ADMIN_PASSWORD` — 관리자 자격 증명
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` — Web Push
- `TURNSTILE_SECRET_KEY` — Turnstile 서버 검증
- `FCM_SERVICE_ACCOUNT` — FCM v1 인증
- `HMAC_SECRET` — 내부 토큰, 메시지 서명
- `FILE_UPLOAD_URL` — Kalpha 파일 API
- `KALPHA_API_URL` — Kalpha 보안 헤더 API

### 10.2 시크릿 처리
- ✅ **`wrangler secret put`** 사용 (저장소 평문 저장 금지)
- ✅ **CI/CD에서 GitHub Secrets** 사용
- ✅ **`.dev.vars`는 .gitignore** 등록
- ❌ **코드 내 하드코딩 금지** (Site Key만 예외, 클라이언트 공개용)

## 11. 정기 점검 체크리스트

### 11.1 주간
- [ ] D1 로그 테이블 크기 확인 (무료 티어 한도 5GB)
- [ ] 오류 로그 확인 (`/api/admin/delete-error-logs`)
- [ ] 차단 IP 목록 검토 (`/api/admin/banned-ips`)

### 11.2 월간
- [ ] `npm audit` (의존성 취약점)
- [ ] `npm outdated` (업데이트 검토)
- [ ] CSP 위반 리포트 검토 (Cloudflare Analytics)
- [ ] Cloudflare 보안 이벤트 검토 (Dashboard → Security)

### 11.3 분기
- [ ] 시크릿 로테이션 (`HMAC_SECRET`, `VAPID_*`, `TURNSTILE_SECRET_KEY`)
- [ ] 보안 헤더 재점검 (Mozilla Observatory 등)
- [ ] 침투 테스트 (OWASP Top 10)
- [ ] 의존성 메이저 업그레이드 검토

### 11.4 연간
- [ ] 보안 정책 재검토 (본 문서)
- [ ] GDPR/K-PIPA 컴플라이언스 점검
- [ ] BCP (사업연속성 계획) 업데이트
- [ ] 사고 대응 훈련

## 12. 사고 대응

### 12.1 신고 접수
- **공개 이슈 금지** — git history에 노출
- **dev@kalpha.kr** (PGP 키: SECURITY.md 참고)
- 24시간 내 1차 응답, 7일 내 패치 목표

### 12.2 심각도 분류
- **Critical**: 인증 우회, RCE, 데이터 유출 → 즉시 패치
- **High**: XSS, 권한 상승, Rate Limit 우회 → 7일
- **Medium**: 정보 노출, DoS 가능성 → 30일
- **Low**: 베스트 프랙티스 위반 → 다음 릴리스

### 12.3 롤백 절차
1. `wrangler rollback` (Cloudflare Pages)
2. D1 마이그레이션은 forward-only — 호환성 보장 필요
3. DO는 자동 마이그레이션 없음 — 코드 변경 필요

## 13. 컴플라이언스

- ✅ **개인정보처리방침**: `public/privacy.html` (v1.2, 2026-04-09 시행)
- ✅ **이용자 권리**: 열람, 정정, 삭제, 처리정지
- ✅ **보유 기간 명시**: 표 형태로 공개
- ✅ **안전조치**: 6. 안전조치 섹션
- ✅ **문의처**: dev@kalpha.kr
- ✅ **RFC 9116**: `.well-known/security.txt` (Expires 2027-04-13)

## 14. 알려진 제약

- **참고: 익명성의 한계** — IP는 Cloudflare가 보유 (로깅 안 함)
- **참고: 관리자 비밀번호 평문 비교** — 향후 Argon2 도입 검토
- **참고: 메시지 영구 저장 없음** — 사고 시 증거 부족 가능
- **참고: D1 무료 한도** — 일 10만 write, 트래픽 급증 시 제한

## 15. 참고

- [SECURITY.md](../SECURITY.md) — 공개 보안 정책
- [src/utils/security.js](../src/utils/security.js) — 보안 헬퍼
- [src/utils/validate.js](../src/utils/validate.js) — 입력 검증
- [src/middleware/auth.js](../src/middleware/auth.js) — 관리자 인증
- [public/_headers](../public/_headers) — 보안 헤더 정의
- [wrangler.toml](../wrangler.toml) — 환경변수 선언
