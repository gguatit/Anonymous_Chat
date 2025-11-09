# 익명 채팅 (Anonymous Chat)

Cloudflare Workers와 Pages 기반 실시간 익명 채팅 웹 애플리케이션

## 📋 개요

이 프로젝트는 서버리스 아키텍처를 활용한 완전 익명 실시간 채팅 애플리케이션입니다. Cloudflare Workers의 Durable Objects를 사용하여 WebSocket 연결을 관리하며, 모든 메시지는 메모리에만 저장되어 영구 보존되지 않습니다.

## ✨ 주요 기능

### 핵심 기능

- ✅ **실시간 채팅**: WebSocket 기반 실시간 메시지 전송
- ✅ **완전 익명**: 닉네임 없이 세션 기반 익명 처리
- ✅ **12시간 메시지 저장**: Durable Objects 영구 저장소 활용
- ✅ **최대 500개 메시지**: 자동으로 오래된 메시지 정리
- ✅ **입장 시 히스토리**: 새 사용자에게 최근 50개 메시지 제공
- ✅ **타이핑 표시**: 다른 사용자의 타이핑 상태 실시간 표시
- ✅ **접속자 수**: 실시간 활성 사용자 수 표시
- ✅ **타임스탬프**: 모든 메시지에 전송 시간 표시

### 보안 기능
- 🔒 **CSRF 방지**: WebSocket 연결 보안
- 🔒 **입력 검증**: 메시지 내용 및 길이 검증
- 🔒 **Rate Limiting**: 
  - 메시지 전송 빈도 제한 (1초당 1개)
  - 분당 최대 30개 메시지
  - IP당 최대 5개 동시 연결
- 🔒 **IP 기반 접근 제어**: 차단 및 화이트리스트 지원
- 🔒 **XSS 방지**: 입력 데이터 sanitization
- 🔒 **지수적 백오프**: 연결 재시도 시 폭주 방지

### UI/UX
- 🎨 **다크 테마**: 눈의 피로를 줄이는 어두운 테마
- 📱 **반응형 디자인**: 모바일, 태블릿, 데스크톱 지원
- ♿ **접근성**: ARIA 레이블 및 시맨틱 HTML
- 🎯 **Tailwind CSS**: 최소한의 컴포넌트로 구성된 깔끔한 UI
- 📜 **자동 스크롤**: 새 메시지 추가 시 자동으로 최하단 스크롤

### 모니터링
- 📊 **익명 메트릭**: 최소한의 접속 통계 수집
- 📈 **성능 모니터링**: 연결 수, 메시지 수 추적
- 🐛 **오류 추적**: 에러 로깅 및 모니터링

## 🖥️ 플랫폼 호환성

### ✅ 테스트 완료
- **Windows 11**: 완전 지원 (모든 기능 작동)
- **Arch Linux**: 완전 지원 (모든 기능 작동)
- **Ubuntu**: 완전 지원 (모든 기능 작동)
- **Garuda Linux**: 완전 지원 (모든 기능 작동)
- **Android 16**: 부분 지원 (자동 스크롤 미작동)

### ⚠️ 제한사항
- **모바일 기기 (Android)**: 자동 스크롤 기능이 작동하지 않습니다. 수동 스크롤 필요.
- **iOS**: 최적화되지 않음 (테스트되지 않음)
- **macOS**: 최적화되지 않음 (테스트되지 않음)

### 📱 권장 사용 환경
- **데스크톱 PC** (Windows, Linux): 최상의 경험
- **모바일**: 기본 채팅 기능은 작동하나 UX 제한 있음

## 🏗️ 아키텍처

```
┌─────────────┐
│   Browser   │
│  (Client)   │
└──────┬──────┘
       │ WebSocket
       ▼
┌─────────────────────┐
│ Cloudflare Worker   │
│  (Entry Point)      │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Durable Object     │
│   (ChatRoom)        │
│  - Session Mgmt     │
│  - Message Routing  │
│  - Rate Limiting    │
└─────────────────────┘

┌─────────────────────┐
│ Cloudflare Pages    │
│  (Static Assets)    │
│  - HTML/CSS/JS      │
└─────────────────────┘
```

## 🚀 빠른 시작

### 사전 요구사항

- Node.js 16 이상
- Cloudflare 계정
- Wrangler CLI

### 설치

```bash
# 저장소 클론
git clone https://github.com/gguatit/Anonymous_Chat.git
cd Anonymous_Chat

# 의존성 설치
npm install

# Wrangler 로그인
wrangler login
```

### 로컬 개발

```bash
# 개발 서버 시작
npm run dev

# 브라우저에서 http://localhost:8787 접속
```

### 배포

#### 자동 배포 (권장)
```bash
# 배포 스크립트 실행
./deploy.sh
```

#### 수동 배포

```bash
# Worker와 static assets를 함께 배포
npm run deploy
```

또는 Pages만 별도 배포:

```bash
# Pages 배포
npm run deploy:pages
```

## 🧪 테스트

```bash
# 테스트 실행
npm test

# Watch 모드로 테스트
npm run test:watch

# 린트 검사
npm run lint
```

## 📁 프로젝트 구조

```
Anonymous_Chat/
├── public/              # 정적 파일 (Pages/Assets에 배포)
│   ├── index.html      # 메인 HTML
│   ├── app.js          # 클라이언트 JavaScript
│   ├── _headers        # Cloudflare Pages 보안 헤더
│   └── _redirects      # Cloudflare Pages 리다이렉트
├── src/                # Worker 소스
│   └── worker.js       # Worker 및 Durable Object
├── test/               # 테스트 파일
│   └── worker.test.js  # Worker 테스트
├── package.json        # 프로젝트 설정
├── wrangler.toml       # Cloudflare 설정
├── vitest.config.js    # Vitest 설정
├── deploy.sh           # 배포 스크립트
├── ARCHITECTURE.md     # 아키텍처 문서
├── DEPLOYMENT.md       # 배포 가이드
└── README.md           # 문서
```

## ⚙️ 설정

### 환경 변수

`wrangler.toml` 또는 Cloudflare Dashboard에서 설정:

```toml
[env.production]
vars = { ENVIRONMENT = "production" }
```

### 보안 설정

`src/worker.js`에서 수정 가능:

```javascript
const RATE_LIMIT = {
    MAX_MESSAGES_PER_MINUTE: 30,
    MAX_CONNECTIONS_PER_IP: 5,
    MESSAGE_COOLDOWN: 1000,
};

const SECURITY = {
    MAX_MESSAGE_LENGTH: 500,
    BANNED_IPS: new Set(['banned.ip.address']),
    IP_WHITELIST: null, // null = 모든 IP 허용
};
```

## 📊 API 엔드포인트

### WebSocket
- `GET /ws` - WebSocket 연결

### HTTP
- `GET /health` - 헬스 체크
- `GET /metrics` - 익명화된 메트릭

## 🔒 보안 고려사항

1. **데이터 보존**: 메시지는 메모리에만 저장되며 영구 보존되지 않음
2. **익명성**: 사용자 식별 정보를 수집하지 않음 (세션 ID만 사용)
3. **Rate Limiting**: 스팸 및 DoS 공격 방지
4. **입력 검증**: 모든 사용자 입력 검증 및 sanitization
5. **IP 기반 제어**: 악의적 IP 차단 기능
6. **연결 제한**: IP당 동시 연결 수 제한

## 📈 모니터링

### 메트릭 확인

```bash
# Worker 로그 실시간 확인
wrangler tail

# 메트릭 API 호출
curl https://your-worker.workers.dev/metrics
```

### 응답 예시
```json
{
  "timestamp": 1699264800000,
  "activeConnections": 5,
  "totalMessages": 1234
}
```

## 🛠️ 문제 해결

### WebSocket 연결 실패
- Cloudflare Worker가 WebSocket을 지원하는지 확인
- Durable Objects가 활성화되어 있는지 확인
- 브라우저 콘솔에서 에러 메시지 확인

### 메시지가 전송되지 않음
- Rate Limiting 제한 확인 (1초당 1개)
- 메시지 길이 제한 확인 (500자)
- 네트워크 연결 상태 확인

### 재연결 실패
- 최대 재연결 시도 횟수(10회) 초과 여부 확인
- 페이지 새로고침 시도
- Worker 상태 확인

## 🤝 기여

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 라이선스

MIT License - 자유롭게 사용, 수정, 배포 가능

## 🙏 감사의 말

- Cloudflare Workers & Pages
- Tailwind CSS
- Vitest

## 📞 지원

문제가 발생하거나 질문이 있으시면 GitHub Issues를 통해 알려주세요.

---

**Made with ❤️ using Cloudflare Workers and Pages**