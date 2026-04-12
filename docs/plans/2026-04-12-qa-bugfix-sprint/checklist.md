<!-- STATUS: {"phase":"10.0","wave":"done","pr":"","task":"","state":"complete"} -->
# Phase 10.0 — Checklist

## W1 (병렬) ✅
### PR-F1: shop/history 크래시 수정 ✅
- [x] T1: CoinTransactions.tsx optional chaining 수정
- [x] T2: 동일 파일 유사 패턴 검색 및 수정 (PaymentHistory.tsx:65)
- [x] T3: 테스트 확인 + regression test 추가 (4건)

### PR-F4: admin 권한 가드 ✅
- [x] T1: RoleRoute 컴포넌트 생성
- [x] T2: App.tsx admin 라우트 가드 적용
- [x] T3: creator 라우트 가드 검토 + 적용 (creator+admin)
- [x] Review fix: RoleRoute 단위 테스트 4건 추가

### PR-F5: 프로필 통계 표시 ✅
- [x] T1: 백엔드 /v1/profile created_at 매핑 확인 + 추가
- [x] T2: ProfileStats.tsx createdAt 디버깅 + zero-value 수정
- [x] T3: 플레이 시간 항목 처리 → "(준비 중)"

## W2 ✅
### PR-F2: ProtectedRoute + editor 라우트 ✅
- [x] T1: ProtectedRoute 로딩 조건 분리 (isLoading/isAuthenticated)
- [x] T2: /editor 라우트 → /my-themes redirect
- [x] T3: 회귀 테스트 13/13 통과

## W3 ✅
### PR-F3: WebSocket 소셜 연결 ✅
- [x] T1: useWsClient accessToken guard 확인 (이미 구현됨, 코멘트 보강)
- [x] T2: 재연결 backoff/최대 시도 확인 (maxAttempts:5 + exponential backoff 기존재)
- [x] T3: tsc 통과, 기능 검증 완료
