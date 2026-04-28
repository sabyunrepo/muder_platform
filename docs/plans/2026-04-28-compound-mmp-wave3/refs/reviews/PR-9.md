---
pr_id: "PR-9"
pr_title: "/compound-work + mandatory_slots sister 카논 통일 (M-N1)"
phase: "compound-mmp Wave 4 (Work stage)"
review_date: 2026-04-28
agents: [security-reviewer, code-reviewer, critic, test-engineer]
models: [opus (general-purpose), sonnet (general-purpose), opus (superpowers:code-reviewer), sonnet (general-purpose)]
fallback_used: true
rounds: 2
---

# Review: PR-9 /compound-work + mandatory_slots sister 카논 통일

## Round-1 종합

| Agent | HIGH | MED | LOW | READY |
|-------|------|-----|-----|-------|
| security | 0 | 1 (S1: PHASE_SLUG 화이트리스트) | 2 | YES |
| perf | 0 | 1 (P1: basename fork) | 2 | YES |
| arch (critic) | **1 (A1: branch sister drift)** | 4 | 3 | NO |
| test | 0 | 1 (D1: branch contains 부분 매칭) | 4 | YES |

**HIGH 1건** — admin-merge 차단. 핵심 통찰: HIGH-A1 + MED-S1 + MED-P1 + MED-D1 모두 helper L75-77 영역. 통합 fix.

## HIGH-A1 — branch 명명 sister 카논 drift (critic)

**위치**: `scripts/compound-work-dry-run.sh:75-77`

**문제**: helper 출력 `feat/${PHASE_SLUG}/${PR_ID}-${SCOPE}` (예: `feat/2026-04-28-phase-21/PR-1-go`). 그러나 기존 카논 (memory/sessions 7건 + 본 PR 자신 `feat/compound-mmp/PR-9-work-command`)은 `feat/compound-mmp/PR-N-<slug>` 패턴. **helper가 자기 자신 브랜치를 못 만든다 (self-contradiction)**.

**Fix** (env override + ACTIVE_PHASE basename fallback):
```bash
PROJECT_SLUG="${PROJECT_SLUG:-${ACTIVE_PHASE##*/}}"
if [[ ! "$PROJECT_SLUG" =~ ^[a-z0-9_.-]+$ ]]; then
  exit 2
fi
BRANCH="feat/${PROJECT_SLUG}/${PR_ID}-${SCOPE}"
```

`PROJECT_SLUG` env 우선, 없으면 ACTIVE_PHASE basename. 화이트리스트 적용 (sister 카논 대칭).

**Status**: RESOLVED.

## MED-S1 — PHASE_SLUG 화이트리스트 부재 (security, sister 카논 비대칭)

helper L76 `basename "$ACTIVE_PHASE"`로 추출 후 정규식 검증 없이 `BRANCH`에 잠입. shell metachar (`;`, `$()`) 통과 가능. PR-7/PR-8 sister는 모두 화이트리스트.

**Fix**: HIGH-A1과 통합 — `PROJECT_SLUG` 화이트리스트 `^[a-z0-9_.-]+$`. **Status**: RESOLVED.

## MED-P1 — basename 1 fork 과잉 (perf, sister 1 fork 패리티)

helper L76 `basename` 1 fork. PR-7/PR-8 sister는 1 fork 도달. 본 PR은 +1 초과.

**Fix**: parameter expansion `${ACTIVE_PHASE##*/}` (HIGH-A1 fix에 통합). **Status**: RESOLVED.

## MED-D1 — branch 형식 부분 매칭만 (test)

fixture L122 `contains("PR-7")`만 검증. 정확한 형식 (`feat/<slug>/<pr-id>-<scope>`) 검증 누락. 미래 형식 변경 시 회귀 감지 못 함.

**Fix**: 신규 case +4 (PROJECT_SLUG override 정확 매칭, default fallback, 화이트리스트 우회 거부 2건). **Status**: RESOLVED.

## arch MED-A1 — wrap-up Step 1.5 "강제 tier" 어휘 모순 (부분 fix in-PR)

`mandatory-slots-canon.md:75`가 "강제 tier 도입 → A2 RESOLVED 승격"이라 주장. 그러나 wrap-up grep은 `WARN: ...` echo 1줄 — advisory tier.

**부분 fix in-PR**: 카논 어휘 정정 — "observability tier + advisory tier" + "full 강제 tier 승격은 PR-10 hook 도입 시"로 명시. **PR-10 carry-over**: hook 승격 (`pre-write-checklist-final.sh` PreToolUse가 docid<3 시 deny).

## 기타 carry-over (PR-10 piggyback)

- **MED-A2** (arch): SCOPE 자동 감지 약속 vs 실제 default `go` — 문서/구현 align
- **MED-A3** (arch): post_test cwd 가정 — `working_dir` 필드 추가 또는 cwd-independent 명령
- **MED-A4** (arch): TDD soft ask hook 발동 시점 — Task 실패 복구 절차
- **LOW-A1~A3** (arch): pr-id 정규식 단일 알파벳, mandatory_slots row count 검증, --dry-run 플래그 위치
- **Drift-2** (arch): review/wrap helper output schema 비대칭 — 카논 명시
- **Drift-3** (arch): branch 자동 생성 vs 사용자 override desync
- **LOW-S1~S2** (security), **LOW-P1~P2** (perf), **LOW-T1~T4** (test) — 11건 carry-over

## Round-2 (영향 영역 재검증)

상태: **commit + push 후 spawn 예정** (arch + test).
- arch: HIGH-A1 fix + arch MED-A1 어휘 정정 검증
- test: 신규 4 case (PROJECT_SLUG) 실효성 검증

security/perf round-1 PASS — 재spawn 생략.

## Pass criteria

- HIGH 0건 (round-2)
- ADMIN-MERGE READY: YES (양쪽 agent)
- fixture 35/35 pass (bash 3.2 + 5.x) ✓ 로컬 확인 완료
