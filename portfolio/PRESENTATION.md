# Anonymous Chat — 발표 자료

> **Cloudflare Workers 기반 익명 실시간 채팅 플랫폼**  
> 학교 개인 프로젝트 / 포트폴리오용 발표 자료

---

## 📋 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [왜 만들었는가?](#2-왜-만들었는가)
3. [기술 스택 & 선정 이유](#3-기술-스택--선정-이유)
4. [아키텍처 (4계층)](#4-아키텍처-4계층)
5. [핵심 기능 소개](#5-핵심-기능-소개)
6. [보안 설계 (핵심 차별점)](#6-보안-설계-핵심-차별점)
7. [시연 시나리오 (5분 데모)](#7-시연-시나리오-5분-데모)
8. [기술적 도전 & 트러블슈팅](#8-기술적-도전--트러블슈팅)
9. [프로젝트 통계](#9-프로젝트-통계)
10. [발전 가능성 & 로드맵](#10-발전-가능성--로드맵)
11. [Q&A 15선](#11-qa-15선)
12. [부록: 발표 대본](#12-부록-발표-대본)

---

## 1. 프로젝트 개요

### 한 줄 요약
> **회원가입 없이 닉네임만으로 즉시 참여하는 익명 실시간 채팅, 12시간 후 모든 메시지 자동 소멸**

### 핵심 가치
- **익명성**: IP·이메일 저장 안 함, 닉네임은 클라이언트 로컬스토리지에만
- **휘발성**: 메시지 12시간 후 자동 삭제, 차단도 자동 만료
- **실시간성**: WebSocket 기반 즉시 전송
- **확장성**: 채널, 푸시 알림, 파일 공유, AI 요약까지 풀스택

### 타겟 유저
- 가벼운 잡담을 원하는 사람
- 부업/스터디/게임 등 임시 커뮤니티가 필요한 그룹
- 사내 익명 건의함

---

## 2. 왜 만들었는가?

### 동기
- **"카톡 단톡방은 무겁고, 디시/레딧은 가입이 필요하고, 트위터는 영구 저장이 된다"**
- → "가입 없이 가볍게 쓰고, 흔적도 안 남는" **하이브리드**를 만들고 싶었음
- Cloudflare Workers를 처음 접하면서 **"서버리스로 풀스택이 가능하다"**는 점에 매력을 느낌

### 학습 목표
1. **Edge Computing** 개념 실전 적용 (Cloudflare Workers)
2. **Durable Objects**를 통한 상태 관리 패턴 학습
3. **WebSocket** 프로토콜 직접 핸들링
4. **웹 보안** (CSP, HMAC, Rate Limiting) 실전 적용
5. **풀스택 아키텍처** 설계 능력

---

## 3. 기술 스택 & 선정 이유

| 영역 | 기술 | 선정 이유 |
|------|------|-----------|
| **런타임** | Cloudflare Workers | Edge 실행(전 세계 200+ POP), 콜드 스타트 < 5ms, 무료 티어 넉넉 |
| **상태** | Durable Objects | 채널별 인스턴스 분리, Sticky Session 보장, 단일 스레드로 Race Condition 방지 |
| **메인 DB** | Cloudflare D1 (SQLite) | 로그·감사 추적용, SQL 마이그레이션 관리 |
| **임시 저장** | Cloudflare KV | 푸시 구독, 일시적 상태 |
| **AI** | Workers AI (Qwen 1.5/3) | 운영 부담 없는 LLM 요약, `/summary` `/topic` `/mood` `/conflict` |
| **푸시** | Web Push (VAPID) + FCM v1 | 표준 Web Push + Android 호환 |
| **빌드** | esbuild | 10개 엔트리 코드 스플리팅, 1초 이내 빌드 |
| **프론트** | 바닐라 JS + CSS Custom Properties | 프레임워크 의존성 최소화, 학습 곡선 ↓ |
| **테스트** | Vitest | 112개 케이스, 19.4초 |
| **린팅** | ESLint + Prettier | 코드 스타일 통일 |

### 선택의 트레이드오프
- ❌ React/Vue 안 씀 → 번들 크기 ↓, 학습 ↑ (DOM 직접 제어)
- ❌ PostgreSQL 안 씀 → 글로벌 복제 어려움, 대신 D1로 충분
- ✅ 바닐라 JS → 포트폴리오에서 "프레임워크 없이도 풀스택 가능" 어필

---

## 4. 아키텍처 (4계층)

```
┌─────────────────────────────────────────────────────┐
│ Browser (chat.js)                                   │
│ - Web Crypto HMAC 서명                              │
│ - 7개 테마 CSS 변수                                  │
│ - Service Worker (PWA, 푸시 수신)                     │
└──────────────────┬──────────────────────────────────┘
                   │ HTTPS / WSS
┌──────────────────▼──────────────────────────────────┐
│ Cloudflare Edge — Worker (worker.js)                │
│ - 라우팅 (정적/API/WS/관리자)                         │
│ - Rate Limiting (KV/메모리)                          │
│ - CORS / 보안 헤더                                    │
└──┬──────────────┬──────────────────┬───────────────┘
   │              │                  │
   ▼              ▼                  ▼
┌────────┐   ┌─────────────┐   ┌──────────────┐
│ChatRoom│   │ChannelReg.  │   │DeadDropStore │
│  DO    │   │     DO      │   │     DO       │
│채널당 1│   │메타데이터   │   │비밀 메시지   │
└───┬────┘   └──────┬──────┘   └──────┬───────┘
    │               │                  │
    ▼               ▼                  ▼
┌────────────────────────────────────────────────────┐
│ Storage: D1 (로그) / KV (푸시) / AI (Qwen)         │
└────────────────────────────────────────────────────┘
```

### 3개 Durable Objects의 역할
| DO 클래스 | 책임 | 인스턴스 |
|-----------|------|----------|
| **ChatRoom** | WebSocket 연결, 메시지 fan-out, 리액션, 차단, 채널 관리 | 채널당 1개 (idFromName) |
| **ChannelRegistry** | 채널 목록·메타데이터, 영구 보관 | 1개 (singleton) |
| **DeadDropStore** | 30분 TTL 비밀 메시지, 1회 읽기 | 1개 (singleton) |

### 핵심 결정
- **WebSocket을 DO에서 직접 처리** → Sticky Session으로 클라이언트-DO 1:1 매칭
- **HMAC 메시지 서명** → 클라이언트 → DO 메시지 변조 방지
- **Ephemeral Token 모델** → 핸드셰이크 시 1회만 secret 전달, close 시 폐기
- **Worker ↔ DO 통신은 `X-Admin-Internal-Token`** → SSRF 방지

---

## 5. 핵심 기능 소개

### 👤 사용자 기능

| 기능 | 설명 | 기술적 포인트 |
|------|------|---------------|
| 즉시 입장 | 닉네임만 입력, 회원가입 없음 | localStorage + crypto.randomUUID() |
| 실시간 채팅 | WebSocket 메시지 즉시 전송 | 1초 쿨다운, 30msg/분 rate limit |
| 7가지 테마 | dark/light/midnight/amethyst/sunset/sakura/evernight | CSS Custom Properties (60+ 변수) |
| 메시지 반응 | 6종 이모지, 더블클릭 자동 좋아요 | 반응 카운트 Map |
| 답장 + 비밀 메시지 | 원본 미리보기, **Dead Drop** (30분 TTL, 1회 읽기) | 별도 DO 인스턴스 |
| 파일 공유 | 이미지/비디오/오디오/PDF, 100MB | 외부 file.kalpha.kr 프록시 |
| AI 요약 | `/summary` `/topic` `/mood` `/conflict` | Workers AI Qwen 3 30B → 1.5 7B fallback |
| 메시지 검색 | 키워드 + 태그(`#images` `#code` `#url`) | FTS-like substring 매칭 |
| 링크 프리뷰 | OG 태그 자동 파싱 + 보안 헤더 분석 | /api/preview SSRF 방어 |
| 코드 하이라이팅 | Prism.js + highlight.js 자동 감지 | 라인 수 / 알파 비율 heuristic |
| 다중 채널 | 주제별 독립 채팅방 | DO 인스턴스 분리 |
| 공지사항 | 일반/긴급 + 스케줄링 | D1 영구 저장, CSV 내보내기 |
| 푸시 알림 | VAPID Web Push + FCM v1 | 30일 TTL, 오프라인 유저용 |
| PWA | 홈 화면 추가, 오프라인 셸, 공유 대상 | manifest.json, sw.js |

### 🛠️ 관리자 기능

| 기능 | 설명 |
|------|------|
| 메시지 관리 | 수정 / 삭제 / 전체 삭제 (확인 모달) |
| 사용자 차단 | IP + SessionID 이중 (30초/5분/10분/영구) |
| 공지사항 | 발송/수정/삭제/긴급/만료 |
| 채널 관리 | 목록/상세/강제 삭제 |
| 감사 로그 | D1 영구 저장, 필터링, CSV 내보내기 |
| 오류 추적 | 자동 수집 + 다운로드 + 초기화 |
| 보안 이벤트 | 22가지 이벤트 타입, Risk Score, 자동 차단 추천 |
| 로그인 기록 | 성공/실패/차단/로그아웃 |

---

## 6. 보안 설계 (핵심 차별점)

### 6.1 Ephemeral Token 모델 (가장 자랑하고 싶은 설계)

```
[Client]                              [ChatRoom DO]
  │                                          │
  │ ◀────── WS Upgrade ──────────────────────▶│
  │                                          │
  │ ◀─── {type: "handshake",                 │
  │        secret: 32바이트 random} ───────────│
  │                                          │
  │  이후 모든 message/edit/delete에:          │
  │    HMAC-SHA256(                          │
  │      {content, sessionId, timestamp},     │
  │      secret                              │
  │    )  서명 첨부                            │
  │ ─────── signed message ─────────────────▶│
  │                                          │ 검증
```

**왜 중요한가?**
- 일반 채팅은 메시지가 **평문으로** 전송됨 → MITM이 변조 가능
- Ephemeral Token은:
  - **세션마다 32바이트 secret** 발급
  - 핸드셰이크 1회만 전달 → **유출 윈도우 최소화**
  - WS close 시 **즉시 폐기** → 재연결해도 이전 메시지 위조 불가

### 6.2 Triple-ban 시스템

```javascript
// IP / SessionID / Token 3가지로 다층 차단
banReason = {
  ip: '1.2.3.4',           // IPv4 직접 매치
  sessionId: 'user_abc',   // 세션 단위
  token: 'kicked-uuid'     // 강퇴 토큰 (가장 강력)
}
```

- IP만 차단하면 NAT 뒤 정상 사용자까지 차단
- Session만 차단하면 새로 연결하면 우회
- Token은 강퇴당한 사용자가 공유 IP를 재사용해도 무력화

### 6.3 보안 헤더 (한 줄에 압축)

```http
Content-Security-Policy: default-src 'self'; ...; upgrade-insecure-requests;
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Frame-Options: ALLOW-FROM https://kalpha.kr
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

### 6.4 Rate Limiting (4중)

| 레이어 | 대상 | 한도 |
|--------|------|------|
| L1 Worker 메모리 | IP + 엔드포인트 | 10/분 |
| L2 Worker KV | IP (로그인 등) | 5/5분 |
| L3 DO 메모리 | IP당 WebSocket 연결 | 25개 |
| L4 DO 메시지 쿨다운 | 세션당 | 1초 / 30msg/분 |

### 6.5 Risk Scoring (자동 차단 추천)

```javascript
// 22가지 보안 이벤트를 점수화 → IP당 누적 점수
{
  XSS_PAYLOAD: 65점,
  SQL_INJECTION: 70점,
  PATH_TRAVERSAL: 60점,
  TOKEN_INVALID: 50점,
  WS_FLOOD: 50점,
  // ... 카테고리 다양성 보너스 +20%
}
// 150점 → 자동 차단 추천, 300점 → critical
```

### 6.6 입력 Sanitization 3단계

1. **Client** → `sanitizeInput()` (제어 문자 제거)
2. **Worker** → `validate.js` (타입/길이/구조)
3. **DO** → `security-classifier.js` (XSS/SQLi/Path Traversal 패턴 매칭)

---

## 7. 시연 시나리오 (5분 데모)

### 데모 흐름 (5분)

| 시간 | 시연 내용 | 보여줄 것 |
|------|-----------|-----------|
| 0:00 | 메인 페이지 진입 | "회원가입 없이 닉네임만" 강조 |
| 0:30 | 메시지 전송 (테마 변경) | 7개 테마, WebSocket 즉시 반영 |
| 1:30 | 리액션 + 답장 | 이모지 6종, Dead Drop 옵션 |
| 2:30 | 파일 업로드 | 100MB 업로드 → OG 미리보기 |
| 3:30 | AI 요약 명령 | `/summary` → 한글로 요약 표시 |
| 4:00 | 새 탭 → 푸시 알림 수신 | PWA + Web Push |
| 4:30 | 관리자 로그인 → 메시지 삭제 | 감사 로그 자동 기록 |
| 5:00 | 보안 이벤트 대시보드 | Risk Score, 차단 추천 |

### 데모 전 체크리스트
- [ ] 두 개의 브라우저 (일반 + 시크릿) 열어두기
- [ ] 관리자 계정 미리 로그인
- [ ] 부하 테스트용 메시지 몇 개 미리 준비
- [ ] 네트워크 끊었다 복구 → WS 자동 재연결 보여주기
- [ ] 페이지 새로고침 → 12시간 후 메시지 자동 소멸 설명

---

## 8. 기술적 도전 & 트러블슈팅

### 🔥 도전 1: WebSocket 세션 동기화

**문제**: Durable Objects는 단일 스레드라서 race condition이 적지만, **여러 WebSocket이 같은 채널에 붙으면 메시지 fan-out이 필요**

**해결**:
```javascript
// ChatRoom DO 내부
this.sessions = new Map(); // sessionId → WebSocket

broadcast(message) {
  this.sessions.forEach((ws, sid) => {
    if (sid !== senderId) ws.send(JSON.stringify(message));
  });
}
```

### 🔥 도전 2: 100MB 파일 업로드 + Workers 제한

**문제**: Workers는 본문 크기 제한이 있음, request body를 통째로 메모리에 올릴 수 없음

**해결**: 파일 업로드는 **외부 서비스(file.kalpha.kr)에 프록시**하고 Worker는 `Authorization: Bearer` 헤더만 추가

### 🔥 도전 3: HMAC 서명 + Ephemeral Secret

**문제**: 매 메시지를 서명하려면 클라이언트가 secret을 들고 있어야 함 → 유출 위험

**해결**:
- secret은 **Web Crypto API의 non-extractable 키**로 import
- 메시지 전송 시 **in-memory로만** 사용 (localStorage 안 씀)
- WS close 시 secret 폐기

### 🔥 도전 4: 7개 테마 + Tailwind

**문제**: Tailwind의 `dark:` 변형자는 2개 테마만 지원

**해결**: **CSS Custom Properties + `[data-theme="xxx"]` 선택자**로 7개 테마 구현
```css
[data-theme="dark"]  { --c-bg-900: #111827; --c-tx-100: #F3F4F6; ... }
[data-theme="light"] { --c-bg-900: #F9FAFB; --c-tx-100: #111827; ... }
```

### 🔥 도전 5: PWA + 푸시 + 오프라인

**문제**: Service Worker가 페이지와 메시지 통신을 어떻게?

**해결**:
```javascript
// sw.js — 푸시 수신 시 페이지에 알림
self.addEventListener('push', e => {
  const data = e.data.json();
  e.waitUntil(self.registration.showNotification(data.title, data));
});
```

### 🐛 트러블슈팅 경험담
- **Cache-Control 1시간** → XSS 배포 시 1시간 지속 → 짧은 TTL로 해결
- **HSTS preload 신청** → `kalpha.kr` 도메인 mismatch 발견 → 도메인 일치시킴
- **Cloudflare D1 latency** → D1은 글로벌 복제 안 됨 → 로그성 데이터만 D1에, 핫패스는 DO 메모리

---

## 9. 프로젝트 통계

```
📦 코드베이스
  - 서버: 33개 JS 파일 (Worker + 3개 DO + 핸들러 + 유틸 + 미들웨어)
  - 클라이언트: 50+ JS 모듈 (chat.js 47KB, admin.js 20KB, ui mixin 5개)
  - 마이그레이션: 3개 SQL (admin_logs, log_tables, security_events)
  - 문서: 11개 (README, 5개 docs/, 디자인 스펙, CHANGELOG 등)
  - 총 라인 수: ~15,000줄

🧪 테스트
  - Vitest 112 cases (10개 파일)
  - 19.4초 만에 전체 통과
  - 커버리지 모듈: rate-limiter, helpers, security, classifier, risk-scorer, security-logger, security routes

🛡️ 보안 통제
  - 보안 이벤트 22가지 (4 카테고리, 4 severity)
  - 다층 rate limit (4중)
  - Triple-ban (IP + Session + Token)
  - 7가지 보안 헤더
  - HMAC + Ephemeral Token

⚡ 성능
  - chat.bundle.js 136KB (gzip ~40KB)
  - 코드 스플리팅 10개 청크
  - DO 단일 스레드로 race condition 0
  - Workers AI fallback (Qwen 3 → 1.5)
```

---

## 10. 발전 가능성 & 로드맵

### 단기 (1-2개월)
- [ ] CI/CD 파이프라인 (GitHub Actions)
- [ ] 핵심 DO (`ChatRoom.js`) 테스트 커버리지 0% → 60%
- [ ] 클라이언트 XSS 핫픽스 (markdown link sanitization)
- [ ] CSP nonce 도입 (인라인 핸들러 제거)

### 중기 (3-6개월)
- [ ] 종단간 암호화 (E2EE) — 비밀 메시지 확장
- [ ] 음성 메시지 (WebRTC)
- [ ] 다국어 (i18n) — 영어 UI
- [ ] 읽음 확인
- [ ] 이모지 picker UI

### 장기 (6개월+)
- [ ] 모바일 앱 (React Native / Capacitor)
- [ ] SSO 연동 (선택적)
- [ ] 자동 백업 + GDPR 준수 도구
- [ ] 자체 도메인 (kalpha.chat) + HSTS preload 정식 등록

---

## 11. Q&A 15선

> 발표 시간 15-20분, Q&A 10-15분 가정. 심사위원/교수가 자주 물어보는 질문 + 모범 답변.

### Q1. 왜 Cloudflare Workers를 선택했나요? AWS Lambda나 Vercel 대비 장점은?

**A**: 세 가지 결정적 이유가 있었습니다.

1. **Edge 실행**: Cloudflare는 전 세계 200+ POP에서 실행되어 한국 사용자가 미국 서버를 거치지 않습니다. Lambda는 region 단위라 서울 리전에서 도쿄 리전 사용자를 처리하면 레이턴시가 100ms+ 추가됩니다.
2. **Durable Objects**: WebSocket처럼 **sticky connection**이 필요한 워크로드에 최적화된 상태 관리 모델이 기본 제공됩니다. AWS에서는 API Gateway + DynamoDB + Lambda 조합으로 직접 구현해야 합니다.
3. **무료 티어**: 학교 프로젝트 특성상 비용 부담이 큰데, Workers는 하루 10만 요청 무료, D1은 5GB 무료, KV는 10만 read/day 무료. 데모용으로 충분합니다.

---

### Q2. Durable Objects가 뭔가요? 일반 데이터베이스와 무엇이 다른가요?

**A**: Durable Objects는 **"특정 ID에 대해 전 세계 어디서든 항상 같은 인스턴스"**에 접근할 수 있게 해주는 모델입니다.

일반 DB와의 차이:
- 일반 RDB: **여러 클라이언트가 동시에 같은 row**를 읽고 쓸 수 있음 → race condition, lock 필요
- Durable Objects: **한 ID당 인스턴스 1개**, 그 인스턴스에서 들어오는 요청은 **순차적으로** 처리됨

채팅에 어떻게 적용했냐면:
- 채널 슬러그 `"channel:general"`을 `idFromName("channel:general")`에 넣으면 → **항상 같은 DO 인스턴스**가 응답
- 그 인스턴스가 모든 WebSocket 연결을 관리 → 메시지 fan-out이 단순해짐
- 별도 lock 코드 없이도 race condition 방지

---

### Q3. HMAC 서명이 뭔가요? 왜 JWT 대신 썼나요?

**A**: **HMAC (Hash-based Message Authentication Code)**는 비밀 키를 공유하는 두 당사자가 메시지의 무결성을 검증하는 방식입니다.

```javascript
// 서명 생성
const sig = HMAC-SHA256(secret, message)

// 검증
const expectedSig = HMAC-SHA256(secret, message)
return sig === expectedSig
```

JWT를 안 쓴 이유:
1. **무겁다**: JWT는 header.payload.signature 3-part 구조 + Base64URL + 만료/발급자 claim. 매 메시지마다 오버헤드가 큼
2. **취소 어려움**: JWT는 stateless라 한 번 발급하면 만료 전까지 취소 불가. 관리자가 사용자 세션을 강제로 끊으려면 별도 blacklist 필요
3. **우리 용도에 과함**: 채팅 메시지마다 header/payload를 보낼 필요 없음. 단순히 "이 메시지가 이 세션에서 왔는가"만 알면 됨

그래서 자체 **Ephemeral Token 모델**을 만들었습니다 — 핸드셰이크 1회만 secret 전달, 그 후로는 secret으로 HMAC 서명만.

---

### Q4. 익명성을 어떻게 보장하나요? IP는 결국 알잖아요?

**A**: **3단계 익명성 보장**을 합니다.

1. **메타데이터 최소화**: 닉네임, 이메일, 전화번호 저장 안 함. 세션 ID는 클라이언트 `localStorage`에만 있고 서버는 검증용으로만 사용
2. **휘발성**: 메시지는 **12시간 후 자동 삭제**, 차단도 자동 만료
3. **IP의 용도 제한**: IP는 **rate limit + ban 용도**로만 사용. 사용자 식별/추적용 저장 안 함 (90일 후 자동 삭제)

다만, 솔직히 말씀드리면 **완전한 익명성은 아닙니다**. ISP는 트래픽을 볼 수 있고, Cloudflare는 로그를 볼 수 있어요. 진짜 익명성이 필요하면 Tor를 쓰거나 종단간 암호화(E2EE)를 추가해야 합니다. 이건 차후 로드맵에 있습니다.

---

### Q5. 부하 테스트는 해봤나요? 동시 접속자가 많으면 어떻게 되나요?

**A**: 정식 부하 테스트는 못 했고 (비용 문제), **아키텍처적 분석**을 했습니다.

- **Worker**: 자동 스케일 — 트래픽 100배 늘어도 100개 인스턴스가 뜸
- **Durable Object**: 채널당 1개 인스턴스 → 채널 1개에 동시 접속 1,000명까지는 문제 없음 (단일 스레드라 순차 처리되지만 1,000 WebSocket fan-out은 ms 단위)
- **병목 가능 지점**: D1 (SQLite, 글로벌 복제 안 됨). 그래서 로그성 데이터만 D1에 쓰고 핫패스(메시지 송수신)는 DO 메모리에서 처리

만약 진짜 대규모 서비스라면:
- 채널을 여러 region에 분산
- 메시지 fan-out을 DO 간 RPC로
- AI 요약은 큐에 넣고 비동기 처리

---

### Q6. 관리자 권한이 탈취되면 어떻게 되나요? 2FA가 없잖아요?

**A**: 솔직히 말씀드리면 이건 **프로덕션 환경에서 보완이 필요한 부분**입니다. 학교 프로젝트 수준에서는 단일 비밀번호로 충분하지만, 프로덕션이라면:

1. **2FA (TOTP)** 추가 — `auth.js`의 `generateAdminToken` 다음 단계로
2. **세션 무효화 UI** — 현재 로그인된 모든 관리자 세션 보기 + 강제 로그아웃
3. **IP allowlist** — 특정 IP에서만 관리자 페이지 접근 허용
4. **HMAC_SECRET 분리** — 지금은 메시지 서명·admin token·internal DO 통신이 같은 시크릿. 분리하면 1개 유출 시 피해 범위 ↓

이슈 트래커에 `feat: 2fa-admin` 항목으로 등록되어 있습니다.

---

### Q7. 메시지가 12시간 후 삭제된다고요? 진짜 삭제되나요? 백업은 없나요?

**A**: 진짜 삭제됩니다. 3가지 메커니즘:

1. **메모리**: ChatRoom DO 내부 `this.messages` 배열에서 splice
2. **DO Storage**: `state.storage.delete()` 호출
3. **D1**: `MESSAGE_RETENTION_MS` 초과 시 cleanup

**백업은 없습니다.** 이건 의도적 설계입니다. 익명 채팅이라 백업이 있으면 오히려 위험합니다. 단, **Cloudflare 자체 인프라 로그** (네트워크 로그, audit log)는 30일간 보존될 수 있습니다. 그건 사용자 동의 없이 삭제할 수 없습니다.

GDPR 측면에서 "right to be forgotten" 요청이 오면 → D1 + DO Storage + KV 모두에서 삭제하는 스크립트를 운영합니다.

---

### Q8. AI 요약은 어떻게 작동하나요? 사용자 데이터가 AI 회사에 가지 않나요?

**A**: **Workers AI**를 씁니다. Cloudflare 인프라 안에서 실행되는 **자체 호스팅** Qwen 1.5 7B / Qwen 3 30B 모델이라 외부로 데이터가 나가지 않습니다.

프롬프트에는:
- 최근 50개 메시지만 전달 (전체 X)
- sessionId, IP, 닉네임은 **명시적으로 제외**
- 시스템 프롬프트에 "PII(이름·전화·이메일) 출력 금지" 지시

요약 결과는 60초 캐시 → 같은 사용자가 같은 시간대에 재요청 시 재생성 안 함.

---

### Q9. 종단간 암호화(E2EE)는 안 하나요? 관리자가 메시지를 읽을 수 있잖아요.

**A**: 맞습니다. 현재는 **TLS로 전송 구간만 암호화**되어 있고, 서버는 평문 메시지를 봅니다. 관리자가 임의로 메시지를 읽을 수 있다는 뜻입니다.

E2EE를 안 한 이유:
1. **익명 채팅이라 "대화 상대방"이 누구인지 알 수 없음** — 공개키를 서로 교환할 메커니즘이 없음
2. **검색/AI 요약이 어려워짐** — 서버에서 메시지 내용을 봐야 하니까
3. **학교 프로젝트 범위 초과** — Signal Protocol 같은 검증된 라이브러리 통합은 단독 프로젝트로 1학기 분량

다만 향후 **Dead Drop (비밀 메시지)** 부터 E2EE를 적용할 계획입니다. 1:1 통신이라 공개키 교환이 명확하고, 관리자도 읽을 수 없어야 하는 기능이라 정당성이 큽니다.

---

### Q10. 왜 React/Vue를 안 썼나요? 바닐라 JS로 가능한가요?

**A**: **포트폴리오 차별화**가 가장 큰 이유입니다.

채팅, 검색, 라이트박스, 모달, 컨텍스트 메뉴 등 50+ 모듈을 바닐라 JS로 구현하면:
- DOM API, 이벤트 버블링, 비동기 처리, 메모리 관리에 대한 **깊은 이해** 증명
- 면접관이 "React 없이 어떻게 하셨어요?"라고 물으면 **이야기할 거리**가 생김
- 번들 크기 ↓ (React + ReactDOM이 ~140KB인데 우리는 0KB)

바닐라 JS로 SPA를 짜면서 생긴 과제:
- 상태 관리: mixin 패턴 (`Object.assign(UIManager.prototype, ...)`) + Pub/Sub
- 라우팅: URL hash + `popstate`
- 메모리: `URL.createObjectURL` 명시적 revoke, 이벤트 리스너 cleanup
- 모듈: ES Modules + esbuild 코드 스플리팅

대신, **큰 팀에서는 비현실적**입니다. 1인 프로젝트라 가능한 선택이었어요.

---

### Q11. CSP에서 `'unsafe-inline'`과 `'unsafe-eval'`을 왜 허용하나요?

**A**: 솔직히 이건 **개선이 필요한 부분**입니다. 허용한 이유:

- **esbuild가 일부 inline script를 생성**할 수 있음
- **초기 개발 단계에서 빠른 반복**을 위해 인라인 핸들러(`onclick="..."`)를 사용 — 약 100+개

공격자가 이걸 악용하면:
- Stored XSS (마크다운 링크) 가능 — 발견되어 수정 예정
- Inline event handler injection — 데이터 검증으로 방어 중

**로드맵**:
1. 모든 `onclick="..."`을 `addEventListener` + `data-*` 속성으로 리팩토링
2. Tailwind 빌드 시 인라인 스타일 제거
3. CSP nonce 도입

---

### Q12. 확장 시 어디가 가장 먼저 병목이 될까요?

**A**: 단연 **D1 (SQLite)** 입니다.

Cloudflare D1은:
- **글로벌 복제 안 됨** (단일 리전)
- **읽기/쓰기 지연** 30-100ms
- **트랜잭션 제한** (한 번에 한 region)

그래서 현재는:
- **로그성 데이터**만 D1 (감사 로그, 보안 이벤트, 에러 로그)
- **핫 패스**는 DO 메모리 (메시지, 세션, 리액션)

확장이 필요해지면:
- 1단계: **Workers Analytics Engine**로 로그 이전 (더 빠름)
- 2단계: **외부 DB (Postgres on Neon, PlanetScale)** 도입
- 3단계: **실시간 부분만 DO**, 영구 저장은 외부

---

### Q13. 라이선스는 AGPL-3.0인데 왜 상업용 라이선스도 따로 있나요?

**A**: AGPL-3.0은 **"소스코드 공개 + 동일 라이선스"** 의무가 있습니다. 누군가 내 서비스를 SaaS로 제공해서 수익을 내려면 **내 소스코드도 공개해야 해요**.

저는 이 프로젝트로 나중에 사업화할 여지를 남겨두고 싶어서:
- **AGPL-3.0** — 오픈소스 사용자용 (자유롭게 쓰세요, 수정해도 공개만 해주세요)
- **COMMERCIAL_LICENSE.md** — 사업자가 라이선스 비용을 내면 AGPL 의무 면제

이중 라이선스 모델은 MongoDB, MariaDB, Sentry 같은 회사들도 쓰는 검증된 패턴입니다.

---

### Q14. 이 프로젝트로 무엇을 배우고 싶은가요? (또 무엇을 배웠나요?)

**A**: **(개인 답변 영역 — 자유롭게 작성)**

예시:
- "Edge Computing의 실전 적용"
- "상태 관리 패턴 (특히 Sticky Connection)"
- "웹 보안을 코드로 구현하는 법 (CSP, HMAC, Rate Limit)"
- "풀스택 아키텍처 설계 — 단일 인스턴스에서 모든 책임을 다루는 법"

---

### Q15. 다음에 만들고 싶은 게 있나요?

**A**: **(개인 답변 영역 — 자유롭게 작성)**

예시:
- "E2EE 메신저 (Signal Protocol 학습)"
- "분산 트랜잭션을 지원하는 가계부 앱"
- "WebRTC 기반 화상 채팅"

---

## 12. 부록: 발표 대본

> 5분 발표 + 5분 Q&A 기준. 자연스럽게 말하되 핵심 키워드는 반드시 포함.

### 0:00 - 0:30 인트로

> "안녕하세요, 오늘 발표할 프로젝트는 **Anonymous Chat**입니다.  
> Cloudflare Workers로 만든 익명 실시간 채팅인데요, 한 마디로 요약하면 **'카톡의 가벼움 + 디시의 익명성 + 12시간 자동 소멸'**을 합친 서비스입니다.  
> 발표 순서는 기술 스택 → 아키텍처 → 핵심 기능 → 보안 설계 → 시연 → Q&A 순으로 진행하겠습니다."

### 0:30 - 1:30 왜 만들었는가 + 스택

> "먼저 왜 만들었냐면, 기존 채팅 서비스들의 단점을 해결하고 싶었습니다.  
> 카톡은 무겁고, 디시/레딧은 가입이 필요하고, 트위터는 영구 저장되고요.  
> '가입 없이 가볍게 쓰고, 흔적도 안 남는' 게 있으면 좋겠다 싶어서요.  
> 기술 스택은 Cloudflare Workers + Durable Objects + D1 + KV로, 모두 **서버리스**입니다.  
> 특히 Durable Objects는 **채널당 인스턴스 1개**를 보장해서, race condition 없이 메시지 fan-out이 가능해요."

### 1:30 - 2:30 아키텍처 & 핵심 기능

> "아키텍처는 4계층입니다 — 브라우저 → Worker → Durable Objects → Storage.  
> 핵심 기능은 익명 입장, 7개 테마, WebSocket 실시간 채팅, 파일 100MB 업로드, AI 요약, 푸시 알림, PWA, 관리자 대시보드, 그리고 **데드드롭**이라고 불리는 비밀 메시지 기능까지 — 총 14가지입니다."

### 2:30 - 3:30 보안 (가장 강조)

> "제가 **자랑하고 싶은 부분**은 보안 설계입니다.  
> 첫 번째, **Ephemeral Token 모델** — 세션마다 32바이트 secret을 발급해서 매 메시지를 HMAC-SHA256으로 서명합니다. secret은 WS close 시 즉시 폐기돼요.  
> 두 번째, **Triple-ban 시스템** — IP, 세션, 토큰 3가지로 다층 차단합니다.  
> 세 번째, **CSP, HSTS, COOP/COEP** 등 7가지 보안 헤더를 적용했고요.  
> 마지막으로, **Risk Scoring** — 22가지 보안 이벤트를 점수화해서 누적 점수가 임계치 넘으면 자동 차단을 추천합니다."

### 3:30 - 4:30 시연

> "이제 직접 보여드리겠습니다. *(시연 시작)*  
> 닉네임 '발표자1'로 입장하고 메시지를 보냈더니 — *(반응 보이기)* — 즉시 반영되고, 테마도 바꿔보고...  
> *(파일 업로드, 리액션, AI 요약, 푸시 알림 순서대로 시연)*"

### 4:30 - 5:00 마무리

> "정리하면, 이 프로젝트의 핵심 가치는 **익명성 + 휘발성 + 실시간성**입니다.  
> 학교 프로젝트로 시작했지만, 포트폴리오로 발전시킬 계획이고, 다음 단계는 **CI/CD**와 **E2EE**입니다.  
> 발표 마치겠습니다. 감사합니다."

---

## 📎 부록: 치트시트 (면접 대비 한 장 요약)

```
프로젝트명: Anonymous Chat
스택: Cloudflare Workers + DO + D1 + KV + Workers AI
규모: 서버 33파일, 클라이언트 50+ 모듈, 테스트 112건 통과
핵심 설계:
  1. Ephemeral Token (HMAC 서명, 32-byte secret)
  2. Triple-ban (IP + Session + Token)
  3. 4중 Rate Limit
  4. 7-Theme CSS Custom Properties
  5. 3개 Durable Object (ChatRoom/ChannelRegistry/DeadDropStore)
  6. Risk Scoring (22 events, auto-block recommendation)
가장 어려웠던 점: WebSocket fan-out in DO (해결: Map<sid, ws>)
가장 자랑스러운 점: 보안 헤더 + HMAC + Rate Limit 풀스택 적용
다음 단계: E2EE, CI/CD, 테스트 커버리지 확대
라이선스: AGPL-3.0 + 상업용 별도
```

---

**작성일**: 2026-06-24  
**프로젝트 버전**: v1.0  
**관련 문서**: [README.md](../README.md) · [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) · [docs/SECURITY.md](../docs/SECURITY.md)
