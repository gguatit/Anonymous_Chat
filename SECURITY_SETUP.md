# 보안 설정 가이드

## ✅ 구현된 보안 기능

### 1. 환경변수 전용 인증 (하드코딩 제거) ✅
- ❌ 소스코드에 비밀번호 하드코딩 완전 제거
- ✅ Cloudflare Secrets 사용 필수
- ✅ 설정 누락 시 로그인 차단

### 2. Rate Limiting (무차별 대입 공격 방지) ✅
- ✅ IP당 5회 로그인 실패 시 5분간 차단
- ✅ 성공 시 카운터 자동 리셋
- ✅ Cloudflare KV로 실패 횟수 추적
- ✅ 차단 시도도 감사 로그에 기록

### 3. 타이밍 공격 방지 ✅
- ✅ 상수 시간 비교 알고리즘 사용
- ✅ ID/Password 검증 시간 동일하게 유지
- ✅ 실패 시에도 일정 시간 대기 (100ms)
- ✅ 차단 시 추가 대기 (1000ms)

### 4. CORS 제한 ✅
- ✅ `kalpha.mmv.kr`만 허용
- ✅ 로컬 개발용 localhost 허용
- ✅ `Access-Control-Allow-Origin: *` 제거
- ✅ Credentials 허용으로 쿠키 보안 강화

### 6. 감사 로그 (Audit Logging) ✅
- ✅ 모든 관리자 활동 기록 (로그인, 로그아웃, 실패 시도, 차단)
- ✅ IP 주소, User-Agent, 타임스탬프 저장
- ✅ 30일 자동 삭제 (Cloudflare KV TTL)

### 7. 세션 무효화 (Token Blacklist) ✅
- ✅ 로그아웃 시 토큰 즉시 무효화
- ✅ 로그아웃 후 토큰 재사용 불가
- ✅ 24시간 자동 만료

---

## 🛡️ 계정 탈취 방어 메커니즘

### ✅ 방어된 공격 벡터

#### 1. 브루트포스 공격 (Brute Force)
```
공격: 수천 개 비밀번호 시도
방어: Rate Limiting - 5회 실패 후 5분 차단
결과: ✅ 차단됨
```

#### 2. 타이밍 공격 (Timing Attack)
```
공격: 응답 시간으로 ID 존재 여부 유추
방어: 상수 시간 비교 + 실패 시 동일 대기 시간
결과: ✅ 차단됨
```

#### 3. 토큰 재사용 공격 (Token Replay)
```
공격: 로그아웃 후 이전 토큰 재사용
방어: Token Blacklist - 로그아웃 시 KV에 등록
결과: ✅ 차단됨
```

#### 4. CSRF 공격 (Cross-Site Request Forgery)
```
공격: 악성 사이트에서 관리자 API 호출
방어: CORS 제한 - kalpha.mmv.kr만 허용
결과: ✅ 차단됨
```

#### 5. 세션 하이재킹 (Session Hijacking)
```
공격: 토큰 탈취 후 재사용
방어: 24시간 만료 + 로그아웃 시 즉시 무효화
결과: ✅ 피해 최소화 (24시간 이내)
```

---

## 🚀 배포 전 필수 설정

### 1단계: KV Namespace 생성

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

### 2단계: 시크릿 설정 (필수!)

```bash
# 관리자 ID 설정
npx wrangler secret put ADMIN_ID
# 입력: kalpha (또는 원하는 ID)

# 관리자 비밀번호 설정
npx wrangler secret put ADMIN_PASSWORD
# 입력: 강력한 비밀번호 (최소 12자, 특수문자 포함)

# HMAC 시크릿 설정
npx wrangler secret put HMAC_SECRET
# 입력: 랜덤 문자열 (32자 이상 권장)
```

**⚠️ 주의**: 시크릿을 설정하지 않으면 관리자 로그인이 작동하지 않습니다!

### 3단계: 배포

```bash
npx wrangler deploy
```

---

## 📊 감사 로그 조회

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

## 🔒 보안 검증

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
   - 24시간 자동 만료
   - 로그아웃하면 즉시 무효화
   - 재로그인 필요

---

## 🔧 문제 해결

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
