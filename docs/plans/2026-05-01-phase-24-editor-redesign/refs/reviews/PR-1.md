---
pr_id: PR-1
phase: phase-24-editor-redesign
review_date: 2026-05-01
branch: feat/phase-24-pr-1-backend-foundation
head_commit: c249a7b
reviewers: 4
verdicts: [security=PASS-WITH-CAVEATS, perf=PASS-WITH-CAVEATS, critic=PASS-WITH-CAVEATS, test=PASS-WITH-CAVEATS]
high_count: 4
critical_count: 1
---

# PR-1 4-Agent Review Synthesis

`/compound-review PR-1` (push 전 카논, before_pr stage). 4-agent 병렬 spawn (security/perf/critic/test). HIGH/Critical 발견 시 사용자 결정 대기 (자동 fix-loop 금지 — PR-2c #107 카논).

## 총평

전 영역 PASS-WITH-CAVEATS. **Critical 1건** (Init lock — 3개 reviewer가 동시 지적, 4 line fix), **HIGH 4건** (테스트 누락 + 스펙 drift). spec D-19~D-26은 본질적으로 honored, 잔여는 implementation drift.

## 카운트

| 영역 | Verdict | CRITICAL | HIGH | MEDIUM | LOW |
|---|---|---|---|---|---|
| security (opus) | PASS-WITH-CAVEATS | 0 | 0 | 1 | 5 |
| perf (sonnet) | PASS-WITH-CAVEATS | 0 | 0 | 3 | 4 |
| critic / arch (opus) | PASS-WITH-CAVEATS | 1 | - | 4 | 5 |
| test (sonnet) | PASS-WITH-CAVEATS | 0 | 2 | 5 | 5 |

⭐ = 2명 이상 reviewer 동의

## CRITICAL / HIGH 수렴 (must-fix-before-merge 후보)

### ⭐ C1 — `ending_branch.Module.Init` lock 위반 (3 reviewer 합의)

- **위치**: `apps/server/internal/module/decision/ending_branch/module.go:37-42`
- **문제**: `Init`이 `applyConfigLocked(config)`를 lock 획득 없이 호출. 헬퍼 docstring `:53` "Caller must hold m.mu.Lock" 위반.
- **현재 안전성**: 단일 스레드 Init 가정 하에 race 없음. 하지만 PR-5에서 `BuildState`가 RLock 획득하면 Init과 race detector 트리거.
- **합의**: security M1, perf L2, critic SOLID-CRITICAL 동시 지적.
- **fix**: 4 lines (lock + defer unlock).

### ⭐ H2 — `locations[].clueIds` write 거부 비대칭 (critic D-20 drift)

- **위치**: `apps/server/internal/domain/editor/service_config.go validateConfigShape`
- **문제**: read path는 dead key 처리 (D-21 union)하나, write validator는 `locations[].clueIds`를 명시 거부 안 함. 프론트가 실수로 dead key 보내면 silent loss.
- **fix**: validator에 walk locations[] 추가 (4 lines).

### H3 — `{"modules": null}` edge case (test H-1)

- **위치**: `service_config.go:31-34`
- **문제**: `null modules`가 type assertion 실패로 "legacy modules shape" 메시지 반환. 미테스트 + 메시지 misleading.
- **fix**: 테스트 1개 추가 + 에러 메시지 개선 OR null도 명시 거부 케이스 분리.

### ⭐ H4 — D-21 conflict log assertion missing (test M-5 + critic D-21 Medium)

- **위치**: `config_normalizer_test.go:94-124` (TestNormalize_DeadKeyUnion_PriorityCluePlacement)
- **문제**: conflict 결과는 assert하나, `log.Debug` emission은 captures 안 함. 누가 Debug → Trace 변경하거나 삭제하면 silent regression.
- **fix**: zerolog buffer/zlogtest 사용 (~15 lines).

## MEDIUM 권고 (이 PR 또는 PR-5 prelude)

| ID | Reviewer | 설명 | 권고 |
|---|---|---|---|
| M1 | critic | D-20/D-21 orphan clue placement silent drop (locations[]에 없는 locID 참조 시) | DEBUG 로그 추가 또는 명시적 테스트 |
| M2 | critic | D-24 `scoreMap` 조건부 required 미적용 (skeleton OK이지만 TODO marker 부재) | `// TODO(PR-5): if/then for scoreMap` 추가 |
| M3 | critic | normalizer가 `domain/editor/`에 위치 — migration 전용 sub-package 권장 | `domain/editor/migration/`로 이동 권장 (옵션) |
| M4 | perf | `NormalizeConfigJSON` 모든 GetTheme에서 unmarshal+marshal 비용 (~500-2000 alloc) — sniff-before-unmarshal로 zero-alloc 가능 | `bytes.Contains` 가드 추가 (10-30ns) |
| M5 | perf | Schema() 매번 map+marshal — sync.Once 캐싱 가능 | sibling 모듈 (voting 등) 동일 패턴 — 일관성 위해 다른 PR로 일괄 |
| M6 | test | 진짜 idempotence 테스트 부재 (double-normalize) | 1 테스트 추가 |
| M7 | test | backend-preset `"enabled":false` 무시 정책 미문서화 | 1 테스트로 정책 pin |
| M8 | test | register_test.go 다른 3 모듈 미assert (Subset 부재) | 4-name assert.Subset |
| M9 | test | `ApplyConfig({})` empty object 미테스트 | 1 테스트 |
| M10 | test | VersionMismatch 테스트 비결정적 fallback | 결정적 테스트로 재작성 |

## LOW (선택)

- `t.Helper()` 11개 top-level Test* 함수 오용 (no-op)
- `Schema()` marshal error swallow (`data, _ :=`)
- `BuildStateFor` JSONEq에 PR-5 break 명시 주석 부재
- normalizer 타입 assertion `_` discard 시 silent drop
- 등등 (5+건)

## 권고 액션 (사용자 결정)

옵션 (a) 즉시 수정 후 round-2 — `/compound-review PR-1` 재실행 (push 전 fix → 단일 CI run 카논 default)
옵션 (b) 그대로 push + PR 생성 → follow-up PR로 fix 이월
옵션 (c) 일부만 fix (Critical+H2/H4만)

⭐ **카논 default = (a)**. 단 적정 scope = C1 + H2 + H4 (3개). 다른 HIGH/MEDIUM은 옵션 트레이드오프.
