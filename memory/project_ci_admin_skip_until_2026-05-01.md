---
name: CI admin-skip 머지 정책 (2026-05-01까지)
description: main branch protection required status checks를 admin 권한으로 skip 머지. 2026-05-01 이후 재검토
type: project
---
2026-04-18 결정. 2026-05-01까지 **모든 PR은 admin 권한으로 required status checks를 스킵 머지**한다.

**Why:** CI 인프라 부채(golangci-lint↔Go1.25 incompatibility, ESLint9 config 미흡 등 — `feedback_ci_infra_debt.md` 참조) 때문에 main 자체가 CI red 상태. 기다리면 green 확보 불가능하고, Phase 20 이후 에디터 후속·graphify 툴링·테스트 보강 작업을 CI 블록 없이 계속해야 함.

**How to apply:**
- PR 머지: `gh pr merge <N> --admin --squash` (또는 GitHub UI의 "Use your administrator privileges to merge this pull request" 체크박스)
- `gh pr checks <N>` 결과가 red여도 머지 진행 가능 — 체크 폴링 불필요
- `feat/*`, `fix/*`, `chore/*`, `docs/*`, `test/*`, `ci/*` 전부 포함
- 2026-05-01 도달하면 CI 정상화 점검 → 정상이면 required checks 복구, 여전히 부채 남았으면 사용자 확인 후 연장 여부 판단
- **예외**: 보안·데이터 마이그레이션·권한 경로 변경 PR은 admin skip 지양 — 사용자 사전 확인 후 개별 판단
