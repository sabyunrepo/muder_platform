# Baseline — Phase 19 감사 측정 스냅샷

> 측정 시점: 2026-04-17 (Phase 18.8 observation 중, W1 Foundation).
> 수치만 기록. 해석·판단은 W2 executor 몫.

## 1. 코드 규모 (Go)

- 대상: `apps/server/**/*.go` (테스트·자동생성 포함 전체 카운트)
- Production `.go` (테스트 제외): **199개 파일 / 38,284줄**
- Test `*_test.go`: **117개 파일 / 29,133줄**
- 500줄 초과 프로덕션 파일: **15개**

| 줄 수 | 경로 | 유형 |
|------|------|------|
| 1010 | apps/server/internal/db/social.sql.go | 자동생성(sqlc) — 예외 |
| 813 | apps/server/internal/db/editor.sql.go | 자동생성(sqlc) — 예외 |
| 759 | apps/server/internal/domain/social/service.go | 수동 — 위반 |
| 664 | apps/server/internal/db/creator.sql.go | 자동생성(sqlc) — 예외 |
| 653 | apps/server/internal/domain/editor/media_service.go | 수동 — 위반 |
| 649 | apps/server/internal/ws/hub.go | 수동 — 위반 |
| 642 | apps/server/internal/module/progression/reading.go | 수동 — 위반 |
| 638 | apps/server/internal/module/decision/voting.go | 수동 — 위반 |
| 632 | apps/server/internal/db/themes.sql.go | 자동생성(sqlc) — 예외 |
| 576 | apps/server/internal/domain/editor/handler.go | 수동 — 위반 |
| 558 | apps/server/internal/module/decision/hidden_mission.go | 수동 — 위반 |
| 546 | apps/server/internal/domain/coin/service.go | 수동 — 위반 |
| 531 | apps/server/internal/module/cluedist/trade_clue.go | 수동 — 위반 |
| 512 | apps/server/internal/domain/room/service.go | 수동 — 위반 |
| 506 | apps/server/internal/module/decision/accusation.go | 수동 — 위반 |

수동 작성 파일 500줄 초과: **10개** (sqlc 5개 제외).

## 2. 코드 규모 (Frontend)

- 대상: `apps/web/src/**/*.{ts,tsx}` (테스트·`.d.ts` 제외)
- Production: **331개 파일 / 35,745줄**
- Unit test 파일(`*.test.{ts,tsx}` · `*.spec.{ts,tsx}`): **108개**
- 400줄 초과 프로덕션 파일: **3개**

| 줄 수 | 경로 |
|------|------|
| 423 | apps/web/src/features/game/components/GameChat.tsx |
| 423 | apps/web/src/features/editor/api.ts |
| 415 | apps/web/src/features/social/components/FriendsList.tsx |

## 3. 테스트 현황

- Go `^func Test` (테스트 함수 헤더 카운트): **988개** (파일 117개)
- Frontend 단위/컴포넌트 테스트 파일: **108개**
- E2E Playwright spec 파일: **12개** (`apps/web/e2e/`)

```
editor-flow.spec.ts
game-reconnect.spec.ts
clue-relation-stubbed.spec.ts
game-redaction.spec.ts
clue-relation-live.spec.ts
front-pages.spec.ts
game-session-live.spec.ts
editor-golden-path.spec.ts
clue-relation.spec.ts
game-visual.spec.ts
game-session.spec.ts
game-redaction-stubbed.spec.ts
```

- Codecov 업로드 기준 (Phase 18.7 #58, 2026-04-16 baseline):
  - Go Statements **50.59%**, Functions **54.89%**
  - Frontend 별도 업로드 (상세 수치는 Codecov 대시보드)
- E2E skip 개수: Phase 18.7 시점 **36건 skip** (PR #61 본문 기록). 구체 목록은 test-engineer draft 범위.

## 4. 모듈 인벤토리

- 위치: `apps/server/internal/module/` — `register.go`만 루트, 카테고리 8개.
- 카테고리별 `.go` 파일 수 (테스트·register 제외):

| 카테고리 | 파일 수 |
|---------|--------|
| cluedist | 5 |
| communication | 5 |
| core | 4 |
| crime_scene | 3 |
| decision | 3 |
| exploration | 4 |
| media | 1 |
| progression | 8 |

- 카테고리 합계: **33 파일** (카테고리 8개 × 평균 4.1). module-spec.md 표기 "29 모듈" 대비 파일 수가 더 많음 — 모듈 ≠ 파일(helpers/serializer 포함), W1 module-architect가 모듈:파일 매핑 확정 필요.
- Engine layer (`apps/server/internal/engine/`): BaseModule/Factory/PhaseEngine/Registry/RuleEvaluator/Validator 핵심 파일 존재. 하위 디렉터리는 `testdata/`만.

## 5. QMD 커버리지 (W0 필수 쿼리 6건)

| # | 쿼리 | 컬렉션 | Top 1 결과 경로 | 점수 | 방법 |
|---|------|-------|---------------|------|-----|
| 1 | Phase 18.8 E2E Skip Recovery | mmp-plans | mmp-plans/2026-04-16-e2e-skip-recovery/design.md | 0.77 | vector_search (search miss) |
| 2 | envelope_catalog WS 계약 | mmp-plans | mmp-plans/2026-04-16-e2e-skip-recovery/refs/architecture.md | 0.63 | vector_search (search miss) |
| 3 | ConfigSchema | mmp-plans | mmp-plans/2026-04-10-editor-engine-redesign/refs/phase-c-prs/c7-genre-api.md | 0.77 | search |
| 4 | AppError | mmp-plans | mmp-plans/2026-04-05-error-system.md | 0.82 | search |
| 5 | 파일 크기 | mmp-memory | mmp-memory/project-phase175-progress.md | 0.79 → 0.67 (feedback-file-size-limit.md) | search(top1 progress), vector 보강 |
| 6 | Zustand 3-layer | mmp-plans | mmp-plans/2026-04-05-rebuild/refs/architecture.md | 0.60 | vector_search (search miss) |

- 검색 4/6 → search keyword miss, vector_search 재시도로 6/6 확보. `envelope_catalog`·`Zustand 3-layer`·`Phase 18.8`·`파일 크기`는 정확한 파일명이 아니어서 keyword 매칭 실패 — docs-navigator draft에서 용어 색인 보강 후보.
- 신규 Phase 19 산출물(`2026-04-17-platform-deep-audit/**`)은 QMD 인덱싱 전(작성 직후). W1 종료 후 재인덱싱 필요.

## 6. 미해결 Phase 후속 (memory 기반)

> 조회 방법: QMD `search -c mmp-memory` + 개별 `get`. Phase 18.6 진행 메모리는 QMD 미색인(파일시스템엔 존재 `memory/project_phase186_progress.md`).

| Phase | 후속 / 미정리 항목 | 비고 |
|-------|-------------------|-----|
| 17.5 | 6건: types.go 컨벤션, service 통합 테스트, onConnect debounce, clue 삭제 invalidation, E2E MSW, Kahn O(n²)→pointer | "남은 cleanup 후보" 섹션 |
| 18.0 | 2건: LiveKit/GM 제어판/모바일(후속 phase 후보), CI 인프라 부채(golangci-lint/ESLint 9) | "다음 Phase 후보" 섹션 |
| 18.1 | 18건 이월: Phase 18.2 cleanup(Medium 10건) + Phase 18.3 polish(Low 8건) | "후속 이월" 섹션 |
| 18.3 | 0건 추가(모든 Security/Reliability·Low·CI 해결) | "풀 회귀 pass" |
| 18.4 | 5건: useDebouncedMutation 훅, @jittda/ui 마이그레이션, 409 3-way merge, LocationClueAssignPanel optimistic, feature flag location_clue_assignment_v2 | "후속 과제 (Phase 18.5 후보)" |
| 18.5 | 2건: Phase 18.5 plan 문서 부재(기록성), Phase 18.4 followup 연장 | "미정리 항목" |
| 18.6 | QMD 미색인(파일시스템만 존재) | docs-navigator W2에서 직접 읽기 |
| 18.7 | 6건 user-action + 6건 follow-up(Codecov badge, Renovate 설치, branch protection, 토큰 rotate, harden-runner block, regression guard enforce, deps bump, matrix pnpm/action-setup 일관화, 0% 커버리지 도메인 테스트, routes_editor_*.go 통합 테스트, E2E skip 36 재활성화, game-session-live real-backend) | "User Action" + "Follow-up" 섹션 |

합계 (Phase 17.5 ~ 18.7 완료 Phase 기준): **후속 약 39건** (18.7의 중복 약간 포함). Phase 18.8 self-follow-up은 아직 작성 중이라 미포함.

## 7. 측정 불가 / 유의사항

- **Go 커버리지 per-package %**: Codecov 업로드 전체만 확보. 패키지별 0% 지대는 Phase 18.7 기록상 `coin/creator/sound/voice/infra` → test-engineer draft에서 재측정.
- **E2E skip 실제 목록**: 36 skip count는 확보, 파일·시나리오 매핑은 test-engineer 담당.
- **Flaky 통계**: Phase 18.7 `flaky-report.yml` cron이 월요일 06:00 UTC 시작 — 현재 세션 시점(2026-04-17)까지 full report 미수집 가능.
- **모듈 29개 vs 파일 33개 갭**: module-architect W1 인벤토리에서 정의/검증 필요. baseline은 파일 기준 수치만 고정.
- **`go-chi/v5 v5.2.1` 11 vulns / osv 29 vulns / trivy 3 HIGH**: Phase 18.7 govulncheck·osv·trivy 최초 식별. 현재 patch 미적용(warn-only). security-reviewer 재확인 필요.
- **phase186 QMD 미색인**: re-indexing 대상. 파일 자체는 `memory/project_phase186_progress.md` 존재.
