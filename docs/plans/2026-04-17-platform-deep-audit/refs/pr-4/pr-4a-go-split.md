# PR-4a Go Split — 9 파일 하위 패키지 분할

> Scope: Go 6 모듈 + 3 인프라 파일. Size L. Risk Med.
> 선행 의존: 없음 (PR-7 Zustand 와 무관). PR-2/PR-3/PR-6 Wave 1·2 결과 반영 후 Wave 3 에서 착수.

## 1. 공통 분할 레이아웃 (6 모듈 공통)

기존 `apps/server/internal/module/<category>/<module>.go` (단일 파일) →
`apps/server/internal/module/<category>/<module>/` (디렉터리, package 이름 `<module>`).

```
<module>/
├── module.go        # Factory + init() + Name · Init · Cleanup · HandleMessage 스위치 + interface assertions
├── config.go        # Config struct + Schema() (ConfigSchema SSOT — 에디터가 읽는 단일 원본)
├── state.go         # 내부 state struct + BuildState · BuildStateFor · Save · RestoreState
├── handlers.go      # HandleMessage dispatch → handleX 함수들 (action 단위 분리)
├── reactor.go       # ReactTo · SupportedActions · OnPhaseEnter · OnPhaseExit (해당 인터페이스 구현 모듈만)
└── events.go        # EventBus Subscribe 콜백 (onClueAcquired 등, 해당 모듈만)
```

**패키지 경로 변경**: 상위 category (`decision`, `progression`, ...) 는 유지. 단, category 패키지가 다중 모듈을 담았던 기존 구조는 각 서브디렉터리로 쪼개진다.

**Factory 서명 불변**: `engine.Register("<name>", func() engine.Module { return New<Name>Module() })` 와 `var _ engine.Module = (*<Name>Module)(nil)` 컴파일 타임 assertion 유지. 리뷰어가 Factory 무파괴를 한눈에 확인할 수 있도록 `module.go` 최상단/최하단에 배치.

## 2. 모듈별 세부 맵

### 2.1 `reading.go` (652 → 6 파일)

| 파일 | 라인 예상 | 내용 (현재 라인 범위) |
|------|----:|---------|
| `module.go` | ~140 | Factory + Init (L269-332) + HandleMessage 라우팅 (L342-350, L415-418) + interface assertions (L642-648) + `init()` (L650-652) |
| `config.go` | ~80 | `readingConfig` · `readingLineConfig` (L55-70) + `Schema()` (L602-621) + `validAdvanceBy` · `resolveAdvanceBy` · `resolveVoiceID` (L72-102, L334-340) |
| `state.go` | ~170 | `readingStatus` const (L37-43) + `ReadingState` + `ReadingStateWire` (L45-53, L547-557) + `GetState` · `GetReadingStateWire` · `BuildState` · `BuildStateFor` · `Cleanup` (L516-599, L633-640) |
| `handlers.go` | ~140 | `HandleAdvance` (L186-267) + `HandleVoiceEnded` (L104-184) + legacy `HandleMessage` jump 분기 (L370-413) |
| `reactor.go` | ~70 | `OnPhaseEnter` · `OnPhaseExit` (L623-631) + `HandlePlayerLeft` · `HandlePlayerRejoined` (L421-514) |
| `events.go` | (없음) | reading 은 EventBus Subscribe 콜백 없음 → 파일 생성 스킵 |

### 2.2 `voting.go` (639 → 6 파일)

| 파일 | 라인 예상 | 내용 |
|------|----:|---------|
| `module.go` | ~70 | Factory + Init + HandleMessage dispatch (L52-117) + init() + assertions (L629-639) |
| `config.go` | ~60 | `VotingConfig` + `VoteResult` (L19-36) + `Schema` (L343-360) |
| `state.go` | ~180 | `votingState` · `votingSavedState` (L362-370, L545-552) + `BuildState` · `BuildStateFor` · `Cleanup` (L372-442) + `SaveState` · `RestoreState` (L554-605) |
| `handlers.go` | ~100 | `handleVoteCast` · `handleVoteChange` (L119-195) + payload types (L104-106) |
| `reactor.go` | ~130 | `ReactTo` · `SupportedActions` · `openVoting` · `closeVoting` · `tallyResults` (L199-339) |
| `events.go` | (없음) | voting 은 EventBus Subscribe 콜백 없음 |
| `rules.go` | ~30 | `GetRules` (L609-627) + `Validate` · `Apply` (GameEventHandler) (L446-517) — rules + game event handler 분리 |

> 예외: voting 은 WinChecker + RuleProvider + GameEventHandler 추가 인터페이스 때문에 7개 파일. 리뷰어 혼란 방지를 위해 `module.go` 상단 주석에 "7-file layout (has rules.go due to WinChecker/RuleProvider)" 명시.

### 2.3 `hidden_mission.go` (559 → 6 파일)

| 파일 | 라인 예상 | 주요 내용 |
|------|----:|---------|
| `module.go` | ~90 | Factory + Init (EventBus subscribe × 3) + HandleMessage dispatch + init + assertions |
| `config.go` | ~40 | `HiddenMissionConfig` · `Mission` + `Schema` |
| `state.go` | ~200 | `hiddenMissionState` · `hiddenMissionSavedState` + `BuildState` · `BuildStateFor` · `Save·RestoreState` · `Cleanup` |
| `handlers.go` | ~100 | `handleReport` · `handleVerify` · `handleCheck` · `completeMission` |
| `events.go` | ~100 | `onClueAcquired` · `onVoteCast` · `onClueTransferred` (L249-323) |
| `rules.go` | ~40 | `CheckWin` + `GetRules` |

### 2.4 `combination.go` (543 → 6 파일)

| 파일 | 라인 예상 | 주요 내용 |
|------|----:|---------|
| `module.go` | ~90 | Factory + Init(graph build) + HandleMessage dispatch + init + assertions |
| `config.go` | ~40 | `CombinationDef` · `CombinationConfig` (no Schema — 현재 없음, 필요시 추가) |
| `state.go` | ~180 | `combinationState` + `snapshot` + `BuildState` · `BuildStateFor` · `Save·RestoreState` · `Cleanup` |
| `handlers.go` | ~130 | `handleCombine` · `findCombo` · `inputIDsMatch` · `hasCompleted` + `checkNewCombos` + clue map helpers |
| `events.go` | ~30 | `evidence.collected` subscriber (현재 Init 인라인 lambda L122-144 → 이름 있는 메서드로 추출) |
| `rules.go` | ~70 | `Validate` · `Apply` · `CheckWin` · `GetRules` |

### 2.5 `trade_clue.go` (532 → 5 파일)

| 파일 | 라인 예상 | 주요 내용 |
|------|----:|---------|
| `module.go` | ~80 | Factory + Init + HandleMessage dispatch + init + assertions |
| `config.go` | ~50 | `TradeClueConfig` + `Schema` + `TradeProposal` · `ShowSession` types |
| `state.go` | ~150 | `tradeClueState` + `BuildState` · `BuildStateFor` · `Save·RestoreState` · `Cleanup` |
| `handlers.go` | ~230 | 6 handler 함수 (trade × 3 + show × 3) — 가장 큰 파일이지만 80줄 이하 함수들 모음이므로 수용 가능 |
| `reactor.go` | ~30 | `ReactTo` (ALLOW_EXCHANGE) + `SupportedActions` |

### 2.6 `accusation.go` (515 → 6 파일 + 함수 축소)

| 파일 | 라인 예상 | 주요 내용 |
|------|----:|---------|
| `module.go` | ~80 | Factory + Init + HandleMessage dispatch + init + assertions |
| `config.go` | ~50 | `AccusationConfig` · `Accusation` + `Schema` |
| `state.go` | ~70 | `accusationState` + `BuildState` · `BuildStateFor` · `Cleanup` |
| `handlers.go` | ~100 | `handleAccuse` · `handleAccusationVote` (50줄) · `handleReset` |
| `tally.go` | ~80 | **NEW** — `handleAccusationVote` 의 수학 판정 부분(L203-239) 을 `tallyVotes(counts, eligibleVoters) (expelled bool, guiltyPct int)` 로 추출 → **F-go-4 해소** |
| `reactor.go` | ~20 | `OnPhaseEnter` · `OnPhaseExit` |
| `rules.go` | ~110 | `Validate` · `Apply` · `CheckWin` |

## 3. 인프라 파일 분할 (3건)

### 3.1 `domain/social/service.go` (759 → 4 파일)

- `service.go` — interface 선언 + `validMessageTypes` + package doc (~80줄)
- `friend_service.go` — `friendService` struct + `NewFriendService` + 10 메서드 (SendRequest/Accept/Reject/RemoveFriend/ListFriends/ListPendingRequests/BlockUser/UnblockUser/ListBlocks) (~300줄)
- `chat_service.go` — `chatService` struct + `NewChatService` + 9 메서드 + `dmLockKey` (~320줄)
- `helpers.go` — `requireMembership` · `buildChatRoomResponse` · `mapMembers` · `textToString` (~60줄)

Package 경로 불변 (`internal/domain/social`). 외부 caller (route wiring) 영향 0. 기존 테스트는 `service_test.go` 유지하되, friend/chat 분리 원한다면 `friend_service_test.go` · `chat_service_test.go` 신설 (선택, 본 PR 범위).

### 3.2 `ws/hub.go` (649 → 4 파일)

- `hub.go` — constants + Hub struct + NewHub + SetRegistry/SetSessionSender + run event loop + removeClientLocked + Register/Unregister + Stop (~220줄, 핵심 lifecycle)
- `hub_session.go` — JoinSession · isReconnectLocked · gcRecentLeftLocked · gcAllRecentLeft · LeaveSession (~120줄)
- `hub_broadcast.go` — BroadcastToSession × 3 wrappers + broadcastToSession core + ReplayToClient + SendToPlayer + Whisper (~130줄)
- `hub_route.go` — Route + isSystemType + 5 query helpers (SessionClients/ClientCount/SessionCount/HasSession/SessionBuffer) (~100줄)
- `hub_listeners.go` — RegisterLifecycleListener + notifyPlayerLeft + notifyPlayerRejoined (~80줄)

모두 package `ws` 유지. `var _ ClientHub = (*Hub)(nil)` assertion 은 `hub.go` 에 유지.

### 3.3 `domain/editor/service.go` (505 → 3 파일)

- `service.go` — Service interface + service struct + NewService + 공유 helpers (getOwnedTheme · text/ptr converters · slugCleanRe · generateSlug · isUniqueViolation · toThemeResponse) (~170줄)
- `service_theme.go` — Theme ops 7 메서드 (CreateTheme/UpdateTheme/DeleteTheme/ListMyThemes/GetTheme/PublishTheme/UnpublishTheme/SubmitForReview) (~220줄)
- `types.go` — Request / Response struct 들 (CreateThemeRequest · UpdateThemeRequest · ThemeResponse · ThemeSummary · Character types) (~115줄)

이미 sibling 파일(`map_service.go`, `clue_service.go`, `location_service.go`, `media_service.go`, `content_service.go`, `flow_service.go`) 이 존재하는 패턴과 일치. **reviewer 는 "Theme ops 만 별도 파일로 뺌" 1줄로 diff 요약 가능**.

## 4. 테스트 영향

- 모든 `*_test.go` 는 해당 모듈의 신규 sub-package 로 이동. 예: `module/decision/voting_test.go` → `module/decision/voting/voting_test.go` (package `voting`).
- 기존 `package decision_test` black-box 테스트가 있으면 `package voting_test` 로 rename. 참조하는 internal 심볼이 있다면 `package voting` (white-box) 로 전환.
- `engine.Register` 가 test setup 에서 호출되는 케이스는 없음 확인 (SessionManager 가 registry lookup). PR-4a 는 main blank import 조정만.

## 5. 커밋 granularity 제안

> blank import 진입점은 이미 `apps/server/internal/module/register.go` 에 존재 (8 카테고리). 각 카테고리 내부에 **`register.go` 신설** (category-local blank imports) 하여 최상위 register.go 는 무변경.

1. `chore(phase-19): module/decision 내부 register.go + voting 디렉터리 승격 + Factory 불변 assertion`
2. `chore(phase-19): module/decision/hidden_mission 디렉터리 승격 + register.go 추가 import`
3. `chore(phase-19): module/decision/accusation 디렉터리 승격 + tally.go 함수 추출 (F-go-4)`
4. `chore(phase-19): module/progression 내부 register.go + reading 디렉터리 승격`
5. `chore(phase-19): module/crime_scene 내부 register.go + combination 디렉터리 승격`
6. `chore(phase-19): module/cluedist 내부 register.go + trade_clue 디렉터리 승격` (cluedist 타 모듈 일관성 판단은 current-state §6 결정 반영)
7. `refactor(phase-19): ws/hub 4파일 분할`
8. `refactor(phase-19): domain/social/service 4파일 분할`
9. `refactor(phase-19): domain/editor/service 3파일 분할 (sibling 패턴 일치 — service_theme.go 추가)`
10. `test(phase-19): registry_test.go — TestRegistry_AllCoreModulesRegistered (blank import 누락 탐지)`
11. `chore(phase-19): PR-4a 최종 wc -l 검증 + CLAUDE.md 한도 복귀 확인`

각 커밋은 `go build ./...` + `go test ./apps/server/internal/...` green. `gofmt`/`goimports`/`golangci-lint run` 통과. Wave 3 머지 전 Linear 하게 push → PR 1건.

**caveat**: editor 도메인은 **이미 sibling 분할된 상태**(`service.go` + `service_character.go` + `service_clue.go` + `service_config.go` + `service_location.go` + `service_validation.go` + `media_service.go` + `image_service.go` + `reading_service.go` + `clue_edge_service.go` + `types.go`). PR-4a §9 는 Theme ops 만 `service_theme.go` 로 분리하는 1-step 작업.
