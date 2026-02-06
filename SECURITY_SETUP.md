# 보안 설정 가이드

## 구현된 보안 기능

### 2024년 보안 업데이트 (최신)

#### 1. HMAC_SECRET 필수화
- 소스코드에서 fallback 제거
- 환경변수 미설정 시 서비스 시작 불가
- 메시지 무결성 검증 필수

#### 2. XSS 공격 방어 강화
- URL 검증: javascript:, data: 스킴 차단
- File URL 검증 추가
- innerHTML 인라인 이벤트 핸들러 제거
- 모든 URL 인코딩 및 검증

#### 3. Rate Limiting 개선
- CF-Connecting-IP 헤더 필수화
- 'unknown' IP 허용 제거
- IP 없는 요청 완전 차단

#### 4. CORS 설정 통일
- constants.js에서 중앙 관리
- 프로덕션: kalpha.mmv.kr
- 개발: localhost:8787, 127.0.0.1:8787

#### 5. 토큰 유효기간 단축
- 24시간 → 2시간으로 단축
- 토큰 탈취 시 피해 최소화
- 블랙리스트 TTL도 2시간 동기화

#### 6. 세션 ID 예측 불가능
- 타임스탬프 제거
- 순수 암호학적 랜덤 값만 사용

#### 7. 에러 메시지 일반화
- 내부 정보 노출 방지
- "Admin credentials not configured" → "Service temporarily unavailable"
- 503 상태 코드 사용

#### 8. 서버 측 Sanitization 강화
- HTML 태그 완전 제거
- 제어 문자 필터링
- 줄바꿈 정규화

### 기존 보안 기능

#### 환경변수 전용 인증
- 소스코드에 비밀번호 하드코딩 완전 제거
- Cloudflare Secrets 사용 필수
- 설정 누락 시 서비스 중단

#### Rate Limiting
- IP당 5회 로그인 실패 시 5분간 차단
- 성공 시 카운터 자동 리셋
- Cloudflare KV로 실패 횟수 추적
- 차단 시도도 감사 로그에 기록

#### 타이밍 공격 방지
- 상수 시간 비교 알고리즘 사용
- ID/Password 검증 시간 동일하게 유지
- 실패 시에도 일정 시간 대기 (100ms)
- 차단 시 추가 대기 (1000ms)

#### CORS 제한
- kalpha.mmv.kr 허용
- 로컬 개발용 localhost 허용
- Access-Control-Allow-Origin: * 제거
- Credentials 허용으로 쿠키 보안 강화

#### 감사 로그 (Audit Logging)
- 모든 관리자 활동 기록 (로그인, 로그아웃, 실패 시도, 차단)
- IP 주소, User-Agent, 타임스탬프 저장
- 30일 자동 삭제 (Cloudflare KV TTL)

#### 세션 무효화 (Token Blacklist)
- 로그아웃 시 토큰 즉시 무효화
- 로그아웃 후 토큰 재사용 불가
- 2시간 자동 만료

---

## 계정 탈취 방어 메커니즘

### 방어된 공격 벡터

#### 1. 브루트포스 공격 (Brute Force)
```
공격: 수천 개 비밀번호 시도
방어: Rate Limiting - 5회 실패 후 5분 차단
결과: 차단됨
```

#### 2. 타이밍 공격 (Timing Attack)
```
공격: 응답 시간으로 ID 존재 여부 유추
방어: 상수 시간 비교 + 실패 시 동일 대기 시간
결과: 차단됨
```

#### 3. 토큰 재사용 공격 (Token Replay)
```
공격: 로그아웃 후 이전 토큰 재사용
방어: Token Blacklist - 로그아웃 시 KV에 등록
결과: 차단됨
```

#### 4. CSRF 공격 (Cross-Site Request Forgery)
```
공격: 악성 사이트에서 관리자 API 호출
방어: CORS 제한 - kalpha.mmv.kr만 허용
결과: 차단됨
```

#### 5. 세션 하이재킹 (Session Hijacking)
```
공격: 토큰 탈취 후 재사용
방어: 2시간 만료 + 로그아웃 시 즉시 무효화
결과: 피해 최소화 (2시간 이내)
```

#### 6. XSS 공격 (Cross-Site Scripting)
```
공격: javascript: 또는 data: URL 삽입
방어: URL 검증 및 인코딩, 인라인 핸들러 제거
결과: 차단됨
```

#### 7. Rate Limiting 우회
```
공격: CF-Connecting-IP 없이 요청
방어: CF-Connecting-IP 헤더 필수화
결과: 400 Bad Request
```

---

## 배포 전 필수 설정

### 1단계: 시크릿 설정 (필수)

```bash
# HMAC 시크릿 설정 (필수)
npx wrangler secret put HMAC_SECRET
# 입력: 랜덤 문자열 (32자 이상 권장)
# 생성 방법: openssl rand -base64 32

# 관리자 ID 설정 (필수)
npx wrangler secret put ADMIN_ID
# 입력: admin (또는 원하는 ID)

# 관리자 비밀번호 설정 (필수)
npx wrangler secret put ADMIN_PASSWORD
# 입력: 강력한 비밀번호 (최소 16자, 특수문자 포함)
```

**중요**: 이 3개 환경변수가 설정되지 않으면 서비스가 작동하지 않습니다.

### 2단계: KV Namespace 생성 (선택)

```bash
# 토큰 블랙리스트용 KV
npx wrangler kv:namespace create ADMIN_TOKENS

# 감사 로그용 KV
npx wrangler kv:namespace create ADMIN_LOGS
```

출력된 ID를 `wrangler.toml`에 입력:

```toml
[[kv_namespaces]]
binding = "ADMIN_TOKENS"
id = "YOUR_ACTUAL_KV_ID"  # 여기에 실제 ID 입력!

[[kv_namespaces]]
binding = "ADMIN_LOGS"
id = "YOUR_ACTUAL_KV_ID"  # 여기에 실제 ID 입력!
```

### 3단계: 배포

```bash
npx wrangler deploy
```

---

## 로컬 개발 환경 설정

### .dev.vars 파일 생성

```bash
# .dev.vars 파일 생성 (로컬 개발용)
cat > .dev.vars << EOF
HMAC_SECRET=your-dev-secret-key-here
ADMIN_ID=admin
ADMIN_PASSWORD=admin123
EOF

# 개발 서버 시작
npx wrangler dev
```

**참고**: .dev.vars 파일은 .gitignore에 포함되어야 합니다.

---

## 감사 로그 조회

관리자 로그인 후 브라우저 콘솔에서:

```javascript
fetch('/api/admin/logs', {
    headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
    }
})
.then(r => r.json())
.then(data => console.table(data.logs));
```

### 로그 데이터 예시

```json
{
  "logs": [
    {
      "type": "login_success",
      "admin": "kalpha",
      "ip": "123.45.67.89",
      "timestamp": 1700000000000,
      "userAgent": "Mozilla/5.0..."
    },
    {
      "type": "login_failed",
      "reason": "invalid_credentials",
      "attemptedId": "hacker",
      "ip": "111.22.33.44",
      "timestamp": 1699999000000
    },
    {
      "type": "logout",
      "ip": "123.45.67.89",
      "timestamp": 1700001000000
    }
  ]
}
```

---

## 보안 검증

### 테스트 1: 환경변수 필수 확인
```bash
# 시크릿 없이 배포 시도 → 로그인 실패 확인
curl -X POST https://your-worker.workers.dev/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"id":"kalpha","password":"wrong"}'

# 응답: {"success":false,"error":"Admin credentials not configured"}
```

### 테스트 2: 토큰 무효화 확인
```bash
# 1. 로그인
TOKEN=$(curl -X POST https://your-worker.workers.dev/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"id":"kalpha","password":"your_password"}' \
  | jq -r '.token')

# 2. 로그아웃
curl -X POST https://your-worker.workers.dev/api/admin/logout \
  -H "Authorization: Bearer $TOKEN"

# 3. 같은 토큰으로 재접근 시도 → 401 Unauthorized
curl https://your-worker.workers.dev/api/admin/metrics \
  -H "Authorization: Bearer $TOKEN"
```

### 테스트 3: 감사 로그 기록 확인
```bash
# 로그인 시도 후
curl https://your-worker.workers.dev/api/admin/logs \
  -H "Authorization: Bearer $VALID_TOKEN" \
  | jq '.logs[] | select(.type == "login_success")'
```

---

## 📋 감사 로그 이벤트 타입

| 타입 | 설명 | 기록 데이터 |
|------|------|-------------|
| `login_success` | 로그인 성공 | admin, ip, timestamp, userAgent |
| `login_failed` | 로그인 실패 | attemptedId, ip, timestamp, reason |
| `login_error` | 로그인 에러 | ip, timestamp, error |
| `logout` | 로그아웃 | ip, timestamp |

---

## ⚠️ 주의사항

1. **KV 비용**: 
   - 무료: 10만 읽기/일, 1천 쓰기/일
   - 로그인 1회 = 쓰기 1회 + 읽기 2회
   - 일 333회 로그인까지 무료

2. **로그 보관**:
   - 30일 자동 삭제
   - 장기 보관 필요시 별도 백업 필요

3. **토큰 만료**:
   - 2시간 자동 만료
   - 로그아웃하면 즉시 무효화
   - 재로그인 필요

---

## 문제 해결

### 로그인 안 됨
```bash
# 시크릿 확인
npx wrangler secret list

# 시크릿 재설정
npx wrangler secret put ADMIN_ID
npx wrangler secret put ADMIN_PASSWORD
```

### KV 오류
```bash
# KV 네임스페이스 목록 확인
npx wrangler kv:namespace list

# wrangler.toml의 ID가 올바른지 확인
```

### 감사 로그 안 보임
```bash
# KV에 데이터 확인
npx wrangler kv:key list --namespace-id=YOUR_ADMIN_LOGS_ID

# 특정 로그 조회
npx wrangler kv:key get "log:1700000000000:uuid" --namespace-id=YOUR_ID
```
