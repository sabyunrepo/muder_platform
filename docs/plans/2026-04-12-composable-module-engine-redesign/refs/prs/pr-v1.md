# PR-V1 — e2e Smoke + Module Isolation CI Gate

**Wave**: 7 · **Sequential** · **Depends on**: all · **Worktree**: optional

## Scope globs
- `apps/server/internal/e2e/engine_v2_test.go` (new)
- `apps/server/internal/e2e/fixtures/*.json` (new)
- `.github/workflows/module-isolation.yml` (new)
- `scripts/test-module-isolation.sh` (new)

## Context
Phase 9.0 전체의 최종 검증. 4 장르 smoke test + 모듈 격리 CI 게이트.

## Tasks

1. **e2e harness** — test helper: template load → session create → WS client 시뮬 → phase 진행 → 완주
2. **murder_mystery smoke** — classic 6P 프리셋으로 1 세션 완주 (intro → 3 rounds → vote → reveal)
3. **crime_scene smoke** — 3 locations 프리셋으로 완주 (탐색 → 증거 수집 → 조합 → accusation)
4. **script_kill smoke** — 3 rounds 프리셋 완주 (script 배부 → 읽기 → 토론 → vote)
5. **jubensha smoke** — 1st person 프리셋 완주 (script → 휴식 → whisper → vote)
6. **module isolation script** — 각 모듈 패키지만 변경 시 다른 모듈 test 통과 확인
7. **CI workflow** — isolation script 를 PR 마다 실행, fail 시 PR block

## Verification
- `go test -race ./internal/e2e/...` all green
- 4 smoke test 모두 완주 (타임아웃 30초 이하)
- isolation script 통과
- CI workflow dry-run 성공

## Module Isolation Script

```bash
#!/bin/bash
# scripts/test-module-isolation.sh
set -e

for mod in cluedist decision progression exploration media communication crime_scene core; do
    echo "=== Testing isolation of module: $mod ==="
    # 해당 모듈만 테스트 (다른 모듈과 독립적으로)
    go test -race ./apps/server/internal/module/$mod/... || exit 1
done

# 전체 빌드 검증
go build ./apps/server/...

# 모듈 간 import 금지 검증 (선택)
# for mod in ...; do
#   grep -r "internal/module/" ./apps/server/internal/module/$mod/ && fail
# done

echo "=== All modules isolated ==="
```

## 완료 기준

이 PR 머지 = Phase 9.0 완료. `/plan-finish` 호출 후 archive.
