---
name: mmp-pilot
description: MMP v3 통합 파일럿 오케스트레이터. plan-* 체계와 mmp 하네스를 단일 입구 `/plan-go`로 합친 상위 스킬. wave 자동 실행, 단일 task, 재개, 중단, 상태 조회 모두 이 스킬 경유. "plan 실행", "다음 wave 돌려", "이 task만 돌려", "재개", "파일럿 실행", "mmp-pilot" 등 요청 시 트리거. 단순 질문/조회는 제외.
---

# mmp-pilot — 통합 오케스트레이터 (Layer 1)

plan-autopilot(시간 축)과 mmp 하네스(전문성 축)를 계층 분리하여 병합한 단일 실행 엔진.

## Layer 구조

- **Layer 1 (이 스킬)**: wave 루프 · worktree 수명 · 락 관리 · scope enforcement · SUMMARY 파싱 · 메트릭 수집
- **Layer 2 (동적 팀)**: `docs-navigator` / `go-backend-engineer` / `react-frontend-engineer` / `module-architect` / `test-engineer` / `security-reviewer` — task 성격에 맞게 2~6명 편성
- **Layer 3 (공용 스킬)**: `mmp-qmd-first` / `mmp-200-line-rule` / `mmp-module-factory` / `mmp-test-strategy` / `mmp-security-rfc9457`

## Phase 0: 컨텍스트 확인 (필수)

1. `.claude/run-lock.json` 상태 확인 (`.claude/scripts/run-lock.sh check`).
   - 점유 중이고 heartbeat < 60min → 차단, 사용자에게 보고.
   - stale → `--force-unlock` 없으면 차단.
2. `.claude/active-plan.json` 로드 — schema_version 1/2 자동 감지.
   - v1 → 메모리상에서 v2 뷰로 변환(runs 필드 없으면 초기화).
3. `current_run_id` 없으면 신규 생성 `r-YYYYMMDD-HHMMSS-<3byte>`.
4. scope 배열 숙지 — Layer 2 팀원 호출 시 프롬프트에 scope 전달(서브세션 hook 보강용).
5. 실행 모드 결정:
   - `_workspace/` 존재 → 마이그레이션 대상. 무시하고 `runs/` 사용.
   - `runs/{run-id}/` 존재 + 재개 → 부분 재실행, 미완료 task만.
   - 신규 → 초기 실행.

## Phase 1: manifest 생성

입력 플래그에 따라 `runs/{run-id}/manifest.json` 생성. 필드:

```json
{
  "run_id": "...",
  "mode": "wave|single|ab|resume",
  "waves": ["W0","W1"],
  "tasks_override": null,
  "started_at": "...",
  "flags": {"dry_run": false, "ab": null, "team_max": 6}
}
```

`--dry-run`은 여기서 출력하고 종료.

## Phase 2: 팀 편성 (Layer 2 호출)

task 성격 키워드 매칭으로 팀 결정 (plan-go.md 편성 규칙표 참조). 편성 방식:

- 팀원 2명 이하 → **서브에이전트** (`Agent` 도구, `model: "opus"`, 독립은 `run_in_background: true`)
- 팀원 3명 이상 → **에이전트 팀** (`TeamCreate` + `TaskCreate` + `SendMessage`)
- Phase별로 다르면 하이브리드 (Phase 상단에 실행 모드 명시)

**scope 전달 필수**: 팀원 프롬프트 첫 줄에 `"scope: [.., ..]. 이 외 경로 편집 시 hook이 BLOCK 함"` 명시. 서브세션 hook 상속 불확실성 완화.

## Phase 3: 데이터 전달

산출물 경로: `.claude/runs/{run-id}/{wave}/{pr}/{task}/NN_agent_artifact.md`.
팀 통신은 `SendMessage`(소규모) + 파일(대용량) 병용. 최종 산출물만 실제 repo 경로에 커밋.

각 task 종료 시 **SUMMARY.md 생성 강제** (frontmatter 필드: `01-state-schema.md` §7 참조).

## Phase 4: SUMMARY 파싱 + 상태 반영

`.claude/scripts/summary-parse.sh <run-id> <wave>` 호출:
- checklist.md 항목 체크 (`- [ ] Task 1 — M-7` → `- [x]`)
- `memory/project_phase{N}_progress.md`에 요약 append
- blockers 있으면 최상단에 ⚠️ 마커

실패·blocker 시 wave 일시정지, 사용자 확인.

## Phase 5: worktree 머지 + heartbeat

- parallel wave는 PR마다 fast-forward merge (`.claude/scripts/run-wave.sh merge`).
- 60초마다 `run-lock.sh heartbeat`로 타임스탬프 갱신.

## Phase 6: 종료

- FINAL_SUMMARY.md 생성 (wave별 SUMMARY 집계 + 메트릭 총계)
- `memory/mmp-pilot-metrics.jsonl` append
- 락 release
- 사용자에게 1문 피드백 요청 (품질/개선점)

## 실행 모드별 흐름

### wave 자동
Phase 0→1→(wave마다 2→3→4→5)→6

### 단일 task (`--task`)
Phase 0→1(manifest에 task 1개)→2→3→4(해당 항목만)→6
worktree 없음, in-place 편집. scope hook이 방어.

### 재개 (`--resume`)
Phase 0에서 current_run_id 이어받음 → manifest의 미완료 task부터 Phase 2 재진입.

### A/B (`--ab`)
**M4에서 활성**. 현재는 "M4 이후 지원" 메시지 후 종료. 상세: `references/ab-runner.md`.

## 에러 핸들링

- 빌드/테스트 실패 → 담당자 1회 재시도, 재실패 시 Layer 1 에스컬레이트.
- security-reviewer Blocker → 머지 중단, 담당자에게 수정 task 재할당.
- 커버리지 하락 → test-engineer에 누락 테스트 task 생성.
- scope violation → hook BLOCK + Phase 2 재호출(scope 재강조).
- 파일/함수 크기 한도 초과 (Go 500/80, TS 400/60, TSX 컴포넌트 150, MD 200) → size-guard hook이 재작성 요청.

## 팀 크기 가이드 (§5-3)

| task 규모 | 팀원 | task/팀원 |
|-----------|------|-----------|
| 소 (5-10) | 2-3 | 3-5 |
| 중 (10-20) | 3-5 | 4-6 |
| 대 (20+) | 5-6 | 4-5 |

## 후속 작업 대응

- "이전 task 다시" → Phase 0에서 runs/ 존재 확인 → 부분 재실행, 이전 SUMMARY를 입력으로 개선 요청.
- "같은 방식 다른 핸들러에도" → 기존 팀 재사용, manifest task 목록만 확장.

## 하위 참조

- wave 엔진·worktree 프로토콜: `references/wave-engine.md`
- A/B 러너 + 자기개선 루프: `references/ab-runner.md` (M4 활성)

## 테스트 시나리오

**정상**: `/plan-go` → W0 PR-0 task 1건 → security 팀 4인 편성 → SUMMARY 생성 → checklist 체크 → 머지.
**에러**: security Blocker 보고 → go-backend에 수정 task 재할당 → test 통과 후 재머지.
**재개**: `/plan-stop` → partial SUMMARY → `/plan-go --resume` → 남은 task 이어감, 중복 실행 없음.
