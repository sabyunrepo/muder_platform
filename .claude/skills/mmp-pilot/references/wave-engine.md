# wave-engine — wave 스케줄링 + worktree 프로토콜 (참조)

> mmp-pilot SKILL.md Phase 5에서 참조. 기존 plan-autopilot 엔진을 재사용하며 `.claude/runs/` 경로로 산출물만 리디렉션.

## 엔진 재사용

`$HOME/.claude/skills/plan-autopilot/scripts/` 의 기존 스크립트를 그대로 사용한다(검증된 worktree 로직). 차이는 **산출물 경로만** 교체:

| 기존 (autopilot) | 신규 (pilot) |
|-----------------|--------------|
| `.claude/runs/{run-id}/...` | `.claude/runs/{run-id}/{wave}/{pr}/{task}/` |
| `memory/project_phaseXX_progress.md` 직접 수정 | SUMMARY.md 생성 후 `summary-parse.sh` 경유 |
| autopilot 4 내장 리뷰어 | Layer 2 팀의 `security-reviewer` + `test-engineer` |
| 커맨드 `/plan-autopilot` | `/plan-go` (M2까지는 공존) |

## wave 타입

- **sequential**: 한 PR씩 순차. 간단·안전.
- **parallel**: PR마다 worktree 독립 생성, 병렬 실행, 머지는 순차.

wave mode는 `active-plan.json` 의 `waves[].mode` 로 결정.

## worktree 생성

```
# run-wave.sh create-worktrees <run-id> <wave>
for pr in $(jq -r .waves[].prs $active_plan); do
  base=".claude/worktrees/${phase}-${wave}-${pr}"
  git worktree add -b "pilot/${run_id}/${wave}/${pr}" "$base" main
done
```

- 브랜치명: `pilot/{run-id}/{wave}/{pr}` — 충돌 방지 + run 추적.
- `.claude/worktrees/` 위치는 기존 유지(메인 repo 외부 이동하지 않음).

## task 실행 위임

각 PR의 각 task에 대해:

1. 오케스트레이터가 Layer 2 팀을 worktree CWD로 스폰.
2. 팀은 `.claude/runs/{run-id}/` 대신 **메인 repo의 `.claude/runs/{run-id}/{wave}/{pr}/{task}/`** 에 산출물 작성.
   - worktree 내부에서도 메인 repo 경로로 write 가능(Git은 repo 루트 상대). symlink 아님.
   - 이유: 집계·메트릭을 메인 repo 한 곳에서 관리.
3. 팀은 실제 코드 파일만 worktree 내부에 편집.
4. task 완료 시 `SUMMARY.md` 생성 (hook `summary-require`가 강제).

## 머지

parallel wave 종료 후 PR 순서대로:

```
# run-wave.sh merge <run-id> <wave>
for pr in "${PRS[@]}"; do
  git -C .claude/worktrees/${phase}-${wave}-${pr} commit -am "pilot: ${wave}/${pr}"
  git merge --ff-only "pilot/${run_id}/${wave}/${pr}"
  git worktree remove .claude/worktrees/${phase}-${wave}-${pr}
  git branch -d "pilot/${run_id}/${wave}/${pr}"
done
```

- `--ff-only`: 머지 커밋 방지 + 충돌 시 명시적 에러.
- 실패 시 worktree·브랜치 유지 → 사용자 복구.

## 상태 반영

머지 직후:

```
summary-parse.sh <run-id> <wave>
  → checklist.md의 해당 task 체크
  → progress.md에 한 줄 요약 append
  → METRICS 수집: duration, tests, coverage_delta, blockers
```

## 오류 복구

| 증상 | 조치 |
|------|------|
| worktree add 실패 | 이전 worktree 잔여 확인 → `git worktree prune` |
| ff merge 실패(비선형) | run-wave.sh abort → 사용자에게 수동 rebase 요청 |
| 팀 실행 중 크래시 | 락 heartbeat 끊김 → 60분 후 stale, `--force-unlock` 으로 복구 |
| SUMMARY 누락 | `summary-require` hook이 task 재실행 요청. 3회 실패 시 사용자 개입 |

## M1 단계의 현재 구현 상태

- `run-lock.sh`, `run-wave.sh`, `summary-parse.sh` 3개 스크립트가 Layer 1 진입점.
- **내부 worktree 관리는 기존 autopilot 스크립트 위임** (중복 구현 회피).
- `run-wave.sh` 는 autopilot `plan-wave.sh` 의 래퍼 + `.claude/runs/` 경로 주입.

## 향후(M3 이후)

- autopilot 스크립트 의존을 제거하고 `run-wave.sh` 단독 운영.
- 4 내장 리뷰어 로직을 걷어내고 Layer 2 팀 호출만 남김.
- cutover 시점은 `.claude/scripts/m3-cutover.sh` 실행.
