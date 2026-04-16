---
name: Phase 18.6 완료 — E2E Recovery
description: e2e-stubbed login timeout 복구. ws-client build fix + theme seed + ThemeCard schema drift. 3 PR, Wave 구조 동적 조정, E2E 4 pass / 11 skip / 0 fail.
type: progress
---

# Phase 18.6 — E2E Recovery 완료

## 범위 (2026-04-16)

- 3 PR 머지 (plan + ws-client + theme schema)
- 원 계획 4 PR 중 PR-2(login helper refactor)는 불필요로 판정하여 스킵
- H7(MaxPlayers contract drift)은 Phase 18.7로 이관
- 테스트: vitest 1017/1017 pass, E2E 4 pass / 11 skipped / 0 fail

## 타임라인

| # | PR | 커밋 | 내용 |
|---|----|------|------|
| 1 | #49 | c789eba | 플랜 스캐폴딩 (design/plan/checklist/findings) |
| 2 | #50 | a0f441c | ws-client workflow build + 진단 artifact (server.log + test-results) |
| 3 | #51 | d440e9b | ThemeSummary ↔ ThemeCard schema 정렬 + theme seed 재활성 + H7 문서화 |

## Findings 요약

1. **H5 (확정, PR #50)**: CI `Build workspace packages` step이 `@mmp/ws-client` 미빌드 → Vite `dep-scan` 실패 → React SPA 부팅 실패 → `/login` 빈 응답 → `getByPlaceholder` 30s timeout
2. **H6 (확정, PR #51)**: server `ThemeSummary` JSON과 `ThemeCard.tsx` 필드 drift. `play_count/rating/difficulty`는 서버에 없는데 `.toLocaleString()` 호출 → ErrorBoundary → 로비 미렌더 → login heading timeout
3. **H7 (이관, Phase 18.7)**: `CreateRoomRequest.MaxPlayers` 서버 필수이나 프론트 미전송 → 400. createRoom 이후 flow 전면 점검 필요

## 의사 결정

- **PR-2 skip**: 원래 login helper 공용화 + placeholder fix였으나 H5가 실제 원인이었으므로 placeholder fix 불필요. 순수 리팩터링 가치 낮음.
- **PR-3 스코프 축소 후 재확장**: 먼저 workflow fix + 진단만(#50), 그 다음 H6 fix + theme seed 재활성(#51)으로 2단계 분리. 각 단계마다 CI evidence 기반 검증.
- **H7은 별도 Phase**: 동일 성격의 drift이지만 RoomPage 페이로드까지 영향. 18.6 "E2E Recovery" 스코프 초과.

## CI 최종 (main 기준)

| Gate | 상태 |
|------|------|
| Go Lint + Test | ✅ |
| TypeScript Lint + Test + Build | ✅ |
| Docker Build Check | ✅ |
| E2E — Stubbed Backend | ✅ (4 pass / 11 skip / 0 fail) |

## 주요 변경 파일

| 경로 | 변경 |
|------|------|
| `.github/workflows/e2e-stubbed.yml` | `@mmp/ws-client` build, `Seed E2E theme` step, server.log + test-results 업로드 |
| `apps/server/db/seed/e2e-themes.sql` | 신규 — published theme + 4 characters (idempotent) |
| `apps/web/src/features/lobby/api.ts` | ThemeSummary 필드 서버 snake_case 정렬, optional 표시 |
| `apps/web/src/features/lobby/components/ThemeCard.tsx` | 서버 이름 사용 + optional 필드 방어 렌더 |
| `apps/web/src/features/lobby/components/CreateRoomModal.tsx` | 필드 이름 치환 |
| `apps/web/src/pages/LobbyPage.tsx` | filter/sort 이름 치환 + null-coalescing |
| `apps/web/src/pages/RoomPage.tsx` | 필드 이름 치환 |

## 후속 작업 (Phase 18.7 후보)

- H7: CreateRoomRequest MaxPlayers + 기타 room/startGame payload 계약 점검
- createRoom → RoomPage → GameStart → GamePage E2E 전체 연쇄 복구
- test selector 영구 개선 (`state: "attached"`) — H7 해결 후 재적용
