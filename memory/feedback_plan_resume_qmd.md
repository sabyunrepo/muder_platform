---
name: plan-resume은 QMD로 컨텍스트 효율화
description: /plan-resume 시 Read 대신 QMD get/search로 필요한 섹션만 로드하여 컨텍스트 토큰 절약
type: feedback
originSessionId: c0b2a2da-c721-4cd4-b311-bba72e59e407
---
plan-resume에서 Read로 6개 파일 전문(~550줄)을 올리지 말고, QMD를 활용할 것.

**Why:** active-plan.json이 이미 wave/PR/task 구조를 갖고 있어서 design.md, plan.md는 중복. 완료된 wave 상세, pipeline.json(불변)은 매번 읽을 필요 없음. 컨텍스트 토큰 낭비.

**How to apply:**
- `mmp-plans` 컬렉션: 현재 PR spec만 `get`으로 로드 (예: `refs/prs/pr-a7.md`)
- `mmp-memory` 컬렉션: progress 메모리에서 현재 wave 섹션만 `search`
- checklist: 현재 PR의 미완료 항목만 필요 → QMD search로 해당 섹션만
- design.md, plan.md, pipeline.json: active-plan.json에 이미 요약 있으므로 skip
- 예외: 설계 결정 확인이 필요한 경우에만 design refs/ 개별 `get`
