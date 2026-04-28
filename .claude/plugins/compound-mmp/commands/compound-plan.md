---
description: 새 phase·feature 계획 단계 진입점. qmd-recall(mmp-plans 5건) → superpowers:brainstorming → superpowers:writing-plans 순차 호출 후 docs/plans/<date>-<topic>/checklist.md 초안 생성. 자동 PR 생성/자동 진행 X (사용자 승인 카논).
allowed-tools: Bash, Read, Write, Skill, Task, Glob
argument-hint: "<topic> [--from <previous-phase>]   예: /compound-plan phase-21-runtime-bugfix --from phase-20-clue-editor"
---

# /compound-plan

새 phase 또는 큰 feature 계획 작성 시 진입. **brainstorm + writing-plans + QMD 회상**을 순차 호출해 `docs/plans/<YYYY-MM-DD>-<topic>/checklist.md` 초안을 생성한다. 산출은 **초안만** — 자동 PR 생성·자동 다음 단계 진입 모두 금지 (anti-pattern).

> **카논 single source**: plan § "/compound-plan 사양" + Appendix A.7 (`qmd-recall`) + `templates/plan-draft-template.md`.

## 인자

- `<topic>` (필수) — `^[a-z0-9-]{1,64}$` 정규식 매칭. 화이트리스트 외 거부 (helper exit 2). 예: `phase-21-runtime-bugfix`, `auth-redesign`.
- `--from <previous-phase>` (선택) — 이전 phase의 carry-over (미해소 MED/LOW, Out of Scope 등) 자동 inject 대상. 동일 정규식 적용.
- `--dry-run` (선택) — 단계 시퀀스 JSON만 stdout 출력. 실제 skill 활성화·파일 생성 없음.

## 실행 시퀀스 (메인 컨텍스트)

### 1. dry-run helper 호출 → 단계 시퀀스 JSON

```bash
TEMPLATE_PATH=.claude/plugins/compound-mmp/templates/plan-draft-template.md \
  bash .claude/plugins/compound-mmp/scripts/compound-plan-dry-run.sh "$TOPIC" ${FROM:+--from "$FROM"}
```

stdout: `{"topic":"...","from_previous_phase":...,"steps":[...]}` (jq parsable).

`--dry-run` 모드는 여기서 종료. 정상 모드는 helper.steps[]를 따라 순차 진행.

### 2. helper.steps[]를 순차 실행 (imperative iterate)

helper가 반환한 `steps[]`를 1→4 순서로 실행. 4 step 하드코딩 금지 — pipeline.json/template 진화 시 자동 반영. 각 step의 `skill`/`action` 필드를 보고 분기:

| step | 필드 | 메인 컨텍스트 행동 |
|------|------|-------------------|
| 1 | `skill: "compound-mmp:qmd-recall"` | `Skill` tool 호출. args = `{collection: "mmp-plans", query: <topic>, k: 5}`. 결과(유사 phase 5건 인용 블록)를 다음 step의 brainstorm 컨텍스트로 메모리 보존. |
| 2 | `skill: "superpowers:brainstorming"` | `Skill` tool 호출. step 1 회상 결과를 inject. Out: 사용자 의도·요구·제약 명시화. |
| 3 | `skill: "superpowers:writing-plans"` | `Skill` tool 호출. step 2 산출 + (옵션) `from_previous_phase` carry-over inject. Out: Wave/PR 분해, 검증 시뮬레이션. |
| 4 | `action: "write_file"` | `Write` tool 호출. `path` = helper 토큰 치환 결과 (`docs/plans/<date>-<topic>/checklist.md`), `template` = helper.steps[3].template. step 1~3 산출을 template 슬롯에 inject. |

> **OMC fallback** (helper.steps[1~3]의 skill이 미가용 시): `superpowers:brainstorming` → `oh-my-claudecode:analyst` (요구 gap), `superpowers:writing-plans` → `oh-my-claudecode:critic` (pre-mortem). 본 repo는 superpowers 우선 카논 — fallback은 user-home에 superpowers plugin이 없는 신규 환경에서만 활성.

### 3. 사용자 승인 게이트 (CRITICAL — 자동 진행 금지)

step 4 완료 후 **반드시 멈춘다**. 메인 컨텍스트는 다음 형식으로 사용자에게 보고:

```
초안 생성 완료: docs/plans/<date>-<topic>/checklist.md
다음 작업 후보:
  - /compound-work PR-1   (TDD 구현 시작)
  - 초안 직접 수정          (Wave/PR 분해 조정)
  - /compound-cycle        (현재 phase 상태 확인)
```

자동으로 `/compound-work`나 다른 단계로 진입하지 않는다. anti-pattern (`refs/anti-patterns.md` § "자동 다음 단계 진입").

## Anti-pattern (위반 시 helper 또는 fixture가 차단)

- ❌ topic 화이트리스트 우회 (shell injection, 공백, 대문자, 길이 초과) — helper exit 2
- ❌ TEMPLATE_PATH 미설정 또는 파일 부재 — helper exit 3/4
- ❌ steps[] 하드코딩 — pipeline 진화 시 drift, helper.steps[] iterate 강제
- ❌ 자동 PR 생성 step 추가 — fixture가 git/gh/pr-create/merge 토큰 검출 시 fail
- ❌ step 4 완료 직후 `/compound-work` 자동 호출 — 사용자 승인 게이트 우회
- ❌ qmd-recall 결과를 brainstorm에 inject 안 하고 별도 출력 — 회상의 의미 상실 (A.7)

## 사용 예

```
사용자: /compound-plan phase-21-runtime-bugfix --from phase-20-clue-editor
메인:
  1. helper 실행 → JSON {steps: [qmd-recall, brainstorming, writing-plans, write_file]}
  2. Skill compound-mmp:qmd-recall (mmp-plans 5건)
  3. Skill superpowers:brainstorming (회상 inject)
  4. Skill superpowers:writing-plans (carry-over inject)
  5. Write docs/plans/2026-04-28-phase-21-runtime-bugfix/checklist.md
  6. 사용자 승인 대기
사용자: 초안 OK, /compound-work PR-1 진행
```

## 검증 (test-compound-plan-dry-run.sh, 34 case)

helper 직접 실행 → JSON contract 검증. 입력 화이트리스트 (8 case) / 정상 입력 (4 case) / JSON 구조 (5 case) / 단계 매핑 (7 case) / 토큰 치환 (6 case) / `--from` 옵션 (2 case) / 자동 PR 금지 (1 case) / 환경 변수 (2 case).

CI: `.github/workflows/ci-hooks.yml`이 ubuntu+macOS에서 fixture 실행 (PR-7 PR-8 공통 카논).
