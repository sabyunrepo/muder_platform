# Phase 10.0 — Plan

## PR 목록
| PR | 제목 | Wave | 의존 | scope_globs |
|----|------|------|------|-------------|
| F1 | shop/history 크래시 수정 | W1 | - | `apps/web/src/features/payment/**` |
| F4 | admin 권한 가드 | W1 | - | `apps/web/src/shared/components/**`, `apps/web/src/App.tsx`, `apps/web/src/pages/AdminPage.tsx` |
| F5 | 프로필 통계 표시 수정 | W1 | - | `apps/web/src/features/profile/**`, `apps/server/internal/handler/**`, `apps/server/internal/service/**` |
| F2 | ProtectedRoute + editor 라우트 | W2 | - | `apps/web/src/shared/components/ProtectedRoute.tsx`, `apps/web/src/App.tsx`, `apps/web/src/pages/EditorPage.tsx` |
| F3 | WebSocket 소셜 연결 타이밍 | W3 | F2 | `apps/web/src/stores/connectionStore.ts`, `apps/web/src/hooks/useWsClient.ts`, `apps/web/src/shared/components/MainLayout.tsx` |

## Wave 구성
- **W1**: F1, F4, F5 (병렬)
- **W2**: F2 (W1 완료 후)
- **W3**: F3 (F2 완료 후)

## 상세
- [PR-F1](refs/pr-f1-shop-history-crash.md)
- [PR-F2](refs/pr-f2-protected-route-editor.md)
- [PR-F3](refs/pr-f3-websocket-social-auth.md)
- [PR-F4](refs/pr-f4-admin-guard.md)
- [PR-F5](refs/pr-f5-profile-stats.md)
