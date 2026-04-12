# Phase 10.0 — QA Bugfix Sprint

> QA 전체 페이지 점검에서 발견된 5개 이슈 수정

## 개요
Playwright QA로 18개 페이지 점검 결과, 크리티컬 2건 + 주의 3건 발견.
프론트엔드 위주 버그픽스 + 백엔드 API 매핑 1건.

## 이슈 목록
| ID | 이슈 | 심각도 | 범위 |
|----|------|--------|------|
| F1 | `/shop/history` CoinTransactions 크래시 | 크리티컬 | FE |
| F2 | `/editor` 무한 로딩 (ID 없이 접근) | 크리티컬 | FE |
| F3 | WebSocket 소셜 연결 auth 실패 | 중요 | FE |
| F4 | `/admin` 권한 가드 없음 | 중요 | FE |
| F5 | 프로필 통계 전부 "-" 표시 | 낮음 | FE+BE |

## 상세 문서
- [scope-and-decisions.md](refs/scope-and-decisions.md) — 스코프 경계, 설계 결정
- [execution-model.md](refs/execution-model.md) — Wave DAG, PR 의존성
- [pr-f1-shop-history-crash.md](refs/pr-f1-shop-history-crash.md)
- [pr-f2-protected-route-editor.md](refs/pr-f2-protected-route-editor.md)
- [pr-f3-websocket-social-auth.md](refs/pr-f3-websocket-social-auth.md)
- [pr-f4-admin-guard.md](refs/pr-f4-admin-guard.md)
- [pr-f5-profile-stats.md](refs/pr-f5-profile-stats.md)
