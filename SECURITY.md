# 보안 기능 문서

## 구현된 보안 기능

### 1. 중간자 공격 (MITM) 방어

#### HTTPS/WSS 강제 적용
- **위치**: `src/worker.js` - `fetch()` 함수
- **기능**: HTTP 요청을 자동으로 HTTPS로 리다이렉트 (프로덕션)
- **코드**:
  ```javascript
  if (url.protocol === 'http:' && !url.hostname.includes('localhost')) {
      return Response.redirect(`https://${url.hostname}${url.pathname}${url.search}`, 301);
  }
  ```

#### HSTS (HTTP Strict Transport Security)
- **위치**: `public/_headers`
- **기능**: 브라우저가 HTTPS만 사용하도록 강제 (1년간)
- **설정**: `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`

#### WSS (WebSocket Secure) 강제
- **위치**: `public/js/websocket.js` - `connect()` 메서드
- **기능**: HTTPS 환경에서 자동으로 WSS 프로토콜 사용
- **코드**:
  ```javascript
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ```

### 2. 데이터 변조 방지

#### HMAC 메시지 서명
- **위치**: `src/worker.js` - `generateMessageSignature()`, `verifyMessageSignature()`
- **알고리즘**: HMAC-SHA256
- **기능**: 
  - 클라이언트: 메시지 전송 시 서명 생성
  - 서버: 수신한 메시지의 서명 검증
  - 서버: 브로드캐스트 전 서버 서명 추가
- **검증 항목**:
  - 메시지 내용 (`content`)
  - 세션 ID (`sessionId`)
  - 타임스탬프 (`timestamp`)

#### 세션 ID 검증
- **위치**: `src/worker.js` - ChatRoom 클래스의 `message` 핸들러
- **기능**: 
  - 클라이언트가 보낸 sessionId와 WebSocket 연결의 sessionId 일치 확인
  - 타인의 sessionId 도용 방지
- **코드**:
  ```javascript
  if (data.sessionId !== sessionId) {
      // 세션 ID 불일치 에러 반환
  }
  ```

### 3. CSRF (Cross-Site Request Forgery) 방어

#### Origin 헤더 검증
- **위치**: `src/worker.js` - `handleWebSocket()`, `isAllowedOrigin()`
- **기능**: WebSocket 연결 시 Origin 헤더 확인
- **허용 목록**: 
  - `https://anonymous-chat.pages.dev` (프로덕션)
  - `http://localhost:8787` (개발 환경)
- **코드**:
  ```javascript
  const origin = request.headers.get('Origin');
  if (origin && !isAllowedOrigin(origin)) {
      return new Response('Unauthorized Origin', { status: 403 });
  }
  ```

### 4. XSS (Cross-Site Scripting) 방어

#### 입력 값 살균 (Sanitization)
- **위치**: 
  - 서버: `src/worker.js` - `sanitizeInput()`
  - 클라이언트: `public/js/ui.js` - `sanitizeInput()`
- **기능**: HTML 태그 및 제어 문자 제거
- **코드**:
  ```javascript
  // 서버 측
  sanitizeInput(input) {
      return input.replace(/[\x00-\x1F\x7F]/g, '').trim();
  }
  
  // 클라이언트 측
  sanitizeInput(input) {
      const div = document.createElement('div');
      div.textContent = input;
      return div.innerHTML;
  }
  ```

#### Content Security Policy (CSP)
- **위치**: `public/_headers`
- **정책**:
  - `default-src 'self'`: 기본적으로 같은 도메인만 허용
  - `script-src 'self' https://cdn.tailwindcss.com`: 스크립트는 자체 + Tailwind CDN만
  - `connect-src 'self' wss: ws:`: WebSocket 연결 허용
  - `object-src 'none'`: 플러그인 비활성화
  - `upgrade-insecure-requests`: HTTP를 HTTPS로 자동 업그레이드

### 5. 기타 보안 헤더

#### 클릭재킹 방지
- `X-Frame-Options: DENY`: iframe 삽입 차단
- `frame-ancestors 'none'`: CSP로 iframe 차단

#### MIME 스니핑 방지
- `X-Content-Type-Options: nosniff`: 브라우저가 MIME 타입을 임의로 변경하지 못하도록 방지

#### Referrer 정보 제한
- `Referrer-Policy: strict-origin-when-cross-origin`: 크로스 오리진 요청 시 오리진만 전송

### 6. Rate Limiting

- **초당 메시지 제한**: 1개/초
- **분당 메시지 제한**: 30개/분
- **IP당 동시 연결 제한**: 5개
- **IP 밴 시스템**: `SECURITY.BANNED_IPS` 설정 가능

## 보안 설정 방법

### 1. HMAC Secret 변경 (필수!)

`wrangler.toml`에 환경 변수 추가:
```toml
[vars]
HMAC_SECRET = "your-very-secure-random-secret-key-here"
```

그 후 `src/worker.js`에서 사용:
```javascript
const SECURITY = {
    // ...
    HMAC_SECRET: env.HMAC_SECRET || 'fallback-secret-for-dev',
};
```

### 2. 허용 도메인 추가

`src/worker.js`의 `SECURITY.ALLOWED_ORIGINS`에 도메인 추가:
```javascript
ALLOWED_ORIGINS: [
    'https://your-domain.pages.dev',
    'https://custom-domain.com',
    'http://localhost:8787'
],
```

### 3. IP 밴 설정

특정 IP 차단:
```javascript
BANNED_IPS: new Set(['192.168.1.100', '10.0.0.50']),
```

## 주의사항

1. **HMAC Secret은 절대 코드에 하드코딩하지 마세요!** 환경 변수로 관리하세요.
2. **프로덕션에서는 HTTPS/WSS만 사용되도록 확인하세요.**
3. **ALLOWED_ORIGINS에 실제 운영 도메인만 추가하세요.**
4. **정기적으로 보안 업데이트를 확인하고 적용하세요.**

## 테스트 방법

### 1. HTTPS 리다이렉트 테스트
```bash
curl -I http://your-domain.com
# 301 리다이렉트 확인
```

### 2. 보안 헤더 확인
```bash
curl -I https://your-domain.pages.dev
# HSTS, CSP, X-Frame-Options 등 확인
```

### 3. Origin 검증 테스트
```javascript
// 허용되지 않은 origin에서 WebSocket 연결 시도
const ws = new WebSocket('wss://your-domain.pages.dev/ws');
// 403 에러 확인
```

## 보안 로드맵

향후 추가 예정 기능:
- [ ] End-to-End 암호화 (E2EE)
- [ ] 메시지 서명 키 로테이션
- [ ] DDoS 방어 강화 (Cloudflare 기능 활용)
- [ ] 로그 기반 이상 탐지
