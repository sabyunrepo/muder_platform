---
pr_id: "PR-8"
pr_title: "/compound-plan + qmd-recall + review-mmp SKILL"
phase: "compound-mmp Wave 3 (Plan stage)"
review_date: 2026-04-28
agents: [security-reviewer, code-reviewer, critic, test-engineer]
models: [opus (general-purpose), sonnet (general-purpose), opus (superpowers:code-reviewer), sonnet (general-purpose)]
fallback_used: true
rounds: 2
---

# Review: PR-8 /compound-plan + qmd-recall + review-mmp SKILL

## Round-1 종합

| Agent | HIGH | MED | LOW | READY |
|-------|------|-----|-----|-------|
| security | 0 | 0 | 3 | YES |
| perf | 0 | 1 | 2 | YES |
| arch (critic) | **2** | 4 | 3 | NO |
| test | **1** | 2 | 3 | NO |

**HIGH 합계: 3건** — admin-merge 차단. in-PR fix 진행 (PR-7 패턴 그대로, fix-loop 카논 준수).

## HIGH-T1 — `--from --from` 파싱 false PASS (test agent)

**위치**: `scripts/compound-plan-dry-run.sh` `--from` 옵션 파싱

**문제**: 두 번째 `--from`이 정규식 `^[a-z0-9-]{1,64}$`를 통과 (`-`, `f`, `r`, `o`, `m`, `-`, `-` 모두 허용 char). `from_previous_phase: "--from"` 정상 출력. fixture 미검증.

**재현**:
```
$ TEMPLATE_PATH=/tmp/x.md OUTPUT_BASE=/tmp DATE=2026-04-28 \
    bash compound-plan-dry-run.sh phase-21 --from --from
{"topic":"phase-21","from_previous_phase":"--from",...}  # false PASS
```

**Fix**: `compound-plan-dry-run.sh` `--from` 처리 직전 `[[ "$FROM_PHASE" == -* ]] && exit 2` 가드 추가. fixture +3 case (`--from --from`, `--from -x`, `--from --bogus`).

**Status**: RESOLVED (commit 후속).

## HIGH-A1 — OMC fallback sister-canon drift (critic)

**위치**: `commands/compound-plan.md:43`

**문제**: `superpowers→OMC` 폴백 방향이 `review-mmp/SKILL.md`(`OMC→general-purpose/superpowers`)와 충돌. 추가로 OMC가 OMC의 폴백이 될 수 없음 (같은 plugin 디렉토리 부재). single source 깨짐.

**Fix**: review-mmp 패턴과 align — superpowers 미가용 시 `general-purpose`로 폴백. OMC 폴백은 review 단계 한정 명시. plan 단계는 OMC 매핑 제거.

**Status**: RESOLVED.

## HIGH-A2 — qmd-recall inject 침묵 fail (critic)

**위치**: `qmd-recall/SKILL.md` anti-pattern + `compound-plan.md` anti-pattern + `plan-draft-template.md` anti-pattern (모두 self-enforce, 객관 검증 0)

**문제**: 메인이 step 1 회상 결과를 step 2 brainstorm prompt에 inject 안 해도 fixture/helper/hook 모두 통과. plan Appendix A.7 핵심 카논 ("회상 inject 안 하면 의미 상실") 위반 가능.

**Fix** (arch 옵션 2 채택 — template = single source 카논):
1. helper output `mandatory_slots: ["qmd-recall-table"]` + step 4 `mandatory_slots` 메타 추가
2. `templates/plan-draft-template.md` "QMD 회상" 섹션을 `<!-- INJECT-RECALL-MANDATORY-START/END -->` 마커로 둘러쌈
3. fixture +3 case (mandatory_slots 필드 존재 + 값 검증 + step 4 inject anchor)

`/compound-wrap` Step 1이 추후 마커 사이 `docid` 토큰 ≥3 검사로 drift 감지 가능 (Phase 21+ piggyback).

**Status**: RESOLVED.

## MED/LOW (carry-over → 다음 PR piggyback)

### Round-1 신규 식별
- **MED-P1** (perf): fixture `SCRIPT_DIR` 2-fork — PR-7 sister fixture와 함께 정정 (PR-9/10 piggyback)
- **MED-T1** (test): `args.query == topic` 검증 → **본 PR fixture 1 case 추가** (RESOLVED in-PR)
- **MED-T2** (test): anti-PR regex `git|gh|pr-create|merge` substring → arch MED-A2와 중복, PR-9 piggyback (deep recursive predicate)
- **MED-A1** (arch): `--from` carry-over inject 검증 부재 → PR-9 piggyback (`previous_checklist_path` 필드 추가)
- **MED-A2** (arch): 자동-PR 금지 fixture grep 우회 → MED-T2와 합쳐 PR-9
- **MED-A3** (arch): Sonnet 4.5 가드 hook 비대칭 (Skill tool은 PreToolUse(Task) 미발동) → PR-9 또는 별도 hook
- **MED-A4** (arch): plan body Wave 3 PR 번호 swap (`PR-7=plan` vs git history `PR-7=review`) → Phase 20 wrap-up 정정

### LOW (carry-over)
- **LOW-S1** (security): TEMPLATE_PATH/OUTPUT_BASE traversal 검증 부재 (defense-in-depth)
- **LOW-S2** (security): fixture `eval "$cmd"` 견고성
- **LOW-S3** (security): `shellcheck -e SC2086` 광범위 suppression
- **LOW-P1** (perf): fixture `TEMPLATE` 변수 dead code
- **LOW-P2** (perf): fixture stderr silencing
- **LOW-T1** (test): `.steps | length == 4` 하드코딩 (PR-7 LOW-T3와 동일)
- **LOW-T2** (test): `--from` 빈 값 케이스
- **LOW-T3** (test): `DATE` 포맷 override 검증 (슬래시 포함 시 path 오염)
- **LOW-A1** (arch): SKILL frontmatter `model:` 필드 부재
- **LOW-A2** (arch): template Wave 수 고정 예시
- **LOW-A3** (arch): `/compound-work PR-1` 사용 예 (현재 미존재)

## Round-2 (영향 영역 재검증, arch + test)

영역: arch (HIGH-A1, HIGH-A2 fix 검증) + test (HIGH-T1 fix + 신규 case 검증). security/perf는 round-1 PASS 영역이라 재spawn 생략 (토큰 절감).

### Round-2 종합

| Agent | 결과 | READY |
|-------|------|-------|
| arch (critic) | HIGH-A1 RESOLVED / HIGH-A2 **PARTIAL** (observability tier) / 신규 MED 1 (M-N1) | YES (조건부) |
| test | HIGH-T1 RESOLVED / HIGH-A2 신규 case RESOLVED / MED-T1 RESOLVED / 신규 0 | YES |

### HIGH-A1 (round-2 검증) — RESOLVED

`commands/compound-plan.md:43` fallback 박스가 `review-mmp/SKILL.md` § OMC fallback 표 패턴과 진정으로 align됨. "OMC 폴백은 review 단계 카논" 명시로 plan에서 OMC 매핑 시도를 카논 수준에서 차단. 단순 권고가 아닌 "단일 source 원칙" 어휘로 강제. drift 해소.

### HIGH-A2 (round-2 검증) — PARTIAL (관측 가능 / 강제 불가)

helper output `mandatory_slots` + step 2/3 `inject` hint + template `<!-- INJECT-RECALL-MANDATORY-START/END -->` 마커 — 모두 **observability anchor**. fixture 3 case는 helper 카논만 검증. 메인 inject 자체는 여전히 self-enforce.

**한계 명시**: `refs/wrap-up-checklist.md`에 "마커 사이 docid ≥3 grep" 카논 부재. wrap-up이 grep 안 하면 마커는 dead anchor. **A2 fix는 observability tier에서 정지**, 강제 tier(wrap-up grep + sister 어휘 통일)는 **PR-9 wrap-up canon 추가에 의존**.

### HIGH-T1 (round-2 검증) — RESOLVED

가드 `[[ "$FROM_PHASE" == -* ]]`가 정규식 검증 직전에 정확히 위치. 우회 시도 전수 차단 (`--from -`, `--from --`, `--from -123`, `--from --from`, `--from -x`, `--from --bogus`). 회귀 없음 (`--from a-b` 정상 통과). `${2:-}` 빈 값도 안전. bash 3.2 glob 호환 실측 확인.

### Round-2 신규 발견

- **M-N1** (sister-canon drift candidate, MED): `mandatory_slots`/`INJECT-RECALL-MANDATORY` 어휘가 plan 단계 단독. review-mmp/wrap-up-mmp/qmd-recall SKILL에 동일 어휘 0회. PR-9에서 wrap-up Step 1에 `grep -c '#[a-f0-9]\{6\}' between markers >= 3` 검증 카논 추가 필요. 본 PR scope 외이나 A2 fix가 "관측만 가능하고 강제 안됨" 상태로 남는 핵심 원인.

### M-N1 후속 작업 (PR-9 필수 piggyback)

A2 fix가 영구 PARTIAL로 남지 않으려면 PR-9에 **반드시** 추가:
1. `refs/wrap-up-checklist.md` Step 1에 `grep -c '#[a-f0-9]\{6\}' docs/plans/<phase>/checklist.md` 카논 추가 (마커 사이 ≥3 docid 검증)
2. `mandatory_slots` 어휘를 review-mmp/wrap-up-mmp helper에도 도입 (sister 통일)
3. `INJECT-RECALL-MANDATORY` 마커가 wrap-up grep의 anchor임을 SKILL/refs 명시

이게 빠지면 A2는 영구 PARTIAL.

## Pass criteria — 충족 ✓

- HIGH 0건 (round-2 양쪽) ✓
- ADMIN-MERGE READY: YES (arch 조건부 + test 무조건) ✓
- fixture 41/41 pass (bash 3.2 + 5.x) ✓ 양쪽 agent 실측 재확인
- A2 fix observability tier 도달 (강제 tier는 PR-9 의존 — 명시 ✓)

**결과**: admin-merge 진행 가능.
