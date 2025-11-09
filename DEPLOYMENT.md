# 배포 가이드

## 사전 준비

### 1. Cloudflare 계정 설정
1. [Cloudflare](https://dash.cloudflare.com/)에 가입
2. Workers & Pages 섹션으로 이동
3. Durable Objects가 활성화되어 있는지 확인

### 2. Wrangler CLI 설치
```bash
npm install -g wrangler

# 또는 프로젝트에 로컬 설치
npm install --save-dev wrangler
```

### 3. Cloudflare 인증
```bash
wrangler login
```

브라우저가 열리면 Cloudflare 계정으로 로그인하고 권한을 승인합니다.

## 배포 방법

### 방법 1: 자동 배포 스크립트 (권장)

```bash
# 실행 권한 부여
chmod +x deploy.sh

# 배포 실행
./deploy.sh
```

이 스크립트는 다음을 자동으로 수행합니다:
- Wrangler 설치 확인
- 인증 상태 확인
- Worker 배포 (정적 assets 포함)
- 배포 결과 표시

### 방법 2: 수동 배포

#### Worker 배포 (static assets 포함)

```bash
# 개발 환경에 배포
wrangler deploy

# 프로덕션 환경에 배포
wrangler deploy --env production
```

**Note**: Cloudflare Workers는 이제 `[assets]` 바인딩을 통해 정적 파일을 직접 서빙합니다.
별도의 Pages 배포는 필요하지 않습니다.

#### Pages 별도 배포 (선택사항)

Pages를 독립적으로 배포하려면:

```bash
# Pages 배포
wrangler pages deploy public --project-name=anonymous-chat
```

### 방법 3: GitHub Actions를 통한 자동 배포

`.github/workflows/deploy.yml` 파일 생성:

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Deploy Worker with Assets
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: deploy
```

GitHub Secrets에 `CLOUDFLARE_API_TOKEN` 추가 필요.

**Note**: Worker가 assets 바인딩으로 정적 파일을 포함하므로 별도의 Pages 배포 단계가 필요 없습니다.

## 설정 및 환경 변수

### wrangler.toml 설정

프로젝트의 `wrangler.toml` 파일에서 다음을 확인:

```toml
name = "anonymous-chat"
main = "src/worker.js"
compatibility_date = "2024-11-01"

[[durable_objects.bindings]]
name = "CHAT_ROOM"
class_name = "ChatRoom"

[[migrations]]
tag = "v1"
new_classes = ["ChatRoom"]

[assets]
directory = "public"
binding = "ASSETS"

[vars]
ENVIRONMENT = "production"
```

### 환경별 설정

개발 환경:
```bash
wrangler dev
```

프로덕션 환경:
```bash
wrangler deploy --env production
```

## 커스텀 도메인 설정

### 1. Cloudflare Dashboard 접속
1. Workers & Pages → 배포된 Worker 선택
2. Settings → Triggers → Custom Domains
3. Add Custom Domain 클릭

### 2. 도메인 추가
```
chat.yourdomain.com
```

### 3. DNS 자동 설정
Cloudflare가 자동으로 DNS 레코드를 생성합니다.

### 4. Pages 도메인 설정
1. Pages 프로젝트 선택
2. Custom domains → Set up a custom domain
3. 도메인 입력 및 확인

## 배포 확인

### 1. Worker 상태 확인
```bash
wrangler tail
```

실시간 로그를 확인하여 배포가 정상적으로 작동하는지 확인합니다.

### 2. 헬스 체크
```bash
curl https://your-worker.workers.dev/health
```

응답 예시:
```json
{"status":"healthy"}
```

### 3. 메트릭 확인
```bash
curl https://your-worker.workers.dev/metrics
```

### 4. 브라우저 테스트
배포된 URL로 접속하여 채팅 기능을 테스트합니다.

## 모니터링

### Cloudflare Dashboard
1. Workers & Pages → 프로젝트 선택
2. Metrics 탭에서 다음을 확인:
   - 요청 수
   - 오류율
   - CPU 시간
   - 대역폭 사용량

### 로그 스트리밍
```bash
# 실시간 로그 확인
wrangler tail

# 필터링된 로그
wrangler tail --format pretty
```

### 알림 설정
Cloudflare Dashboard에서 알림 규칙 설정:
- 오류율이 임계값 초과 시
- CPU 시간 초과 시
- 요청 급증 시

## 롤백

### 이전 버전으로 롤백
```bash
# 배포 히스토리 확인
wrangler deployments list

# 특정 버전으로 롤백
wrangler rollback [deployment-id]
```

### 긴급 조치
```bash
# Worker 비활성화
wrangler delete

# 재배포
wrangler deploy
```

## 비용 관리

### Free Tier 제한
- Worker: 100,000 요청/일
- Durable Objects: 1GB 저장소, 1백만 요청/월
- Pages: 무제한 요청

### Paid Plan
- Workers Paid: $5/월 + 사용량 기반
- Durable Objects: 사용량 기반 과금

### 비용 최적화
- 불필요한 로그 감소
- 메시지 히스토리 제한 유지
- 비활성 세션 적극 정리

## 문제 해결

### Durable Objects 활성화 안 됨
```bash
# Durable Objects 마이그레이션 실행
wrangler deploy
```

Dashboard에서 Durable Objects 플랜 확인.

### 배포 실패
```bash
# 로그 확인
wrangler tail

# 설정 검증
wrangler deploy --dry-run
```

### WebSocket 연결 실패
- Worker URL이 올바른지 확인
- CORS 설정 확인
- 브라우저 콘솔에서 에러 확인

### Pages 배포 안 됨
```bash
# 프로젝트 재생성
wrangler pages project create anonymous-chat

# 강제 배포
wrangler pages deploy public --project-name=anonymous-chat --branch=main
```

## 보안 체크리스트

배포 전 확인사항:
- [ ] Rate limiting 설정 확인
- [ ] IP 차단 목록 설정 (필요시)
- [ ] 메시지 길이 제한 확인
- [ ] CORS 설정 검토
- [ ] 환경 변수 보안 확인
- [ ] API 토큰 보안 유지

## 성능 최적화

### 배포 후 최적화
1. Cloudflare Analytics에서 병목 확인
2. 느린 엔드포인트 최적화
3. 캐싱 전략 조정
4. Durable Object 위치 최적화

### 모니터링 대시보드
정기적으로 확인:
- 응답 시간
- 오류율
- 동시 연결 수
- 메모리 사용량

## 업데이트 절차

1. 로컬에서 변경사항 테스트
```bash
wrangler dev
```

2. 개발 환경에 배포
```bash
wrangler deploy --env development
```

3. 테스트 완료 후 프로덕션 배포
```bash
wrangler deploy --env production
```

4. 배포 후 모니터링
```bash
wrangler tail
```

## 지원 및 문서

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Durable Objects Guide](https://developers.cloudflare.com/workers/runtime-apis/durable-objects/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [Community Forum](https://community.cloudflare.com/)
