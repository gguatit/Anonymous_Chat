# Cloudflare Pages 배포 가이드

## ⚠️ 중요: Pages 대시보드 설정

이 프로젝트는 **빌드가 필요 없는** Pages Functions 프로젝트입니다.

### 필수 설정 단계

1. **Cloudflare Dashboard** → **Pages** → **kalpha-mmv-kr** 프로젝트 선택

2. **Settings** → **Builds & deployments** 클릭

3. **Build configuration** 섹션에서 **Edit configuration** 클릭

4. 다음과 같이 설정:
   ```
   Framework preset: None
   Build command: (완전히 비워두기 - 아무것도 입력하지 말 것!)
   Build output directory: public
   Root directory: (기본값) /
   ```

5. **Save** 클릭

6. **Retry deployment** 버튼 클릭하여 재배포

### 왜 빌드 명령이 없어야 하나?

- 이 프로젝트는 **순수 정적 파일 + Pages Functions** 조합입니다
- `public/` 폴더의 HTML/CSS/JS는 그대로 사용됩니다
- `functions/_middleware.js`가 서버 로직을 처리합니다
- 빌드 과정이 전혀 필요하지 않습니다

현재 오류(`wrangler deploy`가 실행됨)는 Pages 대시보드에 빌드 명령이 설정되어 있기 때문입니다.

## 배포 방법

Cloudflare Pages는 GitHub와 연동되어 자동으로 배포됩니다.

### 1. GitHub에 푸시
```bash
git add -A
git commit -m "Update code"
git push
```

### 2. Cloudflare Pages 대시보드 설정

#### 빌드 설정
- **Build command**: 비워두기 (또는 `echo "No build required"`)
- **Build output directory**: `public`
- **Root directory**: `/` (기본값)

#### Environment Variables 설정
Pages 대시보드 > Settings > Environment variables에서 다음을 추가:

**Production & Preview 모두 설정:**
- `ADMIN_ID`: 관리자 계정 ID
- `ADMIN_PASSWORD`: 관리자 비밀번호
- `HMAC_SECRET`: 메시지 서명용 시크릿 키 (랜덤 문자열)
- `ENVIRONMENT`: `production`

#### Bindings 설정
Pages 대시보드 > Settings > Functions에서:

**KV Namespaces:**
1. Variable name: `ADMIN_TOKENS`
   - KV namespace: `31c6551451f6466bb1ad33fbe10bf966`
2. Variable name: `ADMIN_LOGS`
   - KV namespace: `5eba46ff86454bf0a6dfb6791789e4f2`

**Durable Objects:**
1. Variable name: `CHAT_ROOM`
   - Durable Object namespace: `ChatRoom`
   - Class: `ChatRoom`
   - Script: `kalpha-mmv-kr` (또는 현재 프로젝트 이름)

### 3. 배포 확인

배포 후 다음 URL로 확인:
- 메인: https://kalpha.mmv.kr/
- 헬스체크: https://kalpha.mmv.kr/health
- 메트릭: https://kalpha.mmv.kr/metrics
- 관리자: https://kalpha.mmv.kr/administrator.html

## 로컬 개발

```bash
# 개발 서버 실행
npm run dev

# 또는
wrangler pages dev public --compatibility-date=2024-11-01
```

## 문제 해결

### Durable Objects 바인딩 오류
Pages 대시보드에서 Durable Objects를 직접 생성할 수 없는 경우:

1. 먼저 Worker로 배포하여 Durable Object 생성:
   ```bash
   wrangler deploy --env=""
   ```

2. 생성된 Durable Object를 Pages에서 참조

### 환경 변수가 적용되지 않는 경우
- Pages 대시보드에서 환경 변수 설정 후 재배포 필요
- Production과 Preview 환경 모두 설정했는지 확인

### 함수가 실행되지 않는 경우
- `functions/_middleware.js` 파일이 존재하는지 확인
- 파일 경로와 import 경로가 올바른지 확인

## 참고

- Pages Functions는 `/functions` 폴더의 파일을 자동으로 인식
- `_middleware.js`는 모든 요청을 가로채서 처리
- 정적 파일은 자동으로 `public/` 폴더에서 제공됨
