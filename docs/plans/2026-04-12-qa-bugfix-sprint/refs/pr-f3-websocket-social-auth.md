# PR-F3: WebSocket 소셜 연결 타이밍 수정

## 문제
MainLayout 렌더링 시 accessToken 확정 전에 WS 연결 시도 → auth 실패 반복

## 수정
useWsClient에서 accessToken이 유효한 값일 때만 connect
ProtectedRoute 수정(F2)이 근본 원인 해결

## 파일
- `apps/web/src/hooks/useWsClient.ts`
- `apps/web/src/stores/connectionStore.ts`

## Tasks
1. T1: useWsClient — accessToken 존재+유효 시에만 connect
2. T2: 재연결 backoff/최대 시도 횟수 확인
3. T3: 서버 로그에서 WS auth 에러 미발생 확인
