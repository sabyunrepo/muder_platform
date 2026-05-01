# PR-1 Tasks Index — Backend Foundation

> 부모 plan: `../checklist.md` · spec: `docs/superpowers/specs/2026-05-01-phase-24-editor-redesign/design.md`
>
> **branch**: `feat/phase-24-pr-1-backend-foundation`
>
> **TDD 강제**: 새 .go 파일 작성 전 *_test.go 먼저 (Go canon `tdd-mmp-go`).
>
> **Sub-agent 위임**: 코드 작성은 sonnet-4-6 sub-agent (`feedback_sonnet_46_default.md`).
>
> **MD 500-line 카논 분할**: 본 index는 task 개요 + 1·12·13. 상세 task는 stage별 ref 분할.

## Files (전체 PR-1)

**Create:**
- `apps/server/internal/domain/editor/config_normalizer.go`
- `apps/server/internal/domain/editor/config_normalizer_test.go`
- `apps/server/internal/module/decision/ending_branch/module.go`
- `apps/server/internal/module/decision/ending_branch/config.go`
- `apps/server/internal/module/decision/ending_branch/module_test.go`

**Modify:**
- `apps/server/internal/domain/editor/themes.go` (read path → normalizer)
- `apps/server/internal/domain/editor/service_config.go` (write validate new shape)
- `apps/server/internal/module/decision/register.go` (ending_branch 등록)

## Task 분포 (4 stage)

| Task | 영역 | 파일 |
|---|---|---|
| **Task 1** | Worktree + branch 분기 | (이 파일) |
| **Task 2** | Normalizer skeleton (no-op identity) | `pr-1-normalizer-base.md` §A |
| **Task 3** | modules array → object map (D-19 backend preset) | `pr-1-normalizer-base.md` §B |
| **Task 4** | modules string[] + module_configs → map (D-19 frontend) | `pr-1-normalizer-base.md` §C |
| **Task 5** | clue_placement → locationClueConfig.clueIds (D-20) | `pr-1-normalizer-clues.md` §A |
| **Task 6** | dead key Union 병합 + DEBUG 충돌 로그 (D-21) | `pr-1-normalizer-clues.md` §B |
| **Task 7** | character_clues → starting_clue 모듈 (D-20) | `pr-1-normalizer-clues.md` §C |
| **Task 8** | themes.go GetByID/List read path 적용 (D-20) | `pr-1-integration.md` §A |
| **Task 9** | service_config.go write validate (forward-only) | `pr-1-integration.md` §B |
| **Task 10** | ending_branch 모듈 skeleton (D-23/D-24) | `pr-1-ending-branch.md` §A |
| **Task 11** | Registry 등록 (boot panic 게이트) | `pr-1-ending-branch.md` §B |
| **Task 12** | Coverage gate + 회귀 + lint | (이 파일) |
| **Task 13** | 4-agent 리뷰 + PR 생성 | (이 파일) |

총 **67 step (2-5분/step)**, 추정 5일.

---

## Task 1 — Worktree + branch 분기

- [ ] **Step 1**: `superpowers:using-git-worktrees` 스킬 호출 → 새 worktree에서 작업

```bash
git worktree add ../mmp-pr-1-backend-foundation -b feat/phase-24-pr-1-backend-foundation main
cd ../mmp-pr-1-backend-foundation
```

- [ ] **Step 2**: spec 브랜치 (`docs/phase-24-editor-redesign-spec`) commits cherry-pick

```bash
git cherry-pick bfcf8e0 ec537f5
```

Expected: spec + round-2 결정이 새 branch에 존재 → implementation 참조 가능.

- [ ] **Step 3**: Empty marker commit (TDD 시작 신호)

```bash
git commit --allow-empty -m "chore(phase-24-pr-1): start backend foundation TDD"
```

---

## Task 12 — Coverage gate + 회귀 + lint

- [ ] **Step 60**: 신규 모듈 커버리지 측정

```bash
go test ./apps/server/internal/domain/editor/ \
        ./apps/server/internal/module/decision/ending_branch/ \
        -cover -v
```

Expected:
- `editor.NormalizeConfigJSON` 등: **100%** (table-driven 7+ 케이스)
- `ending_branch.Module`: **80%+** (Schema/Name/Init/ApplyConfig 4 메서드)

- [ ] **Step 61**: 전체 백엔드 회귀 확인

```bash
cd apps/server && go test ./... 2>&1 | tail -30
```

Expected: 모두 PASS, 기존 기능 회귀 0.

- [ ] **Step 62**: lint/vet

```bash
cd apps/server && go vet ./...
cd apps/server && golangci-lint run ./...
```

Expected: 0 issue.

---

## Task 13 — 4-agent 리뷰 + PR 생성

- [ ] **Step 63**: `compound-mmp:compound-review` 실행 (security/perf/arch/test 4 axis 병렬)

```bash
/compound-review
```

Expected: HIGH 발견 0건, MED 이하만. HIGH 있으면 fix-loop (자동 머지 금지 카논).

- [ ] **Step 64**: graphify refresh skip 확인 (Phase 종료 시점만 — `project_graphify_refresh_policy.md`)

- [ ] **Step 65**: PR description = goal + 변경 + 검증 + D-19/D-20/D-21/D-23/D-24 매핑 명시 후 PR 생성

```bash
gh pr create --title "feat(phase-24): PR-1 backend foundation — config normalizer + ending_branch skeleton" --body "$(cat <<'EOF'
## Summary

Phase 24 PR-1 — backend foundation. spec round-2 결정 D-19/D-20/D-21/D-23/D-24 부분 적용.

## 변경

- `config_normalizer.go` 신설 (D-19 namespace 단일 맵 + D-20 lazy on read + D-21 dead key union)
- `themes.go` GetByID/List 등 read path → normalizer 적용
- `service_config.go` UpdateConfigJson → 옛 shape write 거부 (forward-only)
- `module/decision/ending_branch/` 신설 — Module + ConfigSchema 인터페이스 (Schema only, matrix eval은 PR-5)
- `module/decision/register.go` ending_branch 등록 (registry boot panic 게이트)

## 검증

- normalizer 7+ 테이블 드리븐 시나리오 (no-op, modules array→map, modules string[]+configs, clue_placement, dead key union priority, character_clues, conflict log)
- ending_branch Schema validate (questions impact branch|score, matrix priority+conditions+ending, multiVoteThreshold default 0.5)
- 전체 backend test PASS, 회귀 0
- 4-agent 리뷰 통과

## 결정 매핑

| Spec 결정 | 적용 |
|---|---|
| D-19 단일 맵 namespace | normalizer + write validator |
| D-20 Lazy on read | themes.go read path |
| D-21 dead key Union (placement 우선) | normalizer + DEBUG 충돌 로그 |
| D-23 ending_branch 모듈 | skeleton + Schema |
| D-24 score embed in questions | Schema impact enum + scoreMap |
| D-26 per-choice threshold | Schema default 0.5 (eval은 PR-5) |

다음 PR: PR-2 frontend foundation (아코디언 컴포넌트 + 사이드바 6 항목 + 모듈 페이지 split).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 66**: PR URL 사용자에 전달, 4-agent 리뷰 후 머지 결정 사용자 위임

- [ ] **Step 67**: PR 머지 후 worktree 정리 + `compound-mmp:compound-wrap` 7단계 실행 + PR-2 진입 준비 (`refs/pr-2-tasks.md` expand)

```bash
cd .
git worktree remove ../mmp-pr-1-backend-foundation
git pull origin main
```
