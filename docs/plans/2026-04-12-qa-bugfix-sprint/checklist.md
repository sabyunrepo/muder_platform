<!-- STATUS: {"phase":"10.0","wave":"W1","pr":"","task":"","state":"not_started"} -->
# Phase 10.0 — Checklist

## W1 (병렬)
### PR-F1: shop/history 크래시 수정
- [ ] T1: CoinTransactions.tsx optional chaining 수정
- [ ] T2: 동일 파일 유사 패턴 검색 및 수정
- [ ] T3: 테스트 확인

### PR-F4: admin 권한 가드
- [ ] T1: RoleRoute 컴포넌트 생성
- [ ] T2: App.tsx admin 라우트 가드 적용
- [ ] T3: creator 라우트 가드 검토

### PR-F5: 프로필 통계 표시
- [ ] T1: 백엔드 /v1/profile created_at 매핑 확인
- [ ] T2: ProfileStats.tsx createdAt 디버깅
- [ ] T3: 플레이 시간 항목 처리

## W2
### PR-F2: ProtectedRoute + editor 라우트
- [ ] T1: ProtectedRoute 로딩 조건 분리
- [ ] T2: /editor 라우트 redirect 처리
- [ ] T3: 회귀 테스트

## W3
### PR-F3: WebSocket 소셜 연결
- [ ] T1: useWsClient accessToken guard 강화
- [ ] T2: 재연결 backoff/최대 시도 확인
- [ ] T3: 서버 로그 검증
