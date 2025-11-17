# 파일공유 기능 배포 가이드

## 🚀 배포 전 준비사항

### 1. R2 버킷 생성

```bash
# Cloudflare 로그인
npx wrangler login

# R2 버킷 생성 (무료)
npx wrangler r2 bucket create anonymous-chat-files
npx wrangler r2 bucket create anonymous-chat-files-dev
```

### 2. 환경 변수 확인

`wrangler.toml`에 이미 설정되어 있습니다:
- MAX_FILE_SIZE_MB = 10
- FILE_RETENTION_HOURS = 12
- MAX_FILES_PER_IP_PER_DAY = 50

### 3. 배포

```bash
# 테스트 (모든 테스트 통과 확인)
npm test

# 배포
npm run deploy
# 또는
npx wrangler deploy
```

## 📊 무료 범위 확인

### Cloudflare R2 무료 플랜
- ✅ 10GB 저장 용량
- ✅ 100만 Class A 작업/월 (업로드)
- ✅ 1000만 Class B 작업/월 (다운로드)
- ✅ Egress 완전 무료 (무제한)

### Cron Trigger 무료 플랜
- ✅ 하루 3번 실행 가능
- ✅ 현재 설정: 12시간마다 (하루 2번)

## 🎯 구현된 기능

### 1. 파일 업로드
- **API**: `POST /api/upload`
- **제한**: 10MB, IP당 하루 50개
- **지원 형식**: 이미지, PDF, 텍스트, ZIP, 동영상
- **보관 기간**: 12시간 후 자동 삭제

### 2. 파일 다운로드
- **API**: `GET /api/file/{fileId}`
- **만료 체크**: 12시간 경과 시 자동 삭제 후 410 반환

### 3. 자동 정리
- **Cron**: 12시간마다 실행 (`0 */12 * * *`)
- **동작**: 만료된 파일 자동 삭제

### 4. Rate Limiting
- IP당 하루 50개 파일 제한
- 업로드 카운트는 24시간 후 자동 리셋

## 🧪 테스트 방법

### 로컬 테스트

```bash
# 개발 서버 시작
npm run dev

# 브라우저에서 테스트
1. http://localhost:8787 접속
2. 파일 첨부 버튼 (📎) 클릭
3. 파일 선택 (10MB 이하)
4. 전송 버튼 클릭
5. 채팅에 다운로드 링크 표시 확인
```

### API 직접 테스트

```bash
# 파일 업로드
curl -X POST http://localhost:8787/api/upload \
  -F "file=@test.jpg"

# 파일 다운로드
curl -O http://localhost:8787/api/file/{fileId}
```

## 📈 모니터링

### 사용량 확인

Cloudflare Dashboard에서:
1. R2 → anonymous-chat-files → Metrics
2. 저장 용량, 작업 수 확인

### 로그 확인

```bash
# 실시간 로그
npx wrangler tail

# Cron 로그 확인
npx wrangler tail --format pretty
```

## ⚠️ 주의사항

### 무료 범위 유지 전략

1. **저장 용량 (10GB)**
   - 12시간 자동 삭제로 평균 2-3GB 유지
   - 평균 파일 크기 2MB 기준: 1500개까지 저장 가능

2. **Class A 작업 (100만/월)**
   - 하루 3.3만 업로드 가능
   - 현재 제한: IP당 하루 50개

3. **Class B 작업 (1000만/월)**
   - 하루 33만 다운로드 가능
   - 충분한 여유

### 비용 발생 조건

```
무료 초과 시:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
저장 > 10GB: $0.015/GB/월
Class A > 100만: $4.50/백만 건
Class B > 1000만: $0.36/백만 건
```

## 🔒 보안 기능

- ✅ 파일 타입 검증
- ✅ 파일 크기 제한 (10MB)
- ✅ Rate Limiting (IP당 50개/일)
- ✅ 자동 만료 (12시간)
- ✅ CORS 헤더 설정
- ✅ IP 추적 (메타데이터)

## 📝 배포 체크리스트

- [ ] R2 버킷 생성 완료
- [ ] Cloudflare 로그인 완료
- [ ] 테스트 통과 확인 (npm test)
- [ ] wrangler.toml 설정 확인
- [ ] 배포 실행 (npm run deploy)
- [ ] 프로덕션에서 파일 업로드 테스트
- [ ] Cron 작동 확인 (12시간 후)
- [ ] 사용량 모니터링 설정

## 💡 트러블슈팅

### R2 버킷이 보이지 않음
```bash
npx wrangler r2 bucket list
```

### Cron이 실행되지 않음
```bash
# Cron 트리거 수동 실행
npx wrangler dev --test-scheduled
```

### 파일 업로드 실패
- 파일 크기 10MB 이하 확인
- 지원되는 파일 형식 확인
- Rate Limit 확인 (하루 50개)

## 📚 참고 문서

- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
