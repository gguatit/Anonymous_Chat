# Cloudflare 배포 가이드 (Worker + Pages 분리 방식)

## 문제 상황
현재 프로젝트는 Cloudflare Worker로 설정되어 있으며, "Workers with Assets" 오류가 발생합니다.

## 권장 해결 방법: Worker + Pages 분리

### 1단계: Worker 배포 (API/WebSocket만)

현재 Worker는 API와 WebSocket만 처리하도록 설정되어 있습니다.

#### Cloudflare 대시보드 설정:
1. **Workers & Pages** > **kalpha-mmv-kr** 선택
2. **Settings** > **Builds** 섹션
3. **배포 명령**을 다음으로 변경:
   ```
   npx wrangler deploy --legacy-env false
   ```
4. **Save**

### 2단계: Pages 프로젝트 생성 (정적 파일 서빙)

#### 새 Pages 프로젝트 생성:
1. **Workers & Pages** > **Create** 클릭
2. **Pages** 탭 선택
3. **Connect to Git** 클릭
4. 저장소 선택: `gguatit/Anonymous_Chat`
5. 프로젝트 이름: `kalpha-mmv-kr-static` (또는 원하는 이름)
6. 빌드 설정:
   - **Framework preset**: None
   - **Build command**: (비워두기)
   - **Build output directory**: `public`
   - **Root directory**: `/`

#### Environment Variables 설정:
Pages 프로젝트에는 환경 변수가 필요 없습니다 (순수 정적 파일만 제공).

### 3단계: 도메인 연결

#### Worker (API/WebSocket):
- `api.kalpha.mmv.kr` → Worker (`kalpha-mmv-kr`)
- WebSocket: `wss://api.kalpha.mmv.kr/ws`

#### Pages (정적 파일):
- `kalpha.mmv.kr` → Pages (`kalpha-mmv-kr-static`)

### 4단계: 클라이언트 코드 수정

`public/js/websocket.js` 등에서 WebSocket URL을 다음과 같이 수정:

```javascript
const wsUrl = 'wss://api.kalpha.mmv.kr/ws';
```

또는 환경에 따라 자동 감지:

```javascript
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsHost = window.location.hostname === 'localhost' 
    ? 'localhost:8787' 
    : 'api.kalpha.mmv.kr';
const wsUrl = `${protocol}//${wsHost}/ws`;
```

## 대안: 순수 Worker만 사용

Worker만 사용하려면 정적 파일을 Cloudflare R2에 업로드하고 Worker에서 직접 제공해야 합니다.

### R2 버킷 생성 및 파일 업로드:
```bash
# R2 버킷 생성
wrangler r2 bucket create anonymous-chat-static

# 파일 업로드
wrangler r2 object put anonymous-chat-static/index.html --file=public/index.html
wrangler r2 object put anonymous-chat-static/app.js --file=public/app.js
# ... 모든 파일 업로드
```

이 방법은 복잡하므로 **Worker + Pages 분리 방식**을 권장합니다.

## 현재 배포 상태

현재 Worker는 다음 엔드포인트만 제공합니다:
- `/api/*` - API 엔드포인트
- `/ws` - WebSocket
- `/health` - 헬스 체크
- `/metrics` - 메트릭

정적 파일은 별도의 Pages 프로젝트를 통해 제공해야 합니다.
