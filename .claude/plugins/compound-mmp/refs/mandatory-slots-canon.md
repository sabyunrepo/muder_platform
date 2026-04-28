# `mandatory_slots` — sister 카논 어휘 단일 source

`/compound-plan`, `/compound-work`, `/compound-review`, `/compound-wrap` helper 출력에 등장하는 `mandatory_slots` 메타의 카논. M-N1 (PR-8 round-2 critic 권고)에서 도입.

## 목적

helper 출력에 "메인 컨텍스트가 다음 단계에서 반드시 inject해야 할 슬롯"을 메타로 명시한다. inject 누락 시 sister 카논 (`/compound-wrap` Step 1)이 docid grep으로 drift 검출.

이전 (PR-7/PR-8까지)는 inject 의무가 SKILL anti-pattern + command anti-pattern + template anti-pattern 3중 self-enforce였다 — 강제 검증 0. `mandatory_slots`는 **observability anchor**, wrap-up Step 1 grep은 **강제 tier**.

## 카논 슬롯 (현재 정의)

| 슬롯 ID | 출처 | template anchor | wrap-up grep 검증 |
|---------|------|----------------|-----------------|
| `qmd-recall-table` | `/compound-plan` step 1 결과 (mmp-plans 5건) | `<!-- INJECT-RECALL-MANDATORY-START/END -->` (templates/plan-draft-template.md) | 마커 사이 `#[a-f0-9]{6}` docid ≥3 |
| `tdd-test-first` | `/compound-work` tdd_skill 호출 (소스 파일 작성 전 `*_test.go`/`*.test.tsx` 존재) | 직접 마커 X — `pre-edit-size-check.sh` PreToolUse hook이 검출 | hook 미차단 시 `git log --diff-filter=A` 검사 |

> 슬롯 추가 시: 본 표 갱신 + helper output `mandatory_slots` 배열에 추가 + wrap-up Step 1 grep 카논에 검증 식 명시.

## helper output contract

```json
{
  "...": "...",
  "mandatory_slots": ["qmd-recall-table", "tdd-test-first"]
}
```

- 배열은 항상 존재 (빈 배열도 허용 — 슬롯 미적용 단계).
- 슬롯 ID는 본 카논 표의 row ID와 정확히 일치 (string match).
- 동일 슬롯이 여러 단계에서 mandatory일 수 있음 (예: `qmd-recall-table`이 plan step 4 + wrap-up step 1 양쪽).

## wrap-up Step 1 검증 카논

`refs/wrap-up-checklist.md` Step 1 Pre-scan에 추가됨:

```bash
# 활성 phase의 INJECT-RECALL-MANDATORY 마커 사이 docid ≥3 검사 (qmd-recall-table 슬롯)
ACTIVE_PHASE=$(ls -td docs/plans/*/ 2>/dev/null | head -1 | sed 's:/$::')
CHECKLIST="${ACTIVE_PHASE}/checklist.md"
if [ -f "$CHECKLIST" ] && grep -q "INJECT-RECALL-MANDATORY-START" "$CHECKLIST"; then
  DOCID_COUNT=$(awk '/INJECT-RECALL-MANDATORY-START/,/INJECT-RECALL-MANDATORY-END/' "$CHECKLIST" | grep -oE '#[a-f0-9]{6}' | wc -l)
  if [ "$DOCID_COUNT" -lt 3 ]; then
    echo "WARN: qmd-recall-table 슬롯 inject 누락 가능성 (docid ${DOCID_COUNT}/≥3)"
  fi
fi
```

검출 결과는 Step 4 통합 표시에 포함 (강제 차단이 아니라 경고). 사용자가 의도적으로 빈 회상으로 진행한 경우 무시 가능 (P3 수준).

## sister 카논 어휘 통일

본 PR-9 (`/compound-work` 도입) 시점부터 다음 SKILL/template/refs가 `mandatory_slots`를 **본 파일에서 인용**:

- `commands/compound-plan.md` — qmd-recall-table 슬롯 명시
- `commands/compound-work.md` — tdd-test-first 슬롯 명시
- `skills/qmd-recall/SKILL.md` — 슬롯 출처 (Plan stage)
- `skills/wrap-up-mmp/SKILL.md` — Step 1 grep 검증
- `skills/review-mmp/SKILL.md` — review 단계는 슬롯 없음 명시 (drift 방지)
- `templates/plan-draft-template.md` — `<!-- INJECT-RECALL-MANDATORY-START/END -->` 마커
- `refs/wrap-up-checklist.md` — Step 1 검증 카논

각 파일의 `mandatory_slots` 어휘는 본 파일을 single source로 인용한다 (sister-canon drift 방지, PR-8 HIGH-A2 critic 카논).

## Anti-pattern

- ❌ helper output에 `mandatory_slots` 누락 → fixture가 검증 (PR-8 fixture case 37~39 패턴)
- ❌ 슬롯 ID 추가 시 본 파일 갱신 누락 → sister 어휘 drift, wrap-up grep 미작동
- ❌ template 마커 (`<!-- ... -->`)를 다른 어휘로 변경 → wrap-up grep과 desync
- ❌ 본 카논을 SKILL.md에 인라인 복제 → single source 깨짐

## 검증 트레일

- PR-8 round-2 critic (M-N1): "helper mandatory_slots + template marker는 observability tier만, 강제 tier는 PR-9 wrap-up canon 추가에 의존"
- PR-9 (본 카논 도입): observability + 강제 tier 모두 도입 → A2 PARTIAL → RESOLVED 승격 trail
- PR-10 dogfooding: `/compound-plan phase-21-...` → `/compound-work` → `/compound-review` → `/compound-wrap --wave` 풀 사이클에서 `qmd-recall-table` 슬롯 inject 검증
