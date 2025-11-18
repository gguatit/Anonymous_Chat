# 관리자 페이지 가이드

## 📋 개요

`/administrator` 경로에서 접근 가능한 관리자 대시보드입니다.

## 🔐 접근 방법

1. **URL**: https://kalpha.mmv.kr/administrator
2. **인증**: 관리자 비밀번호 입력 필요

## 🔑 비밀번호 설정

### 개발 환경
기본값: `admin123` (코드에 하드코딩)

### 프로덕션 환경
Cloudflare Dashboard에서 설정:

```bash
# Wrangler CLI 사용
npx wrangler secret put ADMIN_PASSWORD
# 프롬프트에서 비밀번호 입력

# 또는 Cloudflare Dashboard에서:
# Workers & Pages → kalpha-mmv-kr → Settings → Variables and Secrets
# Secret 추가: ADMIN_PASSWORD
```

## 📊 대시보드 기능

### 1. 실시간 통계
- **활성 연결**: 현재 접속 중인 사용자 수
- **총 메시지**: 전송된 메시지 총 개수
- **총 접속**: 누적 접속 횟수
- **오류**: 발생한 오류 횟수

### 2. 활성 세션
- 현재 연결된 사용자 목록
- 세션 ID (익명화)
- IP 주소
- 메시지 전송 횟수
- 접속 시간

### 3. 최근 메시지
- 최근 50개 메시지 실시간 표시
- 메시지 내용, 전송 시간
- 수정 여부 표시

### 4. 시스템 정보
- 서버 시간
- Worker 가동 시간
- Worker 버전

## 🔄 자동 새로고침

- 5초마다 자동으로 데이터 업데이트
- 수동 새로고침 버튼 제공

## 🔒 보안 기능

### 토큰 기반 인증
- JWT 유사 토큰 (HMAC-SHA256)
- 24시간 유효기간
- LocalStorage에 저장

### API 인증
모든 관리자 API는 `Authorization: Bearer <token>` 헤더 필요

### 엔드포인트
- `POST /api/admin/login` - 로그인
- `GET /api/admin/verify` - 토큰 검증
- `GET /api/admin/metrics` - 통계 조회
- `GET /api/admin/sessions` - 세션 목록
- `GET /api/admin/messages` - 메시지 목록

## 🚀 배포 후 설정

1. **비밀번호 설정**
   ```bash
   npx wrangler secret put ADMIN_PASSWORD
   ```

2. **접속 확인**
   - https://kalpha.mmv.kr/administrator
   - 설정한 비밀번호로 로그인

3. **보안 권장사항**
   - 강력한 비밀번호 사용 (16자 이상, 특수문자 포함)
   - 정기적으로 비밀번호 변경
   - 브라우저 개발자 도구에서 토큰 노출 주의

## 📱 모바일 지원

반응형 디자인으로 모바일에서도 사용 가능합니다.

## 🎨 UI 구성

- **다크 모드**: 기본 제공
- **Tailwind CSS**: 디자인 프레임워크
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
