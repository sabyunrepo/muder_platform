---
name: Phase 10.0 — QA Bugfix Sprint 완료
description: Playwright QA에서 발견된 5개 이슈 수정 완료
type: project
originSessionId: 4127eec9-9797-46ce-8953-06d681f348b1
---
# Phase 10.0 — QA Bugfix Sprint 완료

**기간**: 2026-04-12  
**최종 커밋**: dfbc340  
**상태**: ✅ 완료 (15/15 tasks, force_finished: false)

## 수정된 이슈

| PR | 이슈 | 심각도 | 결과 |
|----|------|--------|------|
| F1 | `/shop/history` CoinTransactions optional chaining 크래시 | 크리티컬 | ✅ |
| F2 | `/editor` 무한 로딩 (ProtectedRoute isLoading/isAuthenticated 조건) | 크리티컬 | ✅ |
| F3 | WebSocket 소셜 auth 실패 (accessToken guard + backoff) | 중요 | ✅ |
| F4 | `/admin` 권한 가드 없음 → RoleRoute 컴포넌트 생성 | 중요 | ✅ |
| F5 | 프로필 통계 "-" 표시 (created_at 매핑 + 플레이시간 "(준비 중)") | 낮음 | ✅ |

## Wave 구성

- **W1** (병렬): F1 + F4 + F5
- **W2** (순차): F2
- **W3** (순차): F3

## 주요 변경 파일

- `apps/web/src/features/payment/CoinTransactions.tsx` — optional chaining 수정
- `apps/web/src/features/payment/PaymentHistory.tsx` — 동일 패턴 수정
- `apps/web/src/shared/components/RoleRoute.tsx` — 신규 생성 (admin/creator 권한 가드)
- `apps/web/src/App.tsx` — admin/creator 라우트 RoleRoute 적용
- `apps/web/src/features/profile/ProfileStats.tsx` — createdAt zero-value 수정
- `apps/server/internal/handler/` — created_at 매핑 추가
- `apps/web/src/shared/components/ProtectedRoute.tsx` — 로딩 조건 분리
- `apps/web/src/pages/EditorPage.tsx` — /editor → /my-themes redirect
- `apps/web/src/stores/connectionStore.ts` — accessToken guard 코멘트 보강
- `apps/web/src/hooks/useWsClient.ts` — 재연결 backoff 확인

## 테스트 결과

- RoleRoute 단위 테스트 4건 추가
- CoinTransactions regression test 4건 추가
- ProtectedRoute 회귀 테스트 13/13 통과
- tsc 통과
