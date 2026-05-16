# Player Kill Power Resolution Plan

- GitHub Issue: #582
- Seed: `seed_f41eca0ce689`

## 목표

- `player_kill` 살해 판정을 `killChancePercent` 확률 방식에서 단서별 공격력/방어력 비교 방식으로 전환한다.
- 제작자는 게임설계에서 살해 판정 방식을 고르고, 스토리진행 장면별로 살해 가능 여부를 체크할 수 있다.
- 런타임은 현재 인벤토리에 남아 있는 단서와 현재 장면만 기준으로 살해 성공/실패를 판정한다.

## 고정 결정

- `killChancePercent`는 UI, 저장 계약, validation, runtime 판정에서 제거한다.
- 기존 `killChancePercent` 값은 `attackPower`로 자동 변환하지 않는다.
- 공격 후보는 공격자가 현재 인벤토리에 가진 `attackPower > 0` 단서다.
- 방어 후보는 대상 플레이어가 현재 인벤토리에 가진 `defensePower > 0` 단서다.
- 사용되어 소모된 단서, 현재 인벤토리에 없는 단서, 공개만 되었지만 보유 중이 아닌 단서는 계산하지 않는다.
- 살해 성공 조건은 항상 `resolvedAttackPower > resolvedDefensePower`다. 같으면 실패다.
- 체크된 장면에서만 살해 가능하다. 체크된 장면이 없으면 살해 불가로 본다.

## 판정 방식

- `all_weapons_vs_all_armor`: 무기 모두 vs 방어구 모두
  - 공격자 인벤토리의 모든 공격 단서 합계와 대상 인벤토리의 모든 방어 단서 합계를 비교한다.
- `best_weapon_vs_all_armor`: 최고 무기 1개 vs 방어구 모두
  - 공격자 인벤토리의 최고 공격력 1개와 대상 인벤토리의 모든 방어 단서 합계를 비교한다.
- `best_weapon_vs_best_armor`: 최고 무기 1개 vs 최고 방어구 1개
  - 공격자 인벤토리의 최고 공격력 1개와 대상 인벤토리의 최고 방어력 1개를 비교한다.

## 작업 범위

- [x] `modules.player_kill.config`에 판정 방식과 허용 장면 목록을 추가한다.
- [x] `modules.clue_interaction.config.itemEffects[clueId]`에서 `killChancePercent`를 제거하고 `attackPower`, `defensePower`를 지원한다.
- [x] 단서 런타임 효과 UI에서 살해확률 입력을 제거하고 공격력/방어력 입력을 제공한다.
- [x] 게임설계의 살해 모드 설정 UI에 판정 방식 선택을 추가한다.
- [x] 스토리진행 장면 설정 UI에 `살해 가능` 체크박스를 추가하고 `allowedSceneIds`에 저장한다.
- [x] 런타임 살해 처리에서 현재 장면 허용 여부를 먼저 확인한 뒤 공격/방어 수치 판정을 수행한다.
- [x] 살해 실패 이벤트 payload에 실패 이유와 계산값을 포함해 디버깅 가능하게 한다.
- [x] 기존 `killChancePercent` 테스트를 제거하거나 새 수치 판정 테스트로 대체한다.

## 제외

- [ ] 확률 기반 살해 판정 유지
- [ ] 기존 `killChancePercent` 값을 공격력으로 자동 마이그레이션
- [ ] 인벤토리에 없는 단서, 소모된 단서, 단순 공개 단서의 공격/방어 반영
- [ ] 별도 장착 시스템 구현

## 완료 조건

- [x] 사용자는 게임설계에서 세 가지 살해 판정 방식 중 하나를 선택할 수 있다.
- [x] 사용자는 스토리진행 탭의 각 장면에서 살해 가능 여부를 체크할 수 있다.
- [x] 사용자는 단서별 공격력/방어력을 설정할 수 있다.
- [x] 런타임은 현재 장면이 허용되지 않으면 살해를 실패시킨다.
- [x] 런타임은 선택한 판정 방식에 따라 현재 인벤토리의 공격/방어 단서만 계산한다.
- [x] `killChancePercent`는 새 저장 payload와 런타임 schema에 남지 않는다.
- [x] focused backend/frontend tests가 주요 성공/실패 경로를 덮는다.

## Coverage Plan

- Backend runtime
  - [x] `apps/server/internal/module/core/clue_item_effects_test.go`
    - 장면 미허용 실패
    - 세 가지 판정 방식 성공/실패
    - 인벤토리에 없는 공격/방어 단서 제외
    - `attackPower == defensePower` 실패
  - [x] `apps/server/internal/module/core/clue_interaction_test.go`
    - schema에서 `attackPower`, `defensePower`, 새 판정 필드 확인
    - `killChancePercent` 제거 확인
- Backend config validation
  - [x] `apps/server/internal/domain/editor/service_config_test.go`
    - `attackPower`/`defensePower` numeric validation
    - `player_kill.config.killResolutionMode` enum validation
    - `player_kill.config.allowedSceneIds` shape validation
    - `killChancePercent` rejected or stripped policy 확인
- Frontend adapter/UI
  - [x] `apps/web/src/features/editor/utils/__tests__/configShape.test.ts`
    - player kill mode, allowed scene IDs, attack/defense read/write
  - [x] `apps/web/src/features/editor/components/clues/ClueRuntimeEffectCard.test.tsx`
    - 살해확률 입력 제거
    - 공격력/방어력 저장
  - [x] `apps/web/src/features/editor/components/design/__tests__/ModulesSubTab.test.tsx`
    - 판정 방식 선택 저장
  - [x] flow/phase panel 테스트
    - 장면별 `살해 가능` 체크 저장

## 병렬 작업 설계

### 병렬 가능 작업

- [ ] Backend lane: config validation, runtime 판정, Go tests
- [ ] Frontend lane: configShape adapter, clue UI, game-design UI, flow scene UI
- [ ] Test review lane: 변경 파일별 focused test 누락 확인

### 파일/모듈 소유권

- Backend lane
  - `apps/server/internal/module/core/clue_item_effects.go`
  - `apps/server/internal/module/core/clue_interaction.go`
  - `apps/server/internal/module/core/player_kill.go`
  - `apps/server/internal/domain/editor/service_config.go`
  - 관련 Go tests
- Frontend lane
  - `apps/web/src/features/editor/utils/configShape.ts`
  - `apps/web/src/features/editor/components/clues/ClueRuntimeEffectCard.tsx`
  - `apps/web/src/features/editor/components/design/ModulesSubTab.tsx`
  - `apps/web/src/features/editor/components/design/PhaseNodePanel.tsx`
  - `apps/web/src/features/editor/flowTypes.ts`
  - 관련 Vitest tests

### 병렬 금지/주의 영역

- 공유 계약인 `ClueItemEffectConfig`, `PlayerKillConfig`, config validation은 한 번에 취합한다.
- `killChancePercent` 제거는 backend/frontend/test를 동시에 맞춰야 하므로 중간 커밋에서 깨진 상태로 PR을 만들지 않는다.
- PR 생성, label, merge는 메인 Codex가 맡는다.

### 취합 방식

- Sub-agent를 사용할 경우 결과는 `발견 / 수행 / 판단 / 미해결`로 압축한다.
- 이번 세션에서는 사용자가 별도 병렬 sub-agent 실행을 명시하지 않았으므로 메인 Codex가 순차 구현한다.

## 검증 계획

- [x] `go test ./internal/module/core ./internal/domain/editor`
- [x] `pnpm --filter @mmp/web test -- ClueRuntimeEffectCard configShape ModulesSubTab`
- [ ] 필요 시 `scripts/mmp-local-ci.sh quick`

## PR 묶음 제안

- 단일 PR 권장.
- 이유: 저장 계약, 에디터 UI, 런타임 판정이 서로 강하게 연결되어 분리하면 중간 PR이 깨진 계약을 남길 가능성이 높다.

## 브레인스토밍 필요 여부

- [x] 완료. `ooo interview`로 판정 방식, 후보 단서 범위, 레거시 제거, 장면 게이트 요구가 확정됐다.
