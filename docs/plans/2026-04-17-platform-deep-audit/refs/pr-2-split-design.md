# PR-2 PlayerAwareModule Mandatory — 3분할 설계 (index)

> Author: module-architect (Phase 19 W3)
> 대상 Finding: F-03 (P0, crime_scene PlayerAware 누락) · F-sec-2 (P0, 25/33 fallback) · D-MO-1 (P0 delta, craftedAsClueMap redaction)
> Baseline: main @ 858a1fa (2026-04-17). 실측 PlayerAware 구현 **8/33** (W2 audit 03-module-architect §Metrics 확정, W1 인벤토리 0/33 는 drift).

## 결론

원래 PR-2 (XL, Med risk) 를 **3개 PR** 로 분할. 각 PR 모두 독립 mergeable, 순차 실행 권장 (PR-2a → PR-2b → PR-2c), 중간에 feature flag 불요. 분할 후 PR별 재추정:

| PR | Scope | Size | Risk | Finding |
|----|-------|------|------|---------|
| **PR-2a** | Engine gate + mandatory 인터페이스 전환 + sentinel helper | **S** | **Low** | F-sec-2 인프라 |
| **PR-2b** | 25 모듈 `BuildStateFor` 백필 + redaction 테스트 확장 | **L** | **Med** | F-03 + F-sec-2 실구현 |
| **PR-2c** | `CombinationModule` craftedAsClueMap redaction | **S-M** | **Low** | D-MO-1 단독 해소 |

원 PR-2 XL 단일 머지 시 git conflict·리뷰 병목·롤백 granularity 손실이 예상되어 분할한다.

## 문서 맵

- [refs/pr-2/current-state.md](pr-2/current-state.md) — 33 모듈 PlayerAware 구현 현황 실측표 + 민감 필드 매핑
- [refs/pr-2/pr-2a-engine-gate.md](pr-2/pr-2a-engine-gate.md) — Engine 인터페이스 mandatory 전환 + boot-fail gate
- [refs/pr-2/pr-2b-module-backfill.md](pr-2/pr-2b-module-backfill.md) — 25 모듈 구현 계획 + pattern catalog
- [refs/pr-2/pr-2c-crafted-redaction.md](pr-2/pr-2c-crafted-redaction.md) — `combination.derived/completed/collected` per-player redaction
- [refs/pr-2/execution-plan.md](pr-2/execution-plan.md) — Wave 배치 + 병렬/순차 판정 + 리스크·완화

## 3분할 근거 (요약)

1. **경계가 다름**: PR-2a 는 *engine 규약 변경* (interface + factory validation), PR-2b 는 *모듈 구현부 백필* (각 모듈 `BuildStateFor` 작성), PR-2c 는 *기존 PlayerAware 모듈 1개의 internal state 재설계* (crafted/derived 맵 redaction). 코드 소유자·테스트 레벨·검토 심도가 달라 단일 PR 에 섞이면 리뷰 granularity 손상.
2. **롤백 단위**: PR-2a 만 머지하면 registry 가 PlayerAware 미구현 모듈을 `init()` 에서 **boot fail** 로 거절하므로, 임시로 *모든 모듈이 no-op `BuildStateFor() { return m.BuildState() }` 를 가지는 stub 단계* 가 필요. 이 stub 을 포함한 PR-2a 를 먼저 머지해야 PR-2b 가 25 파일을 점진 교체 가능. 단일 XL 로 하면 stub 과 real 구현이 혼재 diff 로 섞여 리뷰 불가.
3. **Testability 격리**: PR-2a 의 검증은 `factory.go` + `registry.go` 단위 테스트. PR-2b 는 `snapshot_redaction_test.go` 확장 + 모듈별 redaction assert. PR-2c 는 `combination_test.go` 확장. 각 PR 이 독립된 테스트 수트를 가지므로 CI signal 도 분리된다.
4. **Risk surface**: PR-2b 가 25 파일 변경으로 가장 크지만, PR-2a 의 gate 가 먼저 머지되어 있으면 "stub → real" 교체는 컴파일 보장 아래에서 진행된다. PR-2a 단독 위험은 build break 1건 (모든 모듈이 gate 통과해야 함) 으로 한정 가능.

## Finding → PR 매핑

| Finding | PR-2a | PR-2b | PR-2c | 비고 |
|---------|:----:|:----:|:----:|----|
| **F-03 crime_scene PlayerAware 미구현** (P0) | 게이트만 | 실구현 | - | PR-2b 가 evidence/location/combination 3개 포함 |
| **F-sec-2 25/33 fallback** (P0) | 게이트만 | 실구현 | - | PR-2b 가 나머지 22 모듈 백필 |
| **D-MO-1 craftedAsClueMap redaction** (P0 delta) | - | - | 단독 | `combination.derived/completed/collected` per-player filter — 이미 PlayerAware 구현된 모듈의 internal state 변경이므로 PR-2b 범위 밖 |

## 실행 순서 요약

```
W2 잔여  → PR-2a (S, Low)     단독 머지 [stub 25 모듈 포함]
W3 전반  → PR-2b (L, Med)     PR-2a 머지 후 착수 (stub → real)
W3 후반  → PR-2c (S-M, Low)   PR-2b 병렬 가능하지만 conflict 최소화 위해 sequential 권장
```

Feature flag: **불요**. PR-2a 는 compile-time 강제로 boot fail 안전장치가 내장되고, PR-2b/2c 는 state shape 변경이 아니라 *추가* 경로(`BuildStateFor`) 구현이라 기존 클라이언트 미영향.

## 주요 리스크 TOP 3

1. **PR-2a 머지 직후 모든 모듈이 stub BuildStateFor 로 동작** → public BuildState 와 동일한 값을 반환하므로 *기능적으론* 현재와 같지만, 테스트는 "PlayerAware 구현됨" 으로 표시되어 fallback path 가 사라진다. snapshot_redaction_test 가 stub 을 real 과 구분할 수 있어야 한다. **완화**: stub 에 `// TODO(pr-2b): redact per-player state` 주석 + `var _ engine.PlayerAwareModule = (*X)(nil)` 컴파일 assertion 만 추가, 실제 `BuildStateFor` 는 `return m.BuildState()` 만 호출 (lint rule 로 PR-2b 에서 제거 강제).
2. **PR-2b 25 파일 동시 변경 → 다른 PR 과 git conflict** — Phase 20 이후 에디터·CI PR 이 같은 파일을 건드릴 확률 높음. **완화**: PR-2b 를 Wave 경계 머지 직후 착수 + subagent-driven-development 로 카테고리별(crime_scene/decision/communication/core/progression) 커밋 분리해 cherry-pick rebase 용이하도록.
3. **PR-2c 는 `combination.derived/completed/collected` 의 *per-player* 맵을 *calling-player only* 로 좁히는데, 기존 `evidence.collected` 구독 로직이 전 플레이어 맵을 공유한다는 가정에 의존** → redaction 하면서도 graph.Resolve 입력에 자기 플레이어 collected 만 넣는 현재 구조는 유지. **완화**: PR-2c 는 state *외부 노출* 레이어만 redact 하고 internal `m.derived[otherPlayerID]` 는 서버 내부 계산용으로 유지. BuildStateFor 는 `playerID` 키만 snapshot 에 포함.

## 다음 단계 (PR-2a 착수 전 확인 필요)

1. **W3 advisor 승인**: advisor-consultations.md 에 "PlayerAwareModule 의무화를 boot-fail gate 로 강제할지, 점진 migration 으로 둘지" 의사결정 확정(05-security F-sec-2 Advisor-Ask §1 미해결).
2. **`engine.SerializableModule` 과의 의무화 정책 일관성**: 현재 선택 인터페이스 중 `PlayerAwareModule` 만 의무화하면 코드 규약이 비대칭. 문서(project_module_system.md) 업데이트 범위 확정.
3. **Phase 19 backlog 기존 PR-2 엔트리 업데이트**: phase19-backlog.md 에서 PR-2 → PR-2a/2b/2c 재기입 + 각 PR 의존성 그래프 명시.
4. **module-inventory.md 수정 선행**: W1 인벤토리의 "PlayerAwareModule 0/33" 수치를 실측 8/33 으로 교정(F-module-6 요청). PR-2a diff 에서 reviewer 가 ground truth 로 참조할 문서.

## 참조

- W2 audit: `refs/audits/03-module-architect.md` (F-module-1, F-module-6, §Metrics)
- W2 audit: `refs/audits/05-security.md` (F-sec-2)
- W1 shared: `refs/shared/module-inventory.md` (33 모듈 표)
- Engine 규약: `apps/server/internal/engine/types.go:70-139`
- Redaction boundary: `apps/server/internal/session/snapshot_send.go:86-111`
- 기존 PlayerAware 구현 8종: whisper · hidden_mission · voting · trade_clue · starting_clue · round_clue · timed_clue · conditional_clue
