---
name: plan-resume에서도 QMD 우선
description: /plan-resume 컨텍스트 복원 시에도 docs/plans, memory 경로는 Read 대신 QMD get 사용 필수
type: feedback
originSessionId: 6c3c79f2-2fec-425e-85a0-51decc6e6fa1
---
plan-resume 스킬이 직접 Read를 지시하더라도, docs/plans/ 및 memory/ 경로의 .md 파일은 QMD get으로 로드해야 한다.

**Why:** CLAUDE.md의 QMD 필수 사용 규칙은 예외 없이 적용. plan-resume 스킬 지시보다 프로젝트 규칙이 우선. Read 직접 사용은 QMD로 대상 특정 후 소스코드(.go, .ts)에만 허용.

**How to apply:** plan-resume 복원 시 design.md, checklist.md, progress memory, PR spec 모두 `qmd get` 사용. 스킬 지시가 Read를 요구해도 QMD로 대체.
