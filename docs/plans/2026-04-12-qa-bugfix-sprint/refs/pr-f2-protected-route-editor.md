# PR-F2: ProtectedRoute 로딩 조건 + editor 라우트

## 문제
1. ProtectedRoute에서 `!accessToken` 조건이 토큰 갱신 중 상태와 겹쳐 무한 스피너
2. `/editor` (ID 없음) 접근 시 의미 없는 로딩

## 수정
1. ProtectedRoute: isLoading → 스피너, !isLoading && !isAuthenticated → redirect
2. `/editor` → `/my-themes` redirect 또는 라우트 제거

## 파일
- `apps/web/src/shared/components/ProtectedRoute.tsx`
- `apps/web/src/App.tsx`

## Tasks
1. T1: ProtectedRoute 로딩/인증 조건 분리
2. T2: /editor 라우트 redirect 처리
3. T3: 로그인→로비→각 페이지 회귀 테스트
