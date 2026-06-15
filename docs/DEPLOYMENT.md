# 배포 가이드

Anonymous Chat을 Cloudflare Pages + Workers에 배포하는 절차입니다.

---

## 목차

- [개요](#개요)
- [1. 사전 준비](#1-사전-준비)
- [2. 시크릿 설정](#2-시크릿-설정)
- [3. D1 데이터베이스 설정](#3-d1-데이터베이스-설정)
- [4. KV 네임스페이스](#4-kv-네임스페이스-선택)
- [5. Durable Objects 바인딩](#5-durable-objects-바인딩)
- [6. AI 바인딩](#6-ai-바인딩)
- [7. 빌드](#7-빌드)
- [8. 로컬 개발](#8-로컬-개발)
- [9. 프로덕션 배포](#9-프로덕션-배포)
- [10. 도메인 설정](#10-도메인-설정)
- [11. 모니터링](#11-모니터링)
- [12. 롤백](#12-롤백)
- [13. 성능 튜닝](#13-성능-튜닝)
- [14. 트러블슈팅](#14-트러블슈팅)
- [15. 배포 후 체크리스트](#15-배포-후-체크리스트)
- [16. 참고](#16-참고)

---

## 개요

| 단계 | 작업 | 소요 시간 |
|---|---|---|
| 1 | 사전 준비 (계정, 도구) | 5분 |
| 2 | 시크릿 설정 (7종) | 10분 |
| 3 | D1 데이터베이스 생성 + 마이그레이션 | 5분 |
| 4 | KV 네임스페이스 (선택) | 2분 |
| 5-6 | DO/AI 바인딩 (자동) | 0분 |
| 7 | 빌드 | 1분 |
| 8 | 로컬 테스트 | 10분 |
| 9 | 프로덕션 배포 | 5분 |
| 10-16 | 도메인/모니터링/롤백 설정 | 20분 |

총 예상 소요: 약 1시간

---

## 1. 사전 준비

### 1.1 계정/도구
- Cloudflare 계정 (Free 또는 Paid)
- Node.js 18+ 설치
- Wrangler CLI: `npm install -g wrangler`
- Git 저장소 (GitHub/GitLab)

### 1.2 Cloudflare 인증
```bash
wrangler login
# 브라우저에서 OAuth 인증
```

## 2. 시크릿 설정

### 2.1 필수 시크릿
```bash
# 관리자
wrangler secret put ADMIN_ID
wrangler secret put ADMIN_PASSWORD

# 메시지 서명 + 내부 토큰
wrangler secret put HMAC_SECRET
# openssl rand -hex 32 결과값 사용 권장

# Web Push (VAPID)
wrangler secret put VAPID_PUBLIC_KEY
wrangler secret put VAPID_PRIVATE_KEY
# 생성: npx web-push generate-vapid-keys

# Cloudflare Turnstile
wrangler secret put TURNSTILE_SECRET_KEY
# https://dash.cloudflare.com → Turnstile → Site Key/Secret Key

# FCM (선택, Android 알림)
wrangler secret put FCM_SERVICE_ACCOUNT
# Firebase Console → Project Settings → Service Accounts → Generate Key
# JSON 내용을 한 줄로 입력
```

### 2.2 환경변수 (vars)
`wrangler.toml`에 이미 정의되어 있음 (수정 가능):
```toml
[vars]
TURNSTILE_SITE_KEY = "0x4AAA..."
FILE_UPLOAD_URL = "https://file.kalpha.kr/api/files"
KALPHA_API_URL = "https://api.kalpha.kr"
```

## 3. D1 데이터베이스 설정

### 3.1 생성
```bash
wrangler d1 create anonymous-chat-db
# 출력: database_id = "xxxx-xxxx-xxxx-xxxx"
```

### 3.2 `wrangler.toml` 업데이트
```toml
[[d1_databases]]
binding = "DB"
database_name = "anonymous-chat-db"
database_id = "여기에-위에서-받은-ID"
migrations_dir = "migrations"
```

### 3.3 마이그레이션 실행
```bash
# 프로덕션
wrangler d1 migrations apply anonymous-chat-db --remote

# 로컬 테스트
wrangler d1 migrations apply anonymous-chat-db --local
```

생성되는 테이블:
- `admin_activity_logs` — 관리자 로그인/로그아웃/활동
- `audit_logs` — 관리자 액션 (kick, edit, delete 등)
- `error_logs` — 클라이언트/서버 오류

## 4. KV 네임스페이스 (선택)

### 4.1 생성
푸시 알림 구독 저장용 (선택적, Workers 기본 동작은 메모리/DO Storage).
```bash
wrangler kv:namespace create PUSH_SUBSCRIPTIONS
# 출력: id = "yyyy"
```

### 4.2 `wrangler.toml` 업데이트
```toml
[[kv_namespaces]]
binding = "PUSH_SUBSCRIPTIONS"
id = "여기에-ID"
```

## 5. Durable Objects 바인딩

`wrangler.toml`에 이미 정의됨 (수정 불필요):
```toml
[[durable_objects.bindings]]
name = "CHAT_ROOM"
class_name = "ChatRoom"

[[durable_objects.bindings]]
name = "CHANNEL_REGISTRY"
class_name = "ChannelRegistry"

[[durable_objects.bindings]]
name = "DEAD_DROP_STORE"
class_name = "DeadDropStore"

[[durable_objects.migrations]]
tag = "v1"
new_classes = ["ChatRoom", "ChannelRegistry", "DeadDropStore"]
```

**중요**: DO 클래스 이름 변경 시 마이그레이션으로 새 클래스 추가 후 옛 클래스 제거 (Workers는 rename을 지원하지 않음).

## 6. AI 바인딩

`wrangler.toml`에 정의됨:
```toml
[ai]
binding = "AI"
```

**제한**:
- Free tier: Workers AI 일일 한도 있음
- 사용 모델: `@cf/qwen/qwen3-30b-a3b-fp8`, `@cf/qwen/qwen1.5-7b-chat` (둘 다 무료 티어 지원)

## 7. 빌드

### 7.1 클라이언트 번들
```bash
npm install
npm run build
# 출력: public/js/chat.bundle.js, public/js/admin.bundle.js, public/css/tailwind.min.css
```

### 7.2 빌드 스크립트 (`package.json`)
```json
{
  "scripts": {
    "build": "node build.js",
    "dev": "wrangler dev",
    "deploy": "npm run build && wrangler pages deploy public",
    "lint": "eslint src/ public/js/ test/",
    "test": "vitest run"
  }
}
```

## 8. 로컬 개발

### 8.1 `.dev.vars` 파일
프로젝트 루트에 생성 (gitignore 확인):
```bash
cp .dev.vars.example .dev.vars
# 각 시크릿 값 입력
```

### 8.2 개발 서버 시작
```bash
npm run dev
# http://localhost:8788
```

**기능**:
- 핫 리로드 (Worker 코드)
- 로컬 D1 (`.wrangler/state/`)
- 로컬 KV (`.wrangler/state/`)
- 로컬 DO 인스턴스

### 8.3 디버깅
- `wrangler tail` (프로덕션 로그)
- `wrangler dev --local` (로컬 한정)
- `console.log`는 `wrangler dev` 콘솔에 출력

## 9. 프로덕션 배포

### 9.1 Git 연동 (권장)
Cloudflare Dashboard → Pages → 프로젝트 생성 → Git 저장소 연결.

**빌드 설정**:
- Build command: `npm run build`
- Build output: `public`
- Root directory: `/`

**환경변수**:
- Dashboard → Settings → Environment variables
- Production / Preview 각각 설정 가능

### 9.2 CLI 배포
```bash
npm run deploy
# 또는
wrangler pages deploy public
```

### 9.3 배포 후 확인
1. https://your-domain.com 접속
2. WebSocket 연결 테스트 (메시지 전송)
3. 관리자 로그인 (`/administrator.html`)
4. 푸시 알림 테스트
5. D1 로그 확인

## 10. 도메인 설정

### 10.1 Cloudflare Pages 도메인
- Pages Dashboard → Custom domains
- `chat.example.com` 추가 (CNAME)

### 10.2 DNS
Cloudflare가 자동 관리 (CNAME flat).

### 10.3 SSL/TLS
- Full (Strict) 모드 권장
- HSTS 프리로드 등록 (도메인 사전 검증 필요)

## 11. 모니터링

### 11.1 Cloudflare 내장
- Pages → Analytics (트래픽, 에러율)
- Workers → Logs (실시간 로그, `wrangler tail`)
- D1 → Metrics (쿼리 수, 지연)

### 11.2 외부 도구 (선택)
- Sentry (오류 추적)
- Plausible/Umami (분석)
- Uptime Kuma (가동 시간)

## 12. 롤백

### 12.1 Pages 즉시 롤백
- Dashboard → Pages → Deployments → 이전 배포 → "Rollback to this deployment"

### 12.2 CLI
```bash
wrangler pages deployments list
wrangler pages deployments rollback <deployment-id>
```

### 12.3 D1 마이그레이션 롤백
**D1은 forward-only**. 호환성 깨는 변경 시:
1. 새 컬럼 추가 시 항상 nullable 또는 default 값
2. 컬럼 삭제는 2단계 마이그레이션 (rename → drop in next release)
3. 코드에서 양쪽 스키마 모두 호환되도록 작성

## 13. 성능 튜닝

### 13.1 Worker
- 메모리: 128MB 한도
- CPU: 10ms (Free) / 50ms (Paid) — 평균
- 리전별 캐시 활용: `caches.default`

### 13.2 Durable Objects
- 메모리: 128MB per DO
- Storage: 1GB per DO
- WebSocket: 32K 동시 연결 (실제로는 메모리에 따라)
- 분산: `getChatRoom()`이 sticky session 보장

### 13.3 D1
- 읽기: 일 5백만 (Free) / 5천만 (Paid)
- 쓰기: 일 10만 (Free) / 100만 (Paid)
- 인덱스: `migrations/*.sql`에 정의

### 13.4 Cache 전략
- OG Preview: 1시간 (Edge + Client LRU 50)
- 정적 자산: Cloudflare 자동 (1년 immutable)
- API 응답: 대부분 캐시하지 않음 (실시간성 우선)

## 14. 트러블슈팅

### 14.1 WebSocket 연결 실패
- Origin 헤더 확인 → `SECURITY.ALLOWED_ORIGINS` 추가
- `/api/check-ban` 200 확인
- `HMAC_SECRET` 일치 확인

### 14.2 푸시 알림 미수신
- VAPID 키 일치 확인
- `Notification.permission === 'granted'`
- Service Worker 등록 확인 (`/sw.js`)
- KV 키 TTL 확인 (30일)

### 14.3 D1 오류
- 마이그레이션 순서 확인
- 파라미터 바인딩 확인 (SQL Injection 방어로 `?` placeholder 강제)
- 인덱스 사용 확인 (`EXPLAIN QUERY PLAN`)

### 14.4 AI 요약 실패
- 모델 사용 가능 확인 (`qwen3-30b-a3b-fp8`, `qwen1.5-7b-chat`)
- 8초 타임아웃 내 완료
- 일일 한도 확인

## 15. 배포 후 체크리스트

- [ ] 시크릿 7종 모두 설정
- [ ] D1 마이그레이션 적용
- [ ] DO 마이그레이션 적용
- [ ] KV 네임스페이스 생성 (선택)
- [ ] 도메인 연결
- [ ] SSL/TLS Full (Strict)
- [ ] CSP 위반 없음 (Cloudflare Analytics)
- [ ] 관리자 로그인 동작
- [ ] WebSocket 채팅 동작
- [ ] AI 요약 동작
- [ ] 푸시 알림 동작
- [ ] OG 프리뷰 동작
- [ ] 채널 생성/참가 동작
- [ ] 데드드롭 비밀 메시지 동작
- [ ] 모바일 반응형 확인
- [ ] Lighthouse 점수 90+

## 16. 참고

- [docs/DEVELOPMENT.md](./DEVELOPMENT.md) — 개발 가이드
- [docs/SECURITY.md](./SECURITY.md) — 보안 체크리스트
- [wrangler.toml](../wrangler.toml) — Cloudflare 설정
- [Cloudflare Pages 문서](https://developers.cloudflare.com/pages)
