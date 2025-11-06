# 아키텍처 문서

## 시스템 아키텍처

### 개요
이 애플리케이션은 Cloudflare의 엣지 컴퓨팅 인프라를 활용하여 전 세계 어디서나 낮은 지연시간으로 실시간 채팅을 제공합니다.

### 컴포넌트

#### 1. Cloudflare Worker (Entry Point)
- **역할**: HTTP/WebSocket 요청의 진입점
- **기능**:
  - WebSocket 업그레이드 처리
  - IP 기반 접근 제어
  - Durable Object 라우팅
  - 헬스 체크 및 메트릭 API
- **위치**: `src/worker.js`

#### 2. Durable Object (ChatRoom)
- **역할**: 채팅방 상태 관리
- **기능**:
  - WebSocket 연결 관리
  - 세션 관리 및 추적
  - 메시지 브로드캐스팅
  - Rate Limiting 적용
  - 타이핑 표시 관리
  - 임시 메시지 저장 (in-memory)
- **특징**:
  - 단일 Durable Object 인스턴스가 모든 연결 처리
  - 강력한 일관성 보장
  - 자동 상태 복구

#### 3. Cloudflare Pages (Frontend)
- **역할**: 정적 자산 호스팅
- **내용**:
  - HTML (index.html)
  - JavaScript (app.js)
  - Tailwind CSS (CDN)
- **특징**:
  - 글로벌 CDN 배포
  - 자동 HTTPS
  - 빠른 로딩 속도

### 데이터 흐름

#### 연결 수립
```
1. 사용자 → Pages (HTML/JS 로드)
2. 클라이언트 → Worker (/ws 요청)
3. Worker → IP 검증 → Durable Object
4. Durable Object → WebSocket 수락
5. 클라이언트 ← 연결 확인
```

#### 메시지 전송
```
1. 사용자 입력 → 클라이언트 검증 (길이, Rate Limit)
2. 클라이언트 → WebSocket → Durable Object
3. Durable Object → 메시지 검증 (서버 측)
4. Durable Object → 모든 연결된 클라이언트에 브로드캐스트
5. 각 클라이언트 → UI 업데이트
```

#### 타이핑 표시
```
1. 사용자 입력 시작 → 클라이언트
2. 클라이언트 → Durable Object (typing: true)
3. Durable Object → 다른 클라이언트들에게 브로드캐스트
4. 2초간 입력 없음 → typing: false 전송
```

## 보안 아키텍처

### 다층 보안 모델

#### Layer 1: Cloudflare Network
- DDoS 보호
- 자동 SSL/TLS
- 지역별 차단 (선택 사항)

#### Layer 2: Worker (Entry Point)
- IP 기반 접근 제어
- BANNED_IPS 확인
- IP_WHITELIST 검증
- IP당 연결 수 제한

#### Layer 3: Durable Object
- 세션 검증
- Rate Limiting:
  - 메시지당 1초 Cooldown
  - 분당 최대 30개 메시지
  - IP당 최대 5개 동시 연결
- 입력 검증 및 Sanitization
- 메시지 길이 제한 (500자)

#### Layer 4: Client
- XSS 방지 (textContent 사용)
- 클라이언트 측 Rate Limiting
- 입력 길이 제한
- 지수적 백오프 재연결

### 데이터 보안

#### 메시지 저장
- **저장 위치**: 메모리만 (디스크 저장 없음)
- **보관 기간**: 세션 동안만
- **최대 메시지**: 100개 (오래된 것 자동 삭제)
- **영구성**: 없음 (재시작 시 모두 삭제)

#### 사용자 익명성
- 닉네임 수집 안 함
- 이메일/로그인 불필요
- 세션 ID만 사용 (랜덤 생성)
- 메타데이터: IP, 접속 시간, 메시지 수 (세션 종료 시 삭제)

## 성능 최적화

### 네트워크 최적화
- WebSocket을 통한 실시간 양방향 통신
- Cloudflare 엣지에서 처리 (낮은 지연시간)
- 메시지 압축 및 최적화

### 메모리 최적화
- 메시지 히스토리 제한 (최대 100개)
- 주기적 세션 정리 (5분 타임아웃)
- 비활성 연결 자동 종료

### 브로드캐스트 최적화
- 발신자 제외 브로드캐스트
- 비동기 메시지 전송
- 에러 핸들링으로 장애 격리

## 확장성

### Horizontal Scaling
- Cloudflare의 글로벌 네트워크 활용
- 자동 로드 밸런싱
- 무제한 Worker 인스턴스

### State Management
- Durable Objects를 통한 일관된 상태 관리
- 단일 채팅방 = 단일 Durable Object
- 자동 페일오버 및 복구

### 제한사항
- 단일 Durable Object당 최대 연결 수 제한
- WebSocket 연결당 메모리 사용량
- 권장 동시 접속: ~1000명 이하

## 모니터링 및 로깅

### 메트릭 수집
```javascript
{
  totalConnections: 0,    // 누적 연결 수
  activeConnections: 0,   // 현재 활성 연결
  totalMessages: 0,       // 총 메시지 수
  errors: 0              // 에러 발생 수
}
```

### 로그 레벨
- Error: 치명적 오류
- Warning: 주의 필요
- Info: 일반 정보
- Debug: 개발 디버깅

### 모니터링 도구
- `wrangler tail`: 실시간 로그
- Cloudflare Dashboard: 그래픽 메트릭
- `/metrics` API: 프로그래밍 접근

## 재해 복구

### 자동 복구
- Durable Object 자동 재시작
- WebSocket 자동 재연결 (지수적 백오프)
- 세션 타임아웃 및 정리

### 수동 복구
- Worker 재배포
- Durable Object 마이그레이션
- 긴급 IP 차단

## 향후 개선 사항

### 기능 추가
- [ ] 여러 채팅방 지원
- [ ] 파일 공유
- [ ] 이모지 리액션
- [ ] 음성 메시지

### 성능 개선
- [ ] 메시지 배치 처리
- [ ] 연결 풀링
- [ ] 캐싱 전략

### 보안 강화
- [ ] End-to-End 암호화
- [ ] CAPTCHA 통합
- [ ] 더 정교한 스팸 필터
