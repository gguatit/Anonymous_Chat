# 관리자 페이지 가이드

## 개요

`/administrator.html` 경로에서 접근 가능한 관리자 대시보드입니다.

## 접근 방법

1. **URL**: https://kalpha.mmv.kr/administrator.html
2. **인증**: 관리자 ID와 비밀번호 입력 필요

## 필수 환경변수 설정

관리자 기능을 사용하려면 3개의 환경변수가 **필수**입니다:

### 프로덕션 환경
Wrangler CLI 또는 Cloudflare Dashboard에서 설정:

```bash
# 1. HMAC_SECRET (메시지 무결성 검증용)
npx wrangler secret put HMAC_SECRET
# 입력: 랜덤 문자열 (32자 이상 권장)
# 생성 방법: openssl rand -base64 32

# 2. ADMIN_ID (관리자 ID)
npx wrangler secret put ADMIN_ID
# 입력: 원하는 관리자 ID (예: admin)

# 3. ADMIN_PASSWORD (관리자 비밀번호)
npx wrangler secret put ADMIN_PASSWORD
# 입력: 강력한 비밀번호 (16자 이상, 특수문자 포함 권장)
```

### 로컬 개발 환경

.dev.vars 파일 생성 (wrangler dev에서 사용):

```bash
# .dev.vars 파일 생성
cat > .dev.vars << EOF
HMAC_SECRET=your-dev-secret-key-here
ADMIN_ID=admin
ADMIN_PASSWORD=admin123
EOF

# 개발 서버 시작
npx wrangler dev
```

**중요:** 환경변수가 설정되지 않으면 로그인 시 "Service temporarily unavailable" 오류가 발생합니다.

## 대시보드 기능

### 1. 실시간 통계
- **활성 연결**: 현재 접속 중인 사용자 수
- **총 메시지**: 전송된 메시지 총 개수
- **총 접속**: 누적 접속 횟수
- **오류**: 발생한 오류 횟수

### 2. 활성 세션 관리
- 현재 연결된 사용자 목록
- 세션 ID (익명화)
- IP 주소
- 메시지 전송 횟수
- 접속 시간
- 사용자 강제 퇴장 (킥) 및 차단 기능

### 3. 메시지 관리
- 최근 50개 메시지 실시간 표시
- 메시지 내용, 전송 시간
- 수정 여부 표시
- 관리자 메시지 수정/삭제
- 일반 사용자 메시지 삭제

### 4. 시스템 공지
- 전체 사용자에게 공지사항 전송
- 일반 메시지 및 강조 공지 전송
- 새 접속자에게도 자동 전달

### 5. IP 차단 관리
- 차단된 IP 목록 조회
- 차단 해제 기능
- 차단 시간 및 사유 표시

### 6. 감사 로그
- 관리자 활동 기록 조회
- 로그인/로그아웃 이력
- 시스템 이벤트 추적

### 7. 데이터 내보내기
- CSV 형식으로 데이터 내보내기
- 필터링 옵션 (전체, 활성, 시간대별)

## 자동 새로고침

- 기본 5초마다 자동 데이터 업데이트
- 새로고침 간격 조정 가능 (3초/5초/10초/30초)
- 자동 새로고침 활성화/비활성화 토글
- 수동 새로고침 버튼

## 보안 기능

### 토큰 기반 인증
- JWT 유사 토큰 (HMAC-SHA256)
- 2시간 유효기간
- LocalStorage에 저장
- 로그아웃 시 즉시 무효화

### Rate Limiting
- IP당 5회 로그인 실패 시 5분간 차단
- 브루트포스 공격 방지
- 성공 시 카운터 자동 리셋

### 타이밍 공격 방지
- 상수 시간 비교 알고리즘
- ID/Password 검증 시간 동일하게 유지

### API 인증
모든 관리자 API는 `Authorization: Bearer <token>` 헤더 필요

### 주요 엔드포인트
- `POST /api/admin/login` - 로그인
- `POST /api/admin/logout` - 로그아웃 (토큰 무효화)
- `GET /api/admin/verify` - 토큰 검증
- `GET /api/admin/metrics` - 통계 조회
- `GET /api/admin/sessions` - 세션 목록
- `GET /api/admin/messages` - 메시지 목록
- `POST /api/admin/broadcast` - 메시지 전송
- `POST /api/admin/announce` - 공지사항 전송
- `POST /api/admin/kick-user` - 사용자 퇴장
- `POST /api/admin/edit-message` - 메시지 수정
- `POST /api/admin/delete-message` - 메시지 삭제
- `GET /api/admin/banned-ips` - 차단된 IP 목록
- `POST /api/admin/unban-ip` - IP 차단 해제
- `GET /api/admin/logs` - 감사 로그 조회
- `GET /api/admin/audit-logs` - 감사 로그 상세

## 배포 후 설정

1. **환경변수 설정 (필수)**
   ```bash
   npx wrangler secret put HMAC_SECRET
   npx wrangler secret put ADMIN_ID
   npx wrangler secret put ADMIN_PASSWORD
   ```

2. **KV Namespace 생성 (선택)**
   ```bash
   # 감사 로그 및 토큰 블랙리스트용
   npx wrangler kv:namespace create ADMIN_TOKENS
   npx wrangler kv:namespace create ADMIN_LOGS
   ```

3. **접속 확인**
   - https://kalpha.mmv.kr/administrator.html
   - 설정한 ID/비밀번호로 로그인

4. **보안 권장사항**
   - 강력한 비밀번호 사용 (16자 이상, 특수문자 포함)
   - HMAC_SECRET은 최소 32자 랜덤 문자열
   - 정기적으로 비밀번호 변경
   - 토큰 유효기간 2시간 (자동 만료)
   - 브라우저 개발자 도구에서 토큰 노출 주의

## 모바일 지원

반응형 디자인으로 모바일에서도 사용 가능합니다.

## UI 구성

- **다크 모드**: 기본 제공
- **Tailwind CSS**: 디자인 프레임워크
- **실시간 업데이트**: WebSocket 기반
- **반응형 레이아웃**: 모바일/태블릿/데스크톱
- **실시간 업데이트**: 5초 자동 새로고침

## ⚠️ 주의사항

1. **개인정보 보호**
   - 세션 ID는 익명화되어 표시됩니다
   - IP 주소는 관리 목적으로만 사용됩니다

2. **성능**
   - Durable Object에서 데이터 조회
   - 과도한 새로고침 자제

3. **제한사항**
   - 한 번에 한 명의 관리자만 로그인 권장
   - 토큰은 24시간 유효

## 🔧 커스터마이징

### 자동 새로고침 간격 변경
`public/js/admin.js`:
```javascript
this.refreshInterval = setInterval(() => this.refreshData(), 5000); // 5초 → 변경
```

### 토큰 유효기간 변경
`src/worker.js`:
```javascript
if (Date.now() - parseInt(timestamp) > 24 * 60 * 60 * 1000) { // 24시간 → 변경
```

### 메시지 개수 변경
`public/js/admin.js`:
```javascript
container.innerHTML = messages.slice(-50).reverse().map(msg => // 50개 → 변경
```
