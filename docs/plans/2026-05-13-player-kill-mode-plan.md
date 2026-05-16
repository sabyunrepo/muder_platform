# 플레이어킬 모드 작업계획

작성일: 2026-05-13  
브랜치: `feat/player-kill-mode`  
목표: 에디터 게임설계 탭에 `플레이어킬` 모드를 추가하고, 살해 가능한 캐릭터/단서/확률/마이크 차단 규칙을 제작자가 설정한 뒤 런타임에서 같은 규칙으로 판정한다.

## 고정 결정

- 저장 위치는 `config_json.modules.player_kill` 신규 모듈을 기본으로 둔다.
- 단서 사용 효과 자체는 기존 `modules.clue_interaction.config.itemEffects[clueId]`의 `effect: "kill"`을 확장한다.
- 살해 가능 여부는 프론트 표시가 아니라 backend runtime engine에서 최종 판정한다.
- `살해시 마이크 끔`은 `voice_chat` UI만 숨기는 기능이 아니라 죽은 플레이어가 음성채팅을 못 쓰게 하는 런타임 제약으로 처리한다.
- 단서 생성 폼의 기존 `고급 설정` 블록은 제거 대상이다. 공개 여부, 라운드 스케줄, 사용 효과는 단서 상세 화면으로 집중한다.

## 현재 확인한 사실

- [x] 게임설계 탭의 모듈 UI는 `OPTIONAL_MODULE_CATEGORIES`를 돌며 토글을 렌더링하고, 서버 JSON schema가 있으면 `SchemaDrivenForm`으로 인라인 설정을 표시한다. 특수 UI가 필요한 모듈은 `ModulesSubTab`에서 직접 패널을 붙인다.
- [x] `clue_interaction`은 이미 required core 모듈이며, `kill` 효과 상수와 런타임 처리 함수가 있다.
- [x] `ClueRuntimeEffectCard`에는 이미 `EffectMode = "kill"`과 `살해 요청` 선택 UI가 있고, 현재 저장 계약은 `effect: "kill", target: "player", consume`까지만 저장한다.
- [x] backend `handleKillEffect`는 현재 성공하면 바로 `ApplyPlayerStatus(... IsAlive:false ...)`를 호출한다. 확률, 살해가능 캐릭터 제한, 마이크 차단 설정은 아직 없다.
- [x] `voice_chat` 모듈은 참여자별 `isMuted` 상태를 가지고 `voice:mute`, `voice:unmute` 메시지를 처리하지만, `player.status_changed`를 보고 자동 강제 음소거하거나 재참가를 막는 로직은 없다.
- [x] 캐릭터 상세의 `등장인물 유형` 영역에는 이미 `피해자`, `플레이어 캐릭터`, `읽기 대사`, `투표 후보` 같은 체크박스형 visibility UI가 있다. `살해 가능`도 같은 영역에 같은 패턴으로 붙인다.
- [x] 단서 생성 폼의 `ClueFormAdvancedFields`는 `공개 단서`, `라운드 스케줄`, `사용 가능한 단서`를 한 블록에 들고 있어 단서 상세의 런타임 효과 카드와 중복된다.

## 완료 조건

### 사용자 경험

- [x] 제작자가 `/editor/:id/design/modules`에서 `플레이어킬` 모드를 켜고 끌 수 있다.
- [x] 모드가 켜졌을 때 캐릭터 상세의 `등장인물 유형` 영역에 `살해 가능` 체크박스가 보인다.
- [x] 체크된 PC/NPC 캐릭터만 살해 대상이 된다.
- [x] `살해시 마이크 끔`을 켜면 살해된 플레이어는 음성채팅을 사용할 수 없고, 이미 연결되어 있으면 voice module 상태가 강제 mute로 바뀐다.
- [x] 단서 상세에서 `살해 요청`을 선택하면 `살해확률(%)` 입력이 보이고, 0~100 범위로 저장된다.
- [x] 단서 생성 화면에서는 중복 `고급 설정` 블록이 사라지고, 생성 후 단서 상세에서 공개/라운드/사용 효과를 설정하는 흐름으로 정리된다.

### 데이터/계약

- [x] `modules.player_kill.enabled`와 `modules.player_kill.config`를 저장한다.
- [x] `modules.player_kill.config.killableCharacterIds`는 PC/NPC를 모두 받을 수 있는 캐릭터 ID 목록이다.
- [x] `modules.player_kill.config.muteOnKilled`는 살해 성공 후 음성채팅 차단 여부다.
- [x] `modules.clue_interaction.config.itemEffects[clueId].killChancePercent`를 추가하고, `effect: "kill"`일 때만 허용한다.
- [x] 서버 저장 검증은 잘못된 확률 범위, 잘못된 캐릭터 ID, kill 효과가 아닌데 들어온 kill 전용 필드를 거부한다.
- [x] 기존 `kill` 효과 설정은 확률 필드가 없으면 `100%`로 해석해 기존 동작을 깨지 않는다.

### 품질/검증

- [x] frontend adapter/unit test가 `player_kill` 모듈 설정, 캐릭터별 살해가능 체크, kill chance 저장/읽기를 덮는다.
- [x] backend unit/integration test가 확률 성공/실패, 살해 불가 대상 거부, 죽은 actor 거부, 마이크 차단 이벤트를 덮는다.
- [x] 단서 생성 폼 중복 제거는 기존 단서 생성 성공 경로를 깨지 않는 test로 확인한다.
- [x] PR 전 위험도에 맞는 focused check를 실행한다.

## 작업 범위

### 1. 플레이어킬 모듈 계약

- [x] `apps/web/src/features/editor/constants.ts`에 `player_kill` 모듈을 추가한다.
  - 권장 위치: `decision` 또는 `clue_distribution`보다 `core gameplay` 성격이 강하므로 새 카테고리가 필요 없으면 `decision`에 배치한다.
  - 사용자-facing 이름: `플레이어킬`
  - 설명: `단서로 캐릭터를 살해하고 사망 후 음성채팅 제한을 설정`
- [x] `apps/web/src/features/editor/utils/configShape.ts`에 `PlayerKillConfig` read/write helper를 추가한다.
- [x] backend에 `player_kill` config validation을 추가한다.
  - 신규 runtime module로 만들지, `clue_interaction`이 읽는 보조 config로 둘지는 구현 전 최종 확인한다.
  - MVP 권장: 별도 저장 모듈 `player_kill`, 런타임 실행은 `clue_interaction`에서 해당 config를 참조.

### 2. 게임설계 탭 설정 UI

- [x] `ModulesSubTab`에 `player_kill` 전용 설정 패널을 추가한다.
- [x] 패널에는 `살해시 마이크 끔` 체크박스를 둔다.
- [x] 캐릭터별 살해 가능 목록은 모듈 탭에서 전체 요약만 보여주고, 실제 체크는 캐릭터 상세에서 한다.
  - 이유: 캐릭터별 속성은 캐릭터 상세의 기존 `등장인물 유형` 체크박스 패턴과 맞고, 모듈 탭이 과밀해지는 것을 막는다.

### 3. 캐릭터 상세 등장인물 유형 살해가능 체크박스

- [x] `CharacterDetailPanel`의 `등장인물 유형` 체크박스 그룹에 `살해 가능` 체크박스를 추가한다.
- [x] `CharacterAssignPanel`에서 체크 변경 시 `modules.player_kill.config.killableCharacterIds`를 갱신한다.
- [x] `player_kill` 모듈이 꺼져 있으면 `등장인물 유형` 영역의 `살해 가능` 체크박스는 숨기거나 disabled 처리한다.
  - 권장: 숨김. 제작자가 모듈을 켜기 전에는 관련 설정을 보지 않게 한다.
- [x] NPC도 체크 가능해야 하므로 `is_playable` 여부로 필터링하지 않는다.

### 4. 단서 상세 살해확률 입력

- [x] `ClueRuntimeEffectCard`의 draft에 `killChancePercent`를 추가한다.
- [x] `draft.mode === "kill"` 영역에 0~100 number input 또는 slider+input을 추가한다.
- [x] 저장 시 `effect: "kill"` config에 `killChancePercent`를 저장한다.
- [x] 읽을 때 필드가 없으면 100으로 표시한다.
- [x] `configShape.ts`의 `ClueItemEffectConfig`와 known field strip/read/write helper에 `killChancePercent`를 추가한다.
- [x] backend `validateClueItemEffectShape`와 `ClueItemEffectConfig`에도 같은 필드를 추가한다.

### 5. 런타임 살해 판정

- [x] `ClueInteractionModule`이 kill 효과 처리 전에 `player_kill` 설정을 읽어 모듈 활성 여부와 대상 허용 여부를 확인한다.
- [x] `killChancePercent`로 확률 판정을 수행한다.
  - 0이면 항상 실패, 100이면 항상 성공.
  - 테스트 가능성을 위해 random source는 주입 가능하게 작게 분리한다.
- [x] 실패 시 생존 상태를 바꾸지 않고 `clue.kill_failed` 이벤트로 실패 결과를 알린다.
- [x] 성공 시 기존 `ApplyPlayerStatus`를 유지한다. roll 값은 플레이어 노출 요구가 없어 MVP payload에서는 제외했다.
  - 사용자에게 roll 값을 노출할 필요는 없지만 테스트/로그에는 필요할 수 있다.

### 6. 살해 후 음성채팅 차단

- [x] `player_kill.config.muteOnKilled`가 true이고 kill 성공이면 voice 쪽에 강제 음소거 이벤트를 전달한다.
- [x] `voice_chat` 모듈은 죽은 플레이어의 `voice:join` 또는 `voice:unmute`를 거부하거나 무시한다.
- [x] voice module이 `voice.mute_changed`를 발행해 클라이언트가 로컬 마이크 상태를 동기화할 수 있게 한다.
- [x] 재접속 시에도 죽은 플레이어가 다시 마이크를 켜지 못하게 backend 상태가 기준이 되도록 한다.

### 7. 단서 생성 폼 중복 제거

- [x] `ClueFormAdvancedFields` 사용처를 확인하고 단서 생성/기본 편집에서 해당 블록을 제거한다.
- [x] `CreateClueRequest`/`UpdateClueRequest`에 남아 있는 legacy `is_common`, `is_usable`, `use_effect`, `reveal_round`, `hide_round` 필드를 즉시 삭제할지, API 호환을 위해 남기되 UI만 제거할지 결정한다.
  - MVP 권장: UI만 제거하고 API 필드는 유지. 기존 데이터/테스트 영향이 작다.
- [x] 단서 상세 화면의 런타임 효과 설정 흐름을 유지하고, 생성 폼에서는 legacy 값을 보존만 하도록 정리한다.

## 병렬 작업 설계

Codex sub-agent는 사용자가 명시적으로 병렬/위임을 승인한 경우에만 사용한다. 승인받는다면 아래처럼 나눈다.

### 병렬 가능 작업

- [ ] Frontend lane: 모듈 탭, 캐릭터 상세, 단서 상세 UI와 adapter.
- [ ] Backend lane: config validation, clue kill chance, player kill runtime, voice_chat 차단.
- [ ] Test lane: 기존 테스트 위치 확인, focused test 목록 작성, 누락된 E2E 범위 판단.

### 파일/모듈 소유권

- Frontend lane:
  - `apps/web/src/features/editor/constants.ts`
  - `apps/web/src/features/editor/utils/configShape.ts`
  - `apps/web/src/features/editor/components/design/ModulesSubTab.tsx`
  - `apps/web/src/features/editor/components/design/CharacterAssignPanel.tsx`
  - `apps/web/src/features/editor/components/design/CharacterDetailPanel.tsx`
  - `apps/web/src/features/editor/components/clues/ClueRuntimeEffectCard.tsx`
  - `apps/web/src/features/editor/components/ClueFormAdvancedFields.tsx` 및 사용처
- Backend lane:
  - `apps/server/internal/domain/editor/service_config.go`
  - `apps/server/internal/module/core/clue_item_effects.go`
  - `apps/server/internal/module/core/clue_interaction.go`
  - `apps/server/internal/module/communication/voice_chat.go`
  - 필요 시 `apps/server/internal/engine/types.go`
- Test lane:
  - `apps/web/src/features/editor/**/__tests__/*`
  - `apps/server/internal/module/core/*_test.go`
  - `apps/server/internal/domain/editor/service_config_test.go`
  - `apps/server/internal/module/communication/voice_chat_test.go`

### 병렬 금지/주의 영역

- `configShape.ts`와 `service_config.go`는 shared contract라서 여러 작업자가 동시에 수정하지 않는다.
- `ClueItemEffectConfig` 필드 추가는 frontend/backend를 같은 이름과 의미로 맞춘 뒤 한 번에 취합한다.
- voice runtime 정책은 보안/권한 영향이 있으므로 frontend만으로 처리하지 않는다.

### 취합 방식

- 각 lane은 `발견 / 수행 / 판단 / 미해결` 형식으로 보고한다.
- 메인 Codex가 shared contract 변경을 최종 취합하고, PR 전 focused validation을 실행한다.

## Coverage Plan

- `apps/web/src/features/editor/utils/__tests__/configShape.test.ts`
  - [x] `player_kill` 모듈 config read/write
  - [x] `killChancePercent` read/write
  - [x] legacy kill effect가 chance 없이 100으로 해석되는지
- `apps/web/src/features/editor/components/design/__tests__/ModulesSubTab.test.tsx`
  - [x] `플레이어킬` 토글 저장
  - [x] `살해시 마이크 끔` 저장
- `apps/web/src/features/editor/components/design/__tests__/CharacterAssignPanel.test.tsx`
  - [x] 모듈 enabled일 때 `살해 가능` 체크박스 표시/저장
  - [x] NPC 캐릭터도 살해 가능 체크 대상
- `apps/web/src/features/editor/components/clues/ClueRuntimeEffectCard.test.tsx`
  - [x] `살해 요청` 선택 시 확률 입력 표시
  - [x] 0/100/중간값 저장
  - [x] 잘못된 값 clamp 또는 validation
- `apps/web/src/features/editor/components` 또는 clue form test
  - [x] 단서 생성 폼에서 `고급 설정` 블록이 더 이상 보이지 않음
  - [x] 단서 생성 기본 경로는 유지
- `apps/server/internal/domain/editor/service_config_test.go`
  - [x] `player_kill` config shape validation
  - [x] `killChancePercent` 범위 validation
  - [x] kill 전용 필드가 다른 effect에 들어오면 거부
- `apps/server/internal/module/core/clue_item_effects_test.go`
  - [x] 100% 성공은 사망 처리
  - [x] 0% 실패는 사망 처리 없음
  - [x] 살해 불가 캐릭터는 거부
  - [x] 실패/거부 시 단서 소비 정책 확인
- `apps/server/internal/module/communication/voice_chat_test.go`
  - [x] 죽은 플레이어의 unmute/join 차단
  - [x] kill 성공 이벤트 이후 forced mute 반영

## 검증 계획

- [x] `pnpm --filter @mmp/web test -- configShape ClueRuntimeEffectCard ModulesSubTab CharacterAssignPanel ClueForm`
- [x] `pnpm --filter @mmp/web typecheck`
- [x] `cd apps/server && go test ./internal/engine ./internal/module/core ./internal/module/communication ./internal/domain/editor -run 'TestClueInteractionModule_ConfiguredKill|TestVoiceChatModule_MuteOnKilled|TestUpdateConfigJson_Validates(ClueInteractionItemEffects|PlayerKillModuleConfig)'`
- [x] `scripts/mmp-local-ci.sh quick`
- [ ] UI 변경 후 가능하면 브라우저로 `/editor/:id/design/modules`, `/editor/:id/characters`, `/editor/:id/clues` 확인

## PR 묶음 제안

- 권장 PR-1: editor 저장 계약 + UI
  - `player_kill` 모듈 토글, 캐릭터 살해가능 체크, 단서 kill chance 입력, 단서 생성 고급 설정 제거
  - backend 저장 검증까지 포함
- 권장 PR-2: runtime engine + voice 차단
  - 확률 판정, 살해 가능 대상 판정, kill 성공/실패 이벤트, 죽은 플레이어 음성 제한

이유: UI와 저장 계약은 제작자 경험을 빠르게 닫을 수 있지만, 런타임/음성 차단은 게임 중 권한과 재접속 상태에 영향을 줘 별도 검증 면이 크다.

## 브레인스토밍 필요 여부

- 구현 전 짧은 확인 1개가 필요하다.
- 결정: `살해 가능`은 캐릭터 상세의 `등장인물 유형` 체크박스 그룹에 포함한다.
- 저장 기본값: UI는 캐릭터 상세에 두고, 저장은 `modules.player_kill.config.killableCharacterIds`에 둔다.

## Deferred / Follow-up

- [ ] 살해 실패/성공 결과를 플레이어에게 어떻게 보여줄지 별도 플레이 화면 UX가 필요할 수 있다.
- [ ] NPC 살해가 실제 플레이어 음성 차단과 연결되지 않는 경우, NPC는 상태만 변경하고 voice 정책은 player-bound character에만 적용한다.
- [ ] 살해 기록, 감사 로그, GM override는 MVP에서 제외한다.
- [ ] 확률 판정의 seed/재현 가능 로그 정책은 운영 요구가 생기면 별도 이슈로 분리한다.
