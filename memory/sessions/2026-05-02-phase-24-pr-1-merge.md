---
topic: "Phase 24 PR-1 Backend Foundation 머지 완료 (config normalizer + ending_branch skeleton)"
phase: "Phase 24 (PR-1 머지, PR-2~6 미진입)"
prs_touched: [PR-1 → #212]
session_date: 2026-05-02
---

# Session Handoff: Phase 24 PR-1 머지 + 5 fix iteration

## Decided

### 머지 완료
- **PR #212** squash-merged (commit `01e55d0` on main). 25 branch commits → 1 main commit.
- TDD 67-step bite-sized + 4-agent round-1+2 + CodeRabbit round-1+2 + thread resolution 모두 통과.

### Spec D-19 ~ D-26 적용 매트릭스
- **D-19** 단일 맵 namespace `modules: {[id]: {enabled, config?}}` — `config_normalizer.go` (modules array → object map / string[] + module_configs → map)
- **D-20** Lazy on read + forward-only write — `themes.go GetTheme`에서 normalize, `service_config.go validateConfigShape`에서 옛 shape 거부
- **D-21** Dead key Union (`clue_placement` 우선) + DEBUG 충돌 로그 + orphan log
- **D-23** `ending_branch` 모듈 skeleton (`engine.Module` + `engine.ConfigSchema` + `engine.PublicStateMarker`)
- **D-24** Score embed in `questions[]` (impact: branch|score + scoreMap)
- **D-26** Per-choice threshold default 0.5 (`MultiVoteThreshold *float64` + nil → 0.5 + range [0,1] 검증)

### Skeleton 카논 결정
- `engine.PublicStateMarker` embed로 시작 (PR-5에서 marker drop + `BuildStateFor` 추가)
- F-sec-2 `playeraware-lint` canon이 BuildStateFor delegate 패턴 차단

### CI Iteration 5 round root-cause fix
1. **gofmt** (`38687f7`, `d0b961c` 등 6번 반복) — 로컬 golangci-lint 미설치 패턴
2. **wsgen 비결정성** (`6568719` ⭐ root) — Go map iteration randomized → `sort.Slice` 추가 (PR-9 잠재 버그, PR-1이 첫 인지자)
3. **playeraware-lint** (`f6624e2` ⭐ root) — premature PlayerAwareModule → PublicStateMarker 전환
4. **Playwright `--with-deps`** (`0a08ff3`) — 3 workflow에서 `fonts-freefont-ttf` deprecated → install-deps best-effort + bare browser install 분리

### CodeRabbit 32+ findings 모두 처리
- Round-1: 23 findings (Major 2 + Minor 21) → 2 commits
- Round-2: 4 findings → 1 commit (`285f37e`)
- Unresolved threads (5건): 4 fix + 1 reasoning (`cfe9476`)
- 2 CHANGES_REQUESTED reviews 명시 dismissal (commit ref + 사유 명시)

## Rejected

- **M3 normalizer → `domain/editor/migration/` 패키지 분리** — scope creep, `// NOTE(PR-future)` 마커만
- **M5 Schema sync.Once 캐싱** — sibling 모듈 일관성 영향, `// TODO(refactor)` 마커
- **M10 VersionMismatch deterministic test (round-1)** → 사실 round-2 fix에서 `preUpdateHook` 패턴으로 처리됨 (재분류)
- **q2 mockup HTML accessibility (`<a>` → `<button>`)** — read-only 브레인스토밍 artifact, 프로덕션 미배포 → reasoning + resolve

## Risks

- **wsgen 비결정성이 PR-9 이전 main에 미친 영향 범위 미확인** — 다른 generated file에 동일 패턴이 있을 수 있음
- **`--with-deps` 분리 패턴이 ARC runner image 변경 시 재현 가능** — runner OS upgrade마다 재발 가능성
- **CodeRabbit dismiss + thread resolve 절차 미카논화** — 다음 PR에서 동일 issue 재등장 risk

## Files

### 머지된 코드 변경 (PR #212, commit `01e55d0` on main)

**Create**
- `apps/server/internal/domain/editor/config_normalizer.go` — D-19/D-20/D-21 normalizer
- `apps/server/internal/domain/editor/config_normalizer_test.go` — 17+ 테이블 드리븐
- `apps/server/internal/module/decision/ending_branch/{module,config,module_test}.go` — D-23/D-24/D-26 skeleton
- `apps/server/internal/module/decision/register_test.go` — registry 4-module subset assertion

**Modify**
- `apps/server/internal/domain/editor/themes.go` — GetTheme normalize call + `apperror.Internal` 일관성
- `apps/server/internal/domain/editor/service_config.go` — `validateConfigShape` (legacy 4종 + null + dead key + empty payload 거부) + `preUpdateHook` test sync
- `apps/server/internal/domain/editor/test_fixture_test.go` — `insertThemeWithRawConfig` helper
- `apps/server/internal/module/decision/register.go` — ending_branch blank import
- `apps/server/cmd/wsgen/payload.go` — `sort.Slice by Name` (deterministic codegen)
- `packages/shared/src/ws/types.generated.ts` — wsgen 결과 갱신
- `.github/workflows/{e2e-stubbed,phase-18.1-real-backend,flaky-report}.yml` — Playwright deps 분리

### 신규 docs/spec/plan
- `docs/superpowers/specs/2026-05-01-phase-24-editor-redesign/` (design.md + 10 refs + 19 mockups)
- `docs/plans/2026-05-01-phase-24-editor-redesign/` (checklist.md + 5 PR-1 task refs)
- `docs/plans/2026-05-01-phase-24-editor-redesign/refs/reviews/PR-1.md` (4-agent review synthesis)

### 미커밋 (carry-over)
- `graphify-out/{GRAPH_REPORT.md,graph.json}` — Phase 종료 시점 fresh rebuild 대상 (현 wrap-session)
- `memory/sessions/2026-05-01-pr-9-merge-coderabbit-fixes.md` — untracked PR-9 wrap (별 세션)

## Remaining

### Phase 24 다음 PR (각 cycle 진입 시 expand)
- **PR-2 Frontend Foundation** (overview만): 아코디언 컴포넌트 + 사이드바 6 항목 + 모듈 페이지 split (D-25 디테일 3) — checklist `refs/pr-2-tasks.md` expand 필요
- PR-3 Entity Pages 캐릭터+장소+단서
- PR-4 Entity Pages 페이즈+결말
- PR-5 Ending Branch Matrix (실제 evaluator + per-choice threshold + scoreMap if/then)
- PR-6 Migration Sweep + Cleanup

### writing-plans 미결 5건 (각 PR cycle 결정)
- 모듈 disable 시 `module_configs` 키 보존 vs 삭제 (PR-2)
- Backlink 인덱스 위치 DB vs derived (PR-3)
- 순환 참조 / Soft delete (PR-3+)
- 이미지 업로드 인프라 Phase 24 scope 여부 (PR-3)
- 마이그 sweep 완료 판정 기준 (PR-6)

### Code 잔존 TODO marker
- M3 `// NOTE(PR-future)` normalizer relocation (`config_normalizer.go`)
- M5 `// TODO(refactor)` Schema sync.Once cache (`ending_branch/module.go`)
- D-26 scoreMap if/then `// TODO(PR-5)` (Schema)
- D-13 respondents oneOf `// TODO(PR-5)` (Schema)

### Phase 24 외 backlog
- #207 + #208 ws-client TS 묶음 PR (P1)
- #200 recordRevoke goroutine cap + WaitGroup (P1)
- #201/#202/#204/#205/#206 follow-up 묶음 (P2)
- #209 godoc 정합 + #210 partial index (P3)
- Phase 19 W4 PR-10 Runtime Payload Validation (L 미착수)

## Next Session Priorities

### P0
없음 (PR-1 머지 완료, 차단 없음)

### P1
1. **#207 + #208 ws-client TS 묶음 PR** — vitest 신규 케이스 + 4-agent + 머지. Effort S, Impact High.
2. **#200 recordRevoke goroutine cap + WaitGroup** — bench `N=1k logouts, peak ≤ 256+2` + shutdown drain. Effort M, Impact High.
3. **docs PR (paths-filter 정책)** — `feedback_4agent_review_before_admin_merge.md`에 docs-only PR paths-filter skip 정책 명문화. Effort S.

### P2
4. **#201/#202/#204/#205/#206 follow-up 묶음** — Effort S 각, Impact Medium.
5. **M3 normalizer 분리** (`domain/editor/migration/`) — Effort M.
6. **M5 Schema sync.Once 일괄 리팩터** (sibling 모듈 4개 동시) — Effort S.

### P3
7. **D-13 / D-26 PR-5 prelude TODO 추적** — PR-5 checklist에 등재.
8. **Phase 19 W4 PR-10 Runtime Payload Validation** (L 미착수, 별도 brainstorm).
9. **Docker Hub auth secret 도입** — `DOCKERHUB_USERNAME` + `DOCKERHUB_TOKEN`.

### 사용자 결정 위임
- **신규 카논 5건 작성 승인** (Step 6에서 결정): wsgen / publicstate skeleton / playwright / coderabbit / gofmt-pre-push

## What we did

Phase 24 PR-1 Backend Foundation을 한 세션에 plan → implementation → review (4-agent + CodeRabbit) → CI 5 round → 머지까지 처리. TDD 67-step bite-sized 위임이 sub-agent에 잘 작동했고, plan drift (engine.Module 시그니처, registry 위치)는 main 컨텍스트가 사전 검증해서 sub-agent 이탈 방지.

CI iteration이 카논화되지 않은 영역에서 root cause 4건 발견:
- **wsgen Go map iteration 비결정성** (PR-9 잠재 버그) — sort 추가
- **Playwright `--with-deps` deprecated package** (ARC runner OS) — install-deps + browser 분리
- **playeraware-lint canon 강제** (premature PlayerAwareModule skeleton 차단) — PublicStateMarker 전환
- **CodeRabbit `required_conversation_resolution` + `CHANGES_REQUESTED` 동시** → review dismiss API + thread resolve 모두 필요

CodeRabbit 32+ findings는 sub-agent 위임으로 처리. round-1 23건은 Major 2 (VersionMismatch deterministic + empty config reject) + Minor 21 (HTML doctype, count, 절대 경로, MD040 등). round-2 4건은 strict json.Decoder + null payload + threshold *float64 default. unresolved thread 5건은 4 fix + 1 reasoning (mockup accessibility는 read-only artifact).
