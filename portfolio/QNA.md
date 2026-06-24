# Q&A 모음집 (심층 답변)

> 발표에서 다루지 못한 추가 질문 + 더 깊은 답변  
> 면접·세미나·포트폴리오 리뷰 시 참고

---

## 기술 아키텍처 심화

### Q: WebSocket 메시지 한 건의 전체 흐름을 설명해주세요

**A**: 클라이언트 → 서버 → 다른 클라이언트까지의 흐름:

```
[Client A]                          [Cloudflare Edge]              [ChatRoom DO]
   │                                       │                              │
   │ 1. WSS Handshake (Upgrade)             │                              │
   ├──────────────────────────────────────▶│                              │
   │                                       │ 2. /ws 라우팅               │
   │                                       ├─────────────────────────────▶│
   │                                       │                              │ 3. WS Pair 생성
   │                                       │                              │    ipConnections++
   │                                       │                              │    this.sessions.set(sid, ws)
   │                                       │                              │
   │ 4. {type:"handshake", secret:...}      │                              │
   │◀──────────────────────────────────────┤◀─────────────────────────────┤
   │                                       │                              │
   │ 5. crypto.subtle.importKey(secret)    │                              │
   │                                       │                              │
   │ 6. {type:"message",                    │                              │
   │     content:"hi",                      │                              │
   │     sessionId:"user_abc",              │                              │
   │     timestamp: 1234567890,             │                              │
   │     signature: HMAC(...)}              │                              │
   ├──────────────────────────────────────▶│                              │
   │                                       │ 7. verifyMessageSignature()   │
   │                                       ├─────────────────────────────▶│
   │                                       │                              │ 8. validateClientMessage()
   │                                       │                              │    - type 체크
   │                                       │                              │    - 길이 체크 (7500자)
   │                                       │                              │    - 파일 info 체크
   │                                       │                              │
   │                                       │                              │ 9. this.messages.push(msg)
   │                                       │                              │ 10. broadcast()
   │                                       │                              │     for (other of sessions) {
   │                                       │                              │       if (other !== sender)
   │                                       │                              │         other.send(msg)
   │                                       │                              │     }
   │                                       │                              │
   │                          11. 다른 클라로│                              │
   │◀──────────────────────────────────────┤◀─────────────────────────────┤
```

핵심 포인트:
- **단일 스레드 (DO)** 이므로 steps 8-10이 **원자적** — race condition 없음
- **메모리 + 영구 저장** 두 곳에 메시지 저장 (재시작 대비)
- **12시간 후 cleanup** 이 별도 interval에서 동작

---

### Q: Durable Objects의 "단일 스레드"는 정말 무결성을 보장하나요?

**A**: **부분적으로** 보장합니다.

✅ 보장되는 것:
- 한 DO 인스턴스 내에서 **들어오는 요청은 순차 처리** (input gate)
- 따라서 `this.messages.push()` 와 `this.sessions.get()` 사이에 race condition 없음

❌ 보장 안 되는 것:
- **Storage API** (`state.storage.put()`)는 비동기 → await 사이에 다른 요청 가능
- **다른 DO 인스턴스** 간 통신은 RPC라서 일관성 없음
- **Eviction 후 재시작** 시 메모리 상태는 사라짐 (Storage에서 다시 로드)

실제 코드에서 조심한 부분:
```javascript
// ❌ 위험한 코드
const msg = this.messages.pop();
await this.state.storage.put("messages", this.messages); // ← 여기서 yield

// ✅ 안전한 코드
const msg = this.messages.pop();
const newList = [...this.messages];
await this.state.storage.put("messages", newList); // 명시적 스냅샷
```

---

### Q: WebSocket 재연결 시 메시지 손실은 어떻게 처리하나요?

**A**: **최신 메시지 동기화** 방식으로 처리합니다.

1. 클라이언트 재연결 시 `lastMessageId` 전송
2. 서버(`ChatRoom`)가 `messages` 배열에서 그 ID 이후 메시지만 찾아서 전송
3. 만약 서버가 재시작됐으면 (DO evicted) → Storage에서 메시지 복원 후 동일 처리

`chat.js`의 `wsManager.reconnect()`:
```javascript
this.ws.onopen = () => {
  this.send({ type: 'sync', lastMessageId: this.lastSeenId });
};
```

서버의 sync 핸들러:
```javascript
const idx = this.messages.findIndex(m => m.id === lastMessageId);
const missed = this.messages.slice(idx + 1);
missed.forEach(m => ws.send(m));
```

**한계**: 12시간이 지난 메시지는 사라졌으므로 복구 불가. 그래서 클라이언트 UI에 "이전 메시지는 표시할 수 없습니다" 토스트.

---

### Q: 오프라인 사용자에게 푸시 알림을 어떻게 보내나요?

**A**: **Cloudflare Workers AI + KV + Web Push** 조합:

1. 사용자가 `chat.js`에서 푸시 구독 → `serviceWorker.pushManager.subscribe()`
2. 구독 정보를 `KV.PUSH_SUBSCRIPTIONS`에 저장: `user_abc → { endpoint, keys: {p256dh, auth} }`
3. 새 메시지 도착 → ChatRoom DO가 `this.broadcast()` 실행
4. 각 WS가 응답했는지 확인 → 응답 안 한 (오프라인) 유저의 구독을 KV에서 조회
5. **VAPID + RFC 8291 암호화**로 푸시 페이로드 전송
6. `serviceWorker`의 `push` 이벤트 → `showNotification()`

```javascript
// handlers/push.js (간략화)
async function broadcastPush(env, message) {
  const subs = await env.PUSH_SUBSCRIPTIONS.list();
  for (const sub of subs.keys) {
    const data = await env.PUSH_SUBSCRIPTIONS.get(sub.name);
    const vapidHeaders = generateVAPIDHeaders(...);
    const encrypted = encryptPayload(message, ...);
    await fetch(data.endpoint, {
      method: 'POST',
      headers: { 'Authorization': vapidHeaders, ... },
      body: encrypted
    });
  }
}
```

**Rate limit**: 한 메시지당 100명까지만 (KV.list 1,000개 제한 + 비용).

---

## 보안 심화

### Q: HMAC 키가 유출되면 어떻게 되나요?

**A**: 시나리오별로 다릅니다.

| 유출 경로 | 영향 | 대응 |
|-----------|------|------|
| 클라이언트 브라우저 메모리 | 해당 세션의 위조 메시지 가능. 세션 종료 시 자동 폐기 | WS close 시 메모리에서 삭제 |
| `wrangler secret` | **모든 메시지 위조 가능** + admin token 위조 + internal DO 위조 | 즉시 `wrangler secret put`으로 회전. 사용자 전체에게 "재연결" 알림 |
| Storage DB | 영향 없음 (DB에는 시크릿 미저장) | - |
| GitHub 공개 | **즉시 회전 필수** | 절대 커밋 금지 (`.gitignore`에 `.dev.vars`) |

**운영 권장**: HMAC secret을 **용도별로 분리** (현재 1개 → 3개):
- `MESSAGE_SIGNING_KEY` (클라↔DO 메시지)
- `INTERNAL_DO_TOKEN` (Worker↔DO RPC)
- `ADMIN_TOKEN_SECRET` (admin 인증)

개선 과제로 등록되어 있습니다.

---

### Q: CSRF는 어떻게 방어하나요?

**A**: 3가지 메커니즘을 조합합니다.

1. **Custom header 요구** — `fetch()`로만 호출 가능 (`<form>`으로는 불가)
   ```javascript
   // handlers/admin.js
   const authHeader = request.headers.get('Authorization');
   if (!authHeader?.startsWith('Bearer ')) return 401;
   ```

2. **CORS allowlist** — `cors.js`에 등록된 origin만 응답
   ```javascript
   'Access-Control-Allow-Origin': 'https://kalpha.mmv.kr'
   'Access-Control-Allow-Credentials': 'true'
   ```

3. **SameSite 쿠키 미사용** — `localStorage`의 Bearer token이라 쿠키 자동 전송 안 됨 → CSRF 기본 방어

4. **POST 엔드포인트는 `safeJson`으로 body size + JSON 검증**

다만 **`/api/upload` 같은 공개 엔드포인트**는 CSRF 토큰이 없습니다. 다만 이건 부작용 없는 GET/POST 업로드라 큰 문제 없음.

---

### Q: 관리자가 악의적으로 사용자 메시지를 변조하면?

**A**: **변조 가능**. 그리고 그게 의도된 동작입니다.

관리자는 시스템 운영 권한이 있으므로:
- 메시지 수정/삭제 (감사 로그 기록됨)
- 사용자 차단 (Triple-ban)
- 채널 강제 삭제

**방어선**:
- 모든 관리자 액션은 `audit_logs` D1 테이블에 기록 (변조 불가, 시점·IP·상세 보존)
- 보안 이벤트는 `security_events`에 별도 기록
- CSV 내보내기로 외부 백업 가능

**남은 리스크**: 관리자가 DB 자체를 삭제하면? → 이건 "내부자 위협" 영역이라 일반적인 SaaS도 막기 어려움. **책임 분리** (2인 이상 관리자) + **외부 SIEM**으로만 방어 가능.

---

## 성능 심화

### Q: 메시지 1건당 비용은 얼마인가요?

**A**: 2026년 6월 기준 (Cloudflare 가격):

| 항목 | 비용 |
|------|------|
| Worker 요청 1건 | $0.0000005 (5×10⁻⁷) |
| Worker CPU 1ms | $0.000002 |
| DO 요청 1건 | $0.0000005 |
| DO 메모리 1GB-초 | $0.000000154 |
| D1 read 1행 | $0.000001 |
| D1 write 1행 | $0.00001 |
| KV read | $0.0000005 |
| KV write | $0.000005 |

메시지 1건 = WS 메시지 1개 (보내는 측) + N개 (받는 측)
- WS 송수신: Worker + DO 2개 = ~$0.000001
- D1 audit log 1개 write: $0.00001
- **합계: $0.000011/메시지** (받는 1명 기준)
- 받는 10명이면 $0.0001/메시지

월 1,000,000 메시지 → 약 **$10-100** (받는 사람 수에 따라)

---

### Q: bundle.js 136KB는 크지 않나요?

**A**: 비교 대상에 따라 다릅니다.

- React + ReactDOM + React Router만: ~140KB
- Next.js starter: ~80KB
- 우리 chat.bundle.js: 136KB (gzip ~40KB)
- 90년대 AOL 메신저: 4MB+

**개선 방안**:
- ✅ **이미 적용**: esbuild code splitting → 초기 로드는 chat.bundle.js의 핵심만, 나머지는 lazy load
- ❌ **미적용**: 
  - Dynamic import for admin pages (이미 적용됨)
  - Worker-based HTML minification (wrangler 기본)
  - Brotli 압축 (Cloudflare 자동)

**gzip 40KB**는 모바일 3G 환경에서 1초 이내 로드 → 이 정도면 합리적.

---

## 개발 경험 심화

### Q: 1,500줄짜리 ChatRoom.js를 어떻게 리팩토링할 건가요?

**A**: **책임별 분리** 전략:

```
src/durable-objects/ChatRoom/
  ├── index.js          // 진입점 (현재 ChatRoom.js의 thin wrapper)
  ├── state.js          // 메시지/세션/리액션 Map 관리
  ├── connection.js     // WebSocket 연결/해제/heartbeat
  ├── broadcast.js      // fan-out 로직
  ├── messages.js       // 메시지 CRUD (이미 분리됨)
  ├── admin.js          // 관리자 액션 (이미 분리됨)
  ├── announcements.js  // 공지 (이미 분리됨)
  ├── persistence.js    // DO Storage read/write
  ├── cleanup.js        // 12시간 retention, interval
  └── audit.js          // audit log 기록
```

각 파일이 **300줄 이내**로 관리 가능. 단계별 PR로 진행 (위험 ↓).

---

### Q: 테스트 커버리지를 어떻게 늘릴 건가요?

**A**: 우선순위순:

1. **`utils/validate.js` (입력 검증)** — 가장 가치 높음. 모든 WS 메시지가 거치는 관문
2. **`utils/helpers.js` HMAC 함수** — 보안 핵심
3. **`worker.js` 라우터** — 모든 요청의 진입점
4. **`ChatRoom DO`** — Mock DO 런타임 (`@cloudflare/workers-test` 또는 직접 mock)
5. **`handlers/push.js`, `summary.js`, `preview.js`** — API 핸들러

목표: **30% → 70%** (6개월)

---

## 비교 / 시장 분석

### Q: 디스코드, 슬랙과 비교하면 어떤가요?

**A**: 표로 정리:

| 항목 | Anonymous Chat | Discord | Slack |
|------|----------------|---------|-------|
| 가입 | ❌ | ✅ | ✅ |
| 메시지 보관 | **12시간** | 영구 | 영구 |
| 채널 수 | 무제한 | 서버당 500 | 1000 |
| 파일 크기 | 100MB | 25MB (Free) / 50MB (Nitro) | 1GB |
| AI 요약 | ✅ (Workers AI) | ❌ | ✅ (Slack AI, 유료) |
| 푸시 알림 | ✅ | ✅ | ✅ |
| 종단간 암호화 | ❌ | ❌ | ❌ |
| 가격 | **무료** (Cloudflare Free) | 무료 + 유료 | 무료 (최근 사용량 제한) |
| PWA | ✅ | ✅ | ❌ |

**차별점**: "가입 없는 익명 + 자동 소멸"은 이 두 제품엔 없음. 하지만 **검색·영구보관·E2EE** 같은 기능은 부족.

---

### Q: 1인 프로젝트로 이 정도를 만든 동기는?

**A**: **(개인 답변 영역)**

예시:
- "Cloudflare Workers에 매력을 느껴서 실전 프로젝트로 배우고 싶었다"
- "익명 커뮤니티의 가능성을 보고 싶었다"
- "포트폴리오 차별화 (대부분 React + Node.js 조합)"

---

## 트러블슈팅 사례

### Q: 가장 어려웠던 버그 1위는?

**A**: **`sessionSecret` 재사용 버그** (이미 수정됨).

증상: 사용자가 WS를 재연결하면 새 secret이 발급되어야 하는데, **이전 secret으로 서명한 메시지**가 들어옴.

원인: 클라이언트 `wsManager.disconnect()`에서 `this.sessionSecret = null`로 리셋하지 않음. 재연결 시 handshake 응답을 받기 전까지 **이전 secret이 그대로** 사용됨.

해결:
```javascript
disconnect() {
  this.sessionSecret = null; // 명시적 리셋
  this.heartbeat?.stop();
  if (this.ws) this.ws.close();
}
```

이후 모든 테스트 통과.

---

### Q: Cloudflare D1 latency spike를 어떻게 디버깅했나요?

**A**: **Workers Observability** + **Wrangler tail** 활용.

```bash
wrangler tail --format=pretty --status=error
```

로 본 로그:
- `D1_QUERY_FAIL` 이벤트 다수 → `audit_logs` 테이블 SELECT가 5초+
- 인덱스 누락 확인 → `idx_audit_timestamp` 추가
- `await db.prepare(...).all()` 결과를 캐싱 (KV에 1분 TTL)

D1은 **읽기 1000행/쿼리** 제한이 있어서 1,000+ 감사 로그가 누적되면 느려짐. 그래서 **30일 retention** + cleanup job 운영.

---

## 라이선스 / 비즈니스

### Q: 왜 AGPL-3.0을 선택했나요?

**A**: 

1. **"같은 자유" 원칙** — 내가 쓴 코드를 다른 사람이 쓰면, 그 사람도 코드를 공개해야 함 → 오픈소스 정신 유지
2. **상업화 옵션 보존** — COMMERCIAL_LICENSE.md로 사업자는 유료로 AGPL 의무 면제 가능
3. **한국에서는 흔한 라이선스** — 단, **MIT/Apache 2.0**가 더 일반적. AGPL은 좀 "강한" 라이선스

학교 프로젝트 제출용으로는 **MIT**가 더 안전합니다. 라이선스 변경 시 wrangler.toml + LICENSE 파일만 수정하면 됩니다.

---

### Q: 이 프로젝트를 SaaS로 운영한다면?

**A**: **(개인 답변 영역)** — 실용적으로:

1. **Hobby Tier**: 무료 (현재 형태 유지)
2. **Pro Tier**: 
   - 메시지 보관 기간 늘림 (1일/7일/30일)
   - 더 큰 파일 (500MB/1GB)
   - 커스텀 테마
3. **Enterprise**: 
   - 자체 도메인 + HSTS preload
   - SSO 연동
   - SLA 99.9%

수익화 시 기술적으로 필요한 것:
- 결제 시스템 (Stripe + Webhook)
- 사용자 DB (D1 → 외부 Postgres)
- 이메일 인증 (SendGrid / Resend)

---

## 면접 대비 추가 질문

### Q: "왜 Cloudflare 입사하고 싶으세요?" (Cloudflare 관련 질문)

**A**: **(개인 답변 영역)** — 이 프로젝트를 만들면서 느낀 점을 기반으로:

- Workers의 DX가 좋았다 (wrangler CLI, wrangler.toml, 바인딩 추상화)
- Edge computing의 가능성을 실감했다
- Durable Objects는 게임 체인저 (stateful serverless)

---

### Q: 5년 후 이 프로젝트는 어디에 있을까요?

**A**: **(개인 답변 영역)** — 예시:

- 사용자가 늘면 → 자체 도메인 + HSTS preload 정식 등록
- 기술적으로 → E2EE + 모바일 앱
- 사회적으로 → "익명 커뮤니티의 건강한 형태" 사례가 되고 싶다

---

**작성일**: 2026-06-24  
**관련**: [PRESENTATION.md](./PRESENTATION.md)
