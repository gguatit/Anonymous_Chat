# Anonymous Chat

<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=22&pause=1000&color=A0A0A0&center=true&vCenter=true&width=435&lines=Establishing+secure+link...;Welcome+to+Anonymous+Chat." alt="Typing SVG" />

```text
    _                                                      
   / \   _ __   ___  _ __  _   _ _ __ ___   ___  _   _ ___ 
  / _ \ | '_ \ / _ \| '_ \| | | | '_ ` _ \ / _ \| | | / __|
 / ___ \| | | | (_) | | | | |_| | | | | | | (_) | |_| \__ \
/_/   \_\_| |_|\___/|_| |_|\__, |_| |_| |_|\___/ \__,_|___/
                           |___/                           
```

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![WebSocket](https://img.shields.io/badge/WebSocket-Real--time-4285F4?style=for-the-badge&logo=socket.io&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg?style=for-the-badge)](https://www.gnu.org/licenses/agpl-3.0)

완전 익명 실시간 채팅 애플리케이션  
Cloudflare Workers 기반 서버리스 아키텍처

[문서](#목차) · [버그 제보](https://github.com/gguatit/Anonymous_Chat/issues)

</div>

---

## 목차

- [최근 업데이트](#최근-업데이트)
- [주요 기능](#주요-기능)
- [프로젝트 개요](#프로젝트-개요)
- [아키텍처](#아키텍처)
- [빠른 시작](#빠른-시작)
- [보안 기능](#보안-기능)
- [플랫폼 호환성](#플랫폼-호환성)
- [고급 설정](#고급-설정)
- [테스트](#테스트)
- [배포](#배포)
- [문제 해결](#문제-해결)
- [기여](#기여)
- [라이선스](#라이선스)

---

## 최근 업데이트

### 2026년 3월 16일 - 관리자 보안 강화 및 고급 오류 추적 시스템 도입

#### 보안 및 인프라
- **강력한 내부 API 인증 (SSRF 방지)**: Worker와 Durable Object(DO) 간의 통신 시 `X-Admin-Internal-Token` 인증 헤더를 강제하여 공격자의 URL 파라미터 조작 및 내부 라우팅 탈취 완벽 차단.
- **Proxy URL 위조 방지**: Worker 진입단(`/api/logs/error`)에서 클라이언트의 주소를 서버가 재구성하여 DO에 전송하도록 패치. 이로써 Path Traversal 등 비정상 요청 사전 방어.

#### 시스템 오류 추적 시스템 (상세 로깅)
- **클라이언트 및 서버 오류 자동 수집**: `window.onerror` 및 Promise Rejection을 통해 사용자 환경(Device, Browser, IP) 기반 스택 트레이스를 DO에 실시간 저장.
- **영구 보존 및 링 버퍼**: 서버 RAM이 리셋되어도 유지가 되도록 오류 로그를 DO Storage 디스크에 영구 저장(`this.state.storage.put('errorLogs')`). 로그 기록 개수는 최대 100개로 최신순 자동 순환 관리(링 버퍼 구현).
- **에러 로그 다운로드 및 초기화**: 관리자 대시보드 내 "시스템 오류 로그" 탭에서 상세 내역 확인(유저 에이전트, 스택 트레이스)은 물론 JSON 형식 다운로드(`로그 다운로드`) 및 서버 완전 초기화 기능(`로그 초기화`) 추가.
- **UI 반응성 향상**: 관리자 로그인 Syntax 오류(`Uncaught SyntaxError`) 등 프론트엔드 버그 수정 및 관리자 패널의 텍스트 오버플로우 침범 해결.

### 2026년 3월 10일 - 코드 구문 강조 및 자동 감지 기능 추가

#### 스마트 코드 구문 강조
- **Prism.js 통합**: 가볍고 성능이 뛰어난 Prism.js를 활용한 코드 하이라이팅 (Tomorrow Dark 테마 적용)
- **코드 자동 감지 (Auto-Detection)**: 사용자가 \`\`\` 마커를 쓰지 않아도 자체 휴리스틱 엔진(`detectLanguage`)이 15개 이상의 언어(JavaScript, Python, C++, Go, Rust, SQL, HTML 등)를 자동으로 판별하여 하이라이팅 적용
- **다양한 형식 지원**: 다중 줄 코드 블록 및 인라인 코드(\`code\`) 지원
- **사용자 편의성**: 코드 블록 헤더에 감지된 언어명 표시 및 원클릭 '복사' 버튼 제공
- **보안 및 이중 이스케이프 방지**: 서버사이드 제어문자 필터링과 클라이언트 사이드 HTML 이스케이프 처리를 철저히 분리하여, `<script>` 등의 태그나 HTML 코드를 전송해도 깨짐(이중 이스케이프) 없이 안전하게 렌더링되도록 개선

### 2026년 2월 23일 - 성능 및 알림 시스템 개선

#### 메시지 로딩 성능 최적화
- **배치 전송 시스템 구현**: 서버에서 메시지를 개별 전송에서 배치 전송(`history` 타입)으로 변경
- **DocumentFragment 렌더링**: 클라이언트에서 DOM 업데이트를 일괄 처리하여 리플로우 최소화
- **성능 개선**: 50개 메시지 로딩 시간 500ms → 20ms (25배 향상)
- **네트워크 최적화**: 50번의 요청 → 1번의 요청으로 감소 (98% 감소)

#### 푸시 알림 시스템 최적화
- **Service Worker 필터링 개선**: `visible` 체크에서 `visible AND focused` 체크로 변경
  - 탭이 백그라운드에 있을 때도 알림 표시
  - 사용자가 실제로 채팅을 보고 있을 때만 알림 차단
- **구독 상태 UI 동기화**: 페이지 새로고침 시 기존 구독 상태 자동 반영
- **멀티 디바이스 지원**: 발신자가 여러 기기를 사용하는 경우 다른 기기에도 알림 전송
- **에러 처리 강화**: VAPID 설정 오류 감지 및 명확한 로깅
- **환경 변수 검증**: 푸시 알림 설정 누락 시 경고 메시지 표시
- **⚠️ 알려진 문제**: 현재 모든 플랫폼에서 푸시 알림 기능이 올바르게 작동하지 않습니다. 코드는 구현되어 있으나 실제 환경에서 알림이 정상적으로 전송되지 않을 수 있습니다.

#### UI/UX 개선
- **Platform-info 패널 업데이트**: 알림 기능 오류에 대한 명확한 경고 추가
- **배치 렌더링 로깅**: 메시지 로딩 과정을 콘솔에서 확인 가능

#### Android 완벽 지원
- **백그라운드 알림**: 앱이 완전히 종료된 상태에서도 푸시 알림 수신
- **VAPID 키 설정 완료**: Web Push API 완전 활성화
- **진동 패턴**: 알림 수신 시 진동 피드백 (200ms-100ms-200ms)
- **액션 버튼**: "채팅 열기", "닫기" 버튼 지원

---

## 프로젝트 개요

**완전 익명성 · 데이터 무보관 · 서버리스 · 오픈소스**

현대의 채팅 서비스는 대부분 사용자 데이터를 수집하고 저장합니다. 이 프로젝트는 다릅니다:

- 회원가입 불필요 (닉네임도 필요 없음)
- 메시지 영구 보관 안 함 (12시간 후 자동 삭제)
- 엣지 컴퓨팅 (Cloudflare 전 세계 데이터센터에서 실행)
- 저지연 (가까운 서버에서 응답, 평균 <50ms)
- 무료 호스팅 (Cloudflare Workers Free Tier 활용)

---

## 주요 기능

### 실시간 채팅

- WebSocket 기반 양방향 통신
- 평균 지연시간 <100ms
- 자동 재연결 (지수적 백오프)
- 타이핑 표시 실시간 동기화
- 메시지 수정 및 삭제 (10분 제한)
- **파일 공유** (이미지, 비디오, 오디오, 문서)

### 파일 공유 시스템

- 최대 100MB 파일 업로드
- 지원 형식: 이미지, 비디오, 오디오, PDF, 문서
- 실시간 업로드 진행 상태 표시
- 이미지 인라인 미리보기
- 비디오/오디오 스트리밍 재생
- 외부 API 서버 연동 (static.a85labs.net)

### 답장 및 비밀 메시지

- **메시지 답장**: 컨텍스트 메뉴(우클릭/길게 누르기)로 특정 메시지에 답장
- **비밀 메시지**: Dead Drop API 통합으로 일회성 비밀 메시지 전송
- **엄격한 접근 제어**: 비밀 메시지는 답장 보낸 사람과 받는 사람(targetSessionId)만 열람 가능
- **일회성 읽기**: 한 번 읽으면 영구 삭제 (1시간 TTL, 2000자 제한)
- **3자 보호**: 다른 사용자는 비밀 메시지 존재만 알 수 있고 내용은 볼 수 없음
- Dead Drop 제공: [kalpha.kr](https://api.kalpha.kr)

### 완전 익명

- 회원가입 및 로그인 불필요
- 닉네임 없는 익명 채팅
- 세션 기반 식별만 사용
- IP 주소 저장 안 함

### 임시 메시지 저장

- 최대 500개 메시지 저장
- 12시간 후 자동 삭제
- 입장 시 최근 50개 메시지 제공
- 메모리 내 저장 (DB 없음)

### 강력한 보안

- Rate Limiting (1초당 1개, 분당 30개)
- IP당 최대 5개 동시 연결
- XSS/CSRF 공격 방어
- HMAC-SHA256 메시지 서명
- Content Security Policy (CSP)

### 현대적인 UI/UX

- 다크 테마 (눈의 피로 감소)
- 반응형 디자인 (모바일/데스크톱)
- Tailwind CSS 기반
- 접근성 (ARIA) 준수
- 부드러운 애니메이션
- URL 자동 링크 및 이미지 프리뷰

### 모니터링 및 실시간 오류 추적

- 실시간 접속자 수 및 활성 세션 표시
- 연결 상태 인디케이터 (WebSocket Heartbeat)
- 🆕 **고급 오류 로깅 시스템**: 
  - 클라이언트 스크립트 에러 및 WebSocket 통신 오류를 포착하여 관리자 대시보드로 자동 전송
  - 사용자의 연결 IP, 유저 에이전트, 스택 트레이스를 서버 디스크(Durable Object Storage)에 영구 보존 기록
- 익명 메트릭 API 및 Wrangler tail 로그 자동 지원

### 관리자 대시보드

- 보안 인증 기반 접근 (`/administrator`)
- 실시간 통계, 오류 발생 횟수 및 시스템 환경 모니터링
- **활성 세션 관리 및 이중 차단 시스템**
  - 사용자 강제 퇴장 (즉시 퇴장, 30초, 5분, 10분 차단)
  - **IP + SessionID 이중 차단**: IP 변경해도 차단 우회 불가
  - 외부 IP 기반 차단으로 네트워크 공유 사용자 보호
  - 클릭 한 번으로 차단 시간 선택
  - **완전한 재접속 차단**:
    - 강퇴된 유저가 새로고침해도 차단 시간 동안 완전 접속 불가
    - SessionID가 자동 삭제되어 차단 우회 방지
    - IP와 SessionID 양쪽에서 동시 차단
- **메시지 관리**
  - **모든 메시지 삭제 권한**: 관리자는 일반 유저의 메시지와 첨부 파일도 삭제 가능
  - 관리자 메시지 시간 제한 없이 수정/삭제 가능
  - 줄바꿈 지원 (Shift+Enter)
  - 삭제 확인 메시지 및 감사 로그 기록
- **시스템 오류 내역 관리**
  - 최근 서버/클라이언트 단 100건 에러 열람
  - 발생 환경 정보(User-Agent, 국가, URL) 및 상세 스택 트레이스 열람
  - 오류 로그 파일(.json) 다이렉트 다운로드 및 완전 초기화 지원
- **실시간 활동 모니터링**
  - 사용자별 마지막 활동 시간 추적
  - 온라인 상태 실시간 표시
- **시스템 공지사항**
  - 일반 메시지와 강조 공지사항 전송
  - 공지는 12시간 후에도 유지 (새 공지로 대체될 때까지)
  - 신규 접속자도 현재 공지 자동 수신
- **데이터 내보내기**
  - CSV 내보내기 (전체, 활성 세션, 오늘, 1시간, 24시간 필터)
  - 사용자 세션 및 메시지 기록 포함
- JWT 기반 세션 관리 및 내부 API 토큰(SSRF 방지) 검증
- 감사 로그 및 시스템 정보

---

## 아키텍처

```mermaid
graph TB
    subgraph "Client Layer"
        A[Browser]
    end
    
    subgraph "Cloudflare Edge"
        B[Cloudflare Worker<br/>Entry Point]
        C[Static Assets<br/>HTML/CSS/JS]
    end
    
    subgraph "Durable Objects"
        D[ChatRoom<br/>WebSocket Handler]
        E[In-Memory State<br/>Messages & Sessions]
    end
    
    subgraph "External Services"
        F[File Upload API<br/>static.a85labs.net]
        G[Dead Drop API<br/>api.kalpha.kr]
    end
    
    A -->|HTTPS| C
    A -.->|WSS| B
    A -.->|File Upload| F
    A -.->|Secret Message<br/>Store/Read| G
    B -->|Routing| D
    D -->|State| E
    D -.->|Broadcast<br/>+targetSessionId| A
    F -.->|File URL| A
    G -.->|One-time Secret<br/>1hr TTL| A
```

### 데이터 흐름

```plaintext
1. 클라이언트 → HTTP(S) → Static Assets (HTML/CSS/JS)
2. WebSocket → WSS → Worker → IP 검증 → Durable Object
3. 메시지 → 클라이언트 검증 → 서버 검증 → 브로드캐스트
4. 타이핑 → 2초 디바운싱 → 다른 클라이언트에게 전파
5. 파일 업로드 → static.a85labs.net → 파일 URL 반환 → 메시지에 첨부
6. 비밀 메시지 저장 → Dead Drop API → secretId 반환 → targetSessionId와 함께 브로드캐스트
7. 비밀 메시지 읽기 → targetSessionId 검증 → Dead Drop API에서 일회성 조회 및 삭제
```

### 비밀 메시지 보안 흐름

```mermaid
sequenceDiagram
    participant A as 사용자 A
    participant B as 사용자 B
    participant C as 사용자 C (제3자)
    participant Chat as ChatRoom
    participant DD as Dead Drop API

    Note over A,DD: 1. 답장 대상 선택 및 비밀 메시지 작성
    A->>A: 사용자 B의 메시지 우클릭
    A->>A: "비밀 메시지로 보내기" 체크
    
    Note over A,DD: 2. Dead Drop에 암호화 저장
    A->>DD: POST /store (메시지 내용)
    DD-->>A: secretId 반환
    
    Note over A,DD: 3. 메시지 브로드캐스트 (targetSessionId 포함)
    A->>Chat: 전송 { secretId, targetSessionId: B.sessionId }
    Chat->>A: 브로드캐스트 (isSecret: true)
    Chat->>B: 브로드캐스트 (isSecret: true)
    Chat->>C: 브로드캐스트 (isSecret: true)
    
    Note over A,C: 4. 각 사용자의 UI 표시
    A->>A: "비밀 메시지를 보냈습니다"
    B->>B: "비밀 메시지 읽기" 버튼 표시
    C->>C: "비밀 메시지 (답장)" (읽기 불가)
    
    Note over B,DD: 5. 사용자 B가 비밀 메시지 읽기
    B->>B: sessionId == targetSessionId 확인 ✓
    B->>DD: GET /read/{secretId}
    DD->>DD: 메시지 반환 후 즉시 삭제
    DD-->>B: 메시지 내용 (일회성)
    B->>B: 화면에 표시
    
    Note over C,DD: 6. 사용자 C가 읽으려 시도 (실패)
    C->>C: sessionId != targetSessionId ✗
    C->>C: 읽기 버튼 없음 (UI 차단)
```

### 핵심 컴포넌트

| 컴포넌트 | 역할 | 위치 |
|---------|------|------|
| Cloudflare Worker | HTTP/WebSocket 진입점, 라우팅 | `src/worker.js` |
| Durable Object | 채팅방 상태 관리, 메시지 브로드캐스트 | `src/worker.js` (ChatRoom) |
| Static Assets | HTML, CSS, JavaScript 정적 파일 | `public/` |
| Client App | WebSocket 클라이언트, UI 렌더링 | `public/js/` |
| File Upload Manager | 파일 업로드 및 미리보기 처리 | `public/js/file-upload.js` |
| Dead Drop Client | 일회성 비밀 메시지 API 클라이언트 | `public/js/dead-drop.js` |
| External File API | 파일 저장 및 제공 | `static.a85labs.net` |
| Dead Drop API | 일회성 비밀 메시지 저장소 (1hr TTL) | `api.kalpha.kr` |

---

## 빠른 시작

### 사전 요구사항

| 도구 | 버전 | 설치 방법 |
|------|------|-----------|
| Node.js | 18+ | [nodejs.org](https://nodejs.org/) |
| npm | 9+ | Node.js와 함께 설치됨 |
| Wrangler CLI | 최신 | `npm install -g wrangler` |
| Cloudflare 계정 | - | [dash.cloudflare.com](https://dash.cloudflare.com/) |

### 1분 안에 시작하기

```bash
# 1. 저장소 클론
git clone https://github.com/gguatit/Anonymous_Chat.git
cd Anonymous_Chat

# 2. 의존성 설치
npm install

# 3. Cloudflare 로그인
wrangler login

# 4. 필수 환경변수 설정 (프로덕션)
# 프로덕션 환경에서는 3개 환경변수 필수
npx wrangler secret put HMAC_SECRET
# 프롬프트에서 HMAC 시크릿 키 입력 (32자 이상 랜덤 문자열)
# 생성 방법: openssl rand -base64 32

npx wrangler secret put ADMIN_ID
# 프롬프트에서 관리자 ID 입력 (예: admin)

npx wrangler secret put ADMIN_PASSWORD
# 프롬프트에서 관리자 비밀번호 입력 (강력한 비밀번호 권장)

# 5. 로컬 개발 환경 설정 (선택)
# .dev.vars 파일 생성 (로컬 개발용)
cat > .dev.vars << EOF
HMAC_SECRET=your-dev-secret-key-here
ADMIN_ID=admin
ADMIN_PASSWORD=admin123
EOF

# 6. 로컬 개발 서버 시작
npm run dev

# 브라우저에서 http://localhost:8787 접속
# 관리자 페이지: http://localhost:8787/administrator.html
```

**중요:** HMAC_SECRET이 설정되지 않으면 서비스가 시작되지 않습니다. 로컬 개발 시 .dev.vars 파일을 사용하거나 개발 환경에서도 secret을 설정해야 합니다.

### 커스터마이징

<details>
<summary><b>색상 테마 변경</b></summary>

`public/index.html`의 Tailwind 설정 수정:

```javascript
tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                primary: '#your-color',
            }
        }
    }
}
```

</details>

<details>
<summary><b>메시지 제한 변경</b></summary>

`src/worker.js`에서 상수 수정:

```javascript
const RATE_LIMIT = {
    MAX_MESSAGES_PER_MINUTE: 30,  // 분당 메시지 수
    MAX_CONNECTIONS_PER_IP: 5,    // IP당 동시 연결
    MESSAGE_COOLDOWN: 1000,        // 메시지 간 쿨다운 (ms)
};
```

</details>

<details>
<summary><b>IP 차단/화이트리스트 설정</b></summary>

`src/worker.js`에서 설정:

```javascript
const SECURITY = {
    MAX_MESSAGE_LENGTH: 5000,
    BANNED_IPS: new Set([
        '192.168.1.1',
        '10.0.0.1'
    ]),
    IP_WHITELIST: null,  // null = 모든 IP 허용
};
```

</details>

---

## 보안 기능

### 다층 보안 아키텍처

```
Layer 1: Cloudflare Network
├── DDoS 보호
├── 자동 SSL/TLS
└── 글로벌 WAF

Layer 2: Worker (Entry Point)
├── IP 기반 접근 제어
├── Origin 헤더 검증
└── Rate Limiting

Layer 3: Durable Object
├── 세션 검증
├── HMAC 메시지 서명
└── 입력 Sanitization

Layer 4: Client
├── XSS 방지 (textContent)
├── CSP (Content Security Policy)
└── 지수적 백오프
```

### 구현된 보안 기능

<details>
<summary><b>1. MITM (중간자 공격) 방어</b></summary>

#### HTTPS/WSS 강제

- 모든 HTTP 요청 → HTTPS 리다이렉트
- WebSocket은 WSS(Secure WebSocket)만 사용
- HSTS 헤더로 브라우저 강제 (1년)

```javascript
// HTTP → HTTPS 리다이렉트
if (url.protocol === 'http:' && !url.hostname.includes('localhost')) {
    return Response.redirect(`https://${url.hostname}${url.pathname}`, 301);
}
```

#### HSTS 설정

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

</details>

<details>
<summary><b>2. 데이터 변조 방지</b></summary>

#### HMAC-SHA256 메시지 서명

- 클라이언트: 전송 전 HMAC 서명 생성
- 서버: 수신 시 서명 검증
- 변조된 메시지는 자동 거부

```javascript
// 서명 생성 (클라이언트/서버)
const signature = await generateMessageSignature(content, sessionId, timestamp);

// 서명 검증 (서버)
const isValid = await verifyMessageSignature(data);
```

#### 세션 ID 검증

- WebSocket 연결 시 할당된 세션 ID와 메시지의 세션 ID 일치 확인
- 타인의 세션 ID 도용 불가능

</details>

<details>
<summary><b>3. CSRF (Cross-Site Request Forgery) 방어</b></summary>

#### Origin 헤더 검증

```javascript
const ALLOWED_ORIGINS = [
    'https://kalpha.mmv.kr',           // 프로덕션
    'http://localhost:8787'             // 개발
];

// WebSocket 연결 시 Origin 검증
if (origin && !isAllowedOrigin(origin)) {
    return new Response('Unauthorized Origin', { status: 403 });
}
```

</details>

<details>
<summary><b>4. XSS (Cross-Site Scripting) 방어</b></summary>

#### 서버 측 Sanitization

```javascript
sanitizeInput(input) {
    return input.replace(/[\x00-\x1F\x7F]/g, '').trim();
}
```

#### 클라이언트 측 안전 렌더링

```javascript
// 위험: innerHTML 사용 금지
// element.innerHTML = userInput;

// 안전: textContent 사용
element.textContent = userInput;
```

#### Content Security Policy (CSP)

```
default-src 'self';
script-src 'self' https://cdn.tailwindcss.com;
connect-src 'self' wss: ws:;
object-src 'none';
```

</details>

<details>
<summary><b>5. Rate Limiting</b></summary>

#### 3단계 제한

1. **메시지 쿨다운**: 1초당 1개
2. **분당 제한**: 30개
3. **IP당 연결**: 최대 5개

```javascript
// 클라이언트 측
if (Date.now() - lastMessageTime < 1000) {
    showError('메시지를 너무 빠르게 전송하고 있습니다');
    return;
}

// 서버 측
if (messagesThisMinute >= MAX_MESSAGES_PER_MINUTE) {
    ws.send(JSON.stringify({
        type: 'error',
        message: '분당 메시지 제한 초과'
    }));
    return;
}
```

</details>

<details>
<summary><b>6. DoS/DDoS 방어</b></summary>

- Cloudflare의 네트워크 레벨 DDoS 보호
- IP당 동시 연결 수 제한
- 지수적 백오프 재연결 (최대 10회)
- 메시지 크기 제한 (1000자)

</details>

### 보안 감사 체크리스트

- [x] HTTPS/WSS 강제
- [x] HSTS 헤더 설정
- [x] CSP 헤더 설정
- [x] Origin 검증
- [x] HMAC 메시지 서명
- [x] XSS 방어 (sanitization)
- [x] CSRF 방어
- [x] Rate Limiting
- [x] 입력 검증
- [x] 세션 관리
- [x] IP 기반 접근 제어
- [x] 메시지 크기 제한
- [x] 연결 수 제한
- [x] **비밀 메시지 targetSessionId 검증**
- [x] **Dead Drop API 일회성 읽기**

<details>
<summary><b>7. 비밀 메시지 보안</b></summary>

#### targetSessionId 기반 접근 제어

비밀 메시지는 **답장 보낸 사람**과 **받는 사람(targetSessionId)**만 접근 가능합니다:

```javascript
// 답장 대상의 sessionId를 targetSessionId로 저장
const targetSessionId = messageDiv.dataset.sessionId;
this.setReplyingTo(messageId, content, isOwnMessage, targetSessionId);

// 비밀 메시지 전송 시 targetSessionId 포함
messageData.replyTo = {
    messageId: replyingTo.messageId,
    isSecret: true,
    secretId: deadDropResult.id,
    targetSessionId: replyingTo.targetSessionId
};

// UI에서 targetSessionId 검증
const isRecipient = data.replyTo.targetSessionId === sessionId;
if (isRecipient) {
    // "비밀 메시지 읽기" 버튼 표시
} else {
    // 읽기 불가 (제3자)
}
```

#### Dead Drop API 통합

- **일회성 읽기**: 메시지를 한 번 읽으면 영구 삭제
- **1시간 TTL**: 읽지 않아도 1시간 후 자동 삭제
- **2000자 제한**: 메시지 크기 제한
- **API 엔드포인트**: `https://api.kalpha.kr`

```javascript
// 비밀 메시지 저장
const result = await deadDrop.store(message);
// → { id: "abc123" }

// 비밀 메시지 읽기 (일회성)
const data = await deadDrop.read(secretId);
// → { message: "내용" } + 서버에서 즉시 삭제
```

#### 3중 보안 계층

1. **UI 레벨**: targetSessionId 불일치 시 읽기 버튼 미표시
2. **클라이언트 레벨**: sessionId 검증 후에만 API 호출
3. **서버 레벨**: Dead Drop API의 일회성 읽기로 재사용 방지

#### 프라이버시 보호

- 제3자는 비밀 메시지 **존재 여부만** 확인 가능
- 메시지 내용, secretId 모두 숨김 처리
- 브로드캐스트되지만 UI에서 "비밀 메시지 (답장)" 텍스트만 표시

</details>

---

## 플랫폼 호환성

### 완전 지원 (테스트 완료)

| 플랫폼 | 버전 | 상태 | 비고 |
|--------|------|------|------|
| Windows | 11 | ✅ | 모든 기능 정상 작동 |
| Arch Linux | Latest | ✅ | 모든 기능 정상 작동 |
| Ubuntu | 20.04+ | ✅ | 모든 기능 정상 작동 |
| Garuda Linux | Latest | ✅ | 모든 기능 정상 작동 |
| Android | 16 | ✅ | 모든 기능 정상 작동 |
| iOS | Latest | ✅ | 모든 기능 정상 작동 |
| macOS | Latest | ✅ | 모든 기능 정상 작동 |

### 최적화 안 됨

다른 플랫폼에서도 대부분 작동하지만, 최적화가 완료되지 않았을 수 있습니다.

문제가 발생하면 [버그 제보](https://github.com/gguatit/Anonymous_Chat/issues)를 통해 전달해주세요.

### 권장 환경

데스크톱 및 모바일 모두 완벽하게 지원됩니다.  
Windows, Linux, Android, iOS, macOS에서 최상의 경험을 제공합니다.

---

## 고급 설정

### 환경 변수 및 시크릿

`wrangler.toml` 설정:

```toml
[env.production]
vars = { ENVIRONMENT = "production" }

[env.development]
vars = { ENVIRONMENT = "development" }
```

### 필수 시크릿 설정

프로덕션 환경에서 반드시 설정해야 하는 시크릿:

```bash
# 관리자 ID 설정
npx wrangler secret put ADMIN_ID
# 예시: admin, kalpha 등

# 관리자 비밀번호 설정
npx wrangler secret put ADMIN_PASSWORD
# 강력한 비밀번호 사용 권장 (12자 이상, 특수문자 포함)

# HMAC 시크릿 키 설정
npx wrangler secret put HMAC_SECRET
# 32자 이상의 랜덤 문자열 사용
# 생성 예시: openssl rand -base64 32
```

**보안 주의사항:**
- 시크릿은 절대 코드에 하드코딩하지 마세요
- 시크릿은 Cloudflare에 암호화되어 저장됩니다
- 정기적으로 비밀번호를 변경하세요
- `wrangler.toml` 파일에 시크릿을 포함하지 마세요

자세한 내용은 [SECURITY_SETUP.md](SECURITY_SETUP.md)를 참조하세요.

### 프로젝트 구조

```plaintext
Anonymous_Chat/
├── public/                # 정적 파일 (Cloudflare Assets)
│   ├── index.html        # 메인 HTML
│   ├── administrator.html # 관리자 대시보드
│   ├── js/               # 클라이언트 JavaScript
│   │   ├── chat.js       # 메인 진입점
│   │   ├── websocket.js  # WebSocket 클라이언트
│   │   ├── session.js    # 세션 관리
│   │   ├── ui.js         # UI 렌더링
│   │   ├── file-upload.js # 파일 업로드 관리
│   │   └── admin.js      # 관리자 페이지 로직
│   ├── css/              # 스타일시트
│   │   ├── base.css      # 기본 스타일
│   │   └── animations.css # 애니메이션
│   ├── ico/              # 아이콘 파일들
│   ├── manifest.json     # PWA Manifest
│   ├── _headers          # Cloudflare 보안 헤더
│   └── _redirects        # 리다이렉트 규칙
├── functions/            # Cloudflare Pages Functions
│   └── _middleware.js    # 미들웨어 (보안 헤더)
├── src/                  # Worker 소스
│   └── worker.js         # Worker + Durable Object + Admin API
├── test/                 # 테스트 파일
│   ├── worker.test.js    # Worker 테스트
│   ├── security.test.js  # 보안 테스트
│   ├── message-edit.test.js # 메시지 수정 테스트
│   ├── message-delete.test.js # 메시지 삭제 테스트
│   └── link-preview.test.js # 링크 프리뷰 테스트
├── package.json          # 프로젝트 설정
├── wrangler.toml         # Cloudflare 설정
├── vitest.config.js      # 테스트 설정
├── deploy.sh             # 배포 스크립트
├── ADMIN_GUIDE.md        # 관리자 가이드
├── SECURITY_SETUP.md     # 보안 설정 가이드
├── SECURITY_VERIFICATION.md # 보안 검증 가이드
└── FEATURE_IDEAS.md      # 기능 아이디어
```

### API 엔드포인트

#### 공개 API

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/ws` | GET (WebSocket) | WebSocket 연결 |
| `/health` | GET | 헬스 체크 |
| `/metrics` | GET | 익명 메트릭 (연결 수, 메시지 수) |
| `/` | GET | 정적 파일 (HTML) |
| `/administrator` | GET | 관리자 대시보드 |

#### 관리자 API (인증 필요)

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/admin/login` | POST | 관리자 로그인 (JWT 발급) |
| `/api/admin/verify` | POST | JWT 토큰 검증 |
| `/api/admin/metrics` | GET | 상세 통계 조회 |
| `/api/admin/sessions` | GET, DELETE | 활성 세션 관리 |
| `/api/admin/messages` | GET, DELETE | 메시지 조회 및 삭제 |
| `/api/admin/edit-message` | POST | 관리자 메시지 수정 (시간 제한 없음) |
| `/api/admin/delete-message` | POST | 관리자 메시지 삭제 (시간 제한 없음) |
| `/api/admin/kick-user` | POST | 사용자 강제 퇴장 및 IP 차단 |
| `/api/admin/announce` | POST | 시스템 공지사항 전송 |
| `/api/admin/broadcast` | POST | 관리자 메시지 브로드캐스트 |
| `/api/admin/logs` | GET | 감사 로그 조회 |

#### 보안 API

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/check-ban` | GET | IP 차단 상태 확인 |
| `/api/admin/logs` | GET | 감사 로그 조회 |
| `/api/admin/logout` | POST | 로그아웃 (토큰 무효화) |

#### 파일 업로드 API (static.a85labs.net)

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/upload` | POST | 파일 업로드 (multipart/form-data) |
| `/{id}/{name}` | GET | 업로드된 파일 다운로드 |
| `/{id}/{name}` | HEAD | 파일 메타데이터 조회 |

#### 메트릭 API 응답 예시

```json
{
  "timestamp": 1699264800000,
  "activeConnections": 42,
  "totalMessages": 1337,
  "uptime": 86400
}
```

#### 파일 업로드 응답 예시

```json
{
  "id": "abc123xyz",
  "name": "image.jpg",
  "url": "https://static.a85labs.net/abc123xyz/image.jpg"
}
```

---

## 테스트

### 단위 테스트 실행

```bash
# 모든 테스트 실행
npm test

# Watch 모드 (파일 변경 감지)
npm run test:watch

# 커버리지 리포트
npm run test:coverage
```

### 로컬 테스트

```bash
# 로컬 개발 서버 시작
npm run dev

# Wrangler tail로 실시간 로그 확인
wrangler tail
```

### E2E 테스트 (수동)

1. **연결 테스트**: 브라우저 개발자 도구 → 네트워크 탭 → WebSocket 연결 확인
2. **메시지 전송**: 메시지 입력 후 다른 브라우저에서 수신 확인
3. **Rate Limiting**: 1초에 2개 이상 메시지 전송 시도 → 에러 확인
4. **재연결**: 네트워크 연결 끊기 → 자동 재연결 확인

---

## 배포

### 방법 1: 자동 배포 스크립트 (권장)

```bash
# 실행 권한 부여 (최초 1회)
chmod +x deploy.sh

# 배포 실행
./deploy.sh
```

자동으로 다음을 수행:

- Wrangler 설치 확인
- 인증 상태 확인
- Worker + Assets 배포
- 배포 URL 표시

### 방법 2: npm 스크립트

```bash
# 프로덕션 배포
npm run deploy

# 개발 환경 배포
npm run deploy:dev
```

### 방법 3: GitHub Actions (CI/CD)

`.github/workflows/deploy.yml` 생성:

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
    name: Deploy to Cloudflare Workers
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Deploy
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy --env production
```

**필요한 GitHub Secrets:**

- `CLOUDFLARE_API_TOKEN`: Cloudflare API 토큰
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare 계정 ID

### 배포 후 확인

```bash
# 실시간 로그 확인
wrangler tail

# 메트릭 확인
curl https://your-worker.workers.dev/metrics

# 헬스 체크
curl https://your-worker.workers.dev/health
```

### 롤백

```bash
# 이전 배포 버전 목록 확인
wrangler deployments list

# 특정 버전으로 롤백
wrangler rollback [deployment-id]
```

---

## 문제 해결

<details>
<summary><b>WebSocket 연결이 안 돼요</b></summary>

**원인:**

- Durable Objects 미활성화
- Origin 헤더 불일치
- IP 차단 목록에 포함

**해결:**

1. Cloudflare Dashboard → Workers & Pages → Durable Objects 활성화 확인
2. `src/worker.js`의 `ALLOWED_ORIGINS`에 도메인 추가
3. `BANNED_IPS`에서 IP 제거

</details>

<details>
<summary><b>메시지가 전송되지 않아요</b></summary>

**원인:**

- Rate Limiting 제한 (1초당 1개)
- 메시지 길이 초과 (1000자)
- 세션 만료

**해결:**

1. 1초 이상 간격을 두고 메시지 전송
2. 메시지 길이 1000자 이하로 줄이기
3. 페이지 새로고침 (새 세션 생성)

</details>

<details>
<summary><b>"Rate limit exceeded" 에러가 나요</b></summary>

**원인:**

- 1분에 30개 이상 메시지 전송
- IP당 5개 이상 동시 연결

**해결:**

1. 잠시 대기 (1분 후 자동 해제)
2. 불필요한 브라우저 탭 닫기
3. `src/worker.js`에서 `RATE_LIMIT` 값 조정 (필요시)

</details>

<details>
<summary><b>배포 시 "Unauthorized" 에러가 나요</b></summary>

**원인:**

- Wrangler 인증 만료
- API 토큰 권한 부족

**해결:**

```bash
# 재로그인
wrangler logout
wrangler login

# API 토큰 권한 확인 (Workers 편집 권한 필요)
```

</details>

<details>
<summary><b>CORS 에러가 발생해요</b></summary>

**원인:**

- Origin 검증 실패

**해결:**

`src/worker.js`에서 도메인 추가:

```javascript
const ALLOWED_ORIGINS = [
    'https://your-domain.com',
    'https://kalpha.mmv.kr',
    'http://localhost:8787'
];
```

</details>

---

## 성능 최적화

### 달성된 성능 지표

| 지표 | 값 | 설명 |
|------|-----|------|
| 첫 바이트까지의 시간 (TTFB) | <50ms | Cloudflare Edge에서 응답 |
| WebSocket 레이턴시 | <100ms | 평균 메시지 전송 시간 |
| 동시 연결 | 1000+ | Durable Object당 |
| 메시지 처리량 | 10,000+/s | 초당 처리 가능 메시지 수 |
| 콜드 스타트 | ~50ms | Worker 초기 실행 시간 |

### 최적화 기법

- **엣지 컴퓨팅**: 사용자와 가장 가까운 Cloudflare 데이터센터에서 실행
- **WebSocket 연결 풀링**: Durable Objects로 연결 재사용
- **지연 로딩**: 초기 로드 시 필수 리소스만 로드
- **메시지 배칭**: 여러 메시지를 한 번에 브로드캐스트
- **메모리 관리**: 오래된 메시지 자동 정리 (12시간, 500개 제한)

---

## 기여

기여를 환영합니다! 다음 단계를 따라주세요:

### 개발 워크플로우

1. **Fork** 이 저장소
2. **Clone** 포크한 저장소

   ```bash
   git clone https://github.com/YOUR_USERNAME/Anonymous_Chat.git
   cd Anonymous_Chat
   ```

3. **Branch** 생성

   ```bash
   git checkout -b feature/amazing-feature
   ```

4. **Commit** 변경사항

   ```bash
   git commit -m 'feat: Add amazing feature'
   ```

5. **Push** to branch

   ```bash
   git push origin feature/amazing-feature
   ```

6. **Pull Request** 생성

### 커밋 컨벤션

[Conventional Commits](https://www.conventionalcommits.org/) 사용:

```
feat: 새로운 기능 추가
fix: 버그 수정
docs: 문서 변경
style: 코드 포맷팅 (기능 변경 없음)
refactor: 리팩토링
test: 테스트 추가/수정
chore: 빌드/설정 변경
```

### 코드 스타일

- **JavaScript**: ESLint + Prettier
- **들여쓰기**: 4 spaces
- **세미콜론**: 사용
- **따옴표**: 작은따옴표 (')

---

## 라이선스

이 프로젝트는 **AGPL-3.0 (GNU Affero General Public License v3.0)** 코어 기반으로 배포됩니다.

- 🔒 **라이선스 (AGPL-3.0)**: 이 코드를 사용하거나 수정하여 배포 또는 네트워크 서비스(웹, 앱)를 제공할 경우, **반드시 동일한 라이선스(AGPL-3.0)로 소스 코드를 공개**해야 합니다. 상세 내용은 [LICENSE](LICENSE) 파일을 참조하세요.
- 🛡️ **보안 정책**: 프로젝트의 보안 취약점 발견 시 대응 절차는 [SECURITY.md](SECURITY.md)를 참조해 주세요. 잠재적 취약점은 공개 이슈에 올리지 마시고, 이메일이나 비공개 채널로 제보해 주시기 바랍니다.

---

## 변경 이력 (Changelog)

### 2026-02-12

#### 🔒 보안 강화
- **비밀 메시지 접근 제어 개선**: targetSessionId 기반 엄격한 접근 제어
  - 답장 대상의 sessionId를 targetSessionId로 저장
  - 비밀 메시지는 보낸 사람과 받는 사람(targetSessionId)만 열람 가능
  - 제3자는 비밀 메시지 존재만 확인 가능, 내용 접근 불가
  - UI 레벨, 클라이언트 레벨, 서버 레벨 3중 보안 검증

#### 🆕 새로운 기능
- **Dead Drop API 통합**: 일회성 비밀 메시지 시스템
  - 메시지를 한 번 읽으면 영구 삭제
  - 1시간 TTL (Time To Live)
  - 2000자 메시지 제한
  - API 제공: [kalpha.kr](https://api.kalpha.kr)

- **답장 기능 추가**: 특정 메시지에 답장 가능
  - 컨텍스트 메뉴 (우클릭/길게 누르기)
  - 답장 프리뷰 UI
  - 비밀 메시지로 보내기 옵션

#### 📝 아키텍처 개선
- Dead Drop API 외부 서비스 통합
- targetSessionId 필드 추가로 메시지 수신자 명확화
- 메시지 브로드캐스트에 접근 제어 메타데이터 포함
- CSP에 Dead Drop API 도메인 추가

#### 📚 문서 업데이트
- README에 비밀 메시지 기능 상세 설명 추가
- 비밀 메시지 보안 흐름 시퀀스 다이어그램 추가
- 아키텍처 다이어그램에 Dead Drop API 반영
- 보안 체크리스트 업데이트

---

### 2025-12-19

#### 🆕 새로운 기능
- **관리자 메시지 삭제 권한 확대**: 관리자가 일반 유저의 메시지와 첨부 파일도 삭제 가능
  - 부적절한 콘텐츠 즉시 제거 가능
  - 시간 제한 없이 삭제 가능
  - 삭제된 메시지는 모든 사용자에게 실시간 반영

- **이중 차단 시스템 구축**: IP와 SessionID 동시 차단으로 완벽한 강퇴 구현
  - `bannedSessions` Map 추가로 SessionID 기반 차단
  - IP 차단과 SessionID 차단 통합 운영
  - 차단 시 클라이언트 localStorage의 SessionID 자동 삭제
  - 'banned' 메시지 타입 추가로 차단 상태 명확히 전달

#### 🔧 버그 수정
- **강퇴 기능 완전 개선**: 강퇴된 유저의 재접속 완전 차단
  - join 메시지 처리 시점에 IP 및 SessionID 차단 상태 재확인
  - 기존 세션으로 재연결 시도해도 차단 적용
  - 새로고침으로 차단 우회 불가능
  - IP 변경해도 SessionID로 차단 유지
  - 차단 시간 만료 시 자동으로 새 SessionID 발급으로 정상 접속 가능

#### 📝 개선 사항
- 삭제 확인 메시지에 파일 삭제 경고 추가
- 감사 로그에 더 자세한 삭제 정보 기록 (원본 세션 ID, 파일 포함 여부 등)
- cleanup 함수에서 만료된 SessionID 차단도 자동 정리
- 강퇴 시 permanent 플래그로 클라이언트에게 재접속 금지 명확히 전달

---

## 크레딧

### 기술 스택

- [Cloudflare Workers](https://workers.cloudflare.com/) - 서버리스 컴퓨팅
- [Durable Objects](https://developers.cloudflare.com/durable-objects/) - 상태 관리
- [Tailwind CSS](https://tailwindcss.com/) - CSS 프레임워크
- [Vitest](https://vitest.dev/) - 테스트 프레임워크

### 영감

이 프로젝트는 개인정보 보호와 익명성의 중요성에서 영감을 받았습니다.

---

## 지원 및 문의

<div align="center">

[![GitHub Issues](https://img.shields.io/github/issues/gguatit/Anonymous_Chat?style=for-the-badge)](https://github.com/gguatit/Anonymous_Chat/issues)
[![GitHub Discussions](https://img.shields.io/github/discussions/gguatit/Anonymous_Chat?style=for-the-badge)](https://github.com/gguatit/Anonymous_Chat/discussions)

[이슈 생성하기](https://github.com/gguatit/Anonymous_Chat/issues/new)

</div>

---

<div align="center">

이 프로젝트가 도움이 되었다면 ⭐️ 별표를 눌러주세요!

Made with Cloudflare Workers and Pages

[맨 위로](#anonymous-chat)

</div>
