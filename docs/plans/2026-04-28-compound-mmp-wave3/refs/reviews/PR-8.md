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

상태: **commit + push 후 spawn 예정**.

영역: arch (HIGH-A1, HIGH-A2 fix 검증) + test (HIGH-T1 fix + 신규 case 검증). security/perf는 round-1 PASS 영역이라 재spawn 생략 (토큰 절감).

## Pass criteria

- HIGH 0건 (round-2)
- ADMIN-MERGE READY: YES (양쪽 agent)
- fixture 41/41 pass (bash 3.2 + 5.x) ✓ 로컬 확인 완료
