# PR-4 Current State — 13 파일 실측 + 섹션 맵

> 모든 수치는 `wc -l` 직접 측정 (2026-04-18 main @ 858a1fa). baseline.md 대비 드리프트 ≤ 2줄 이내.

## 1. Go 모듈 (6건, 평균 573줄)

| 파일 | LOC | Interfaces 구현 | 주요 섹션 (함수 경계) | Handler 분기 수 |
|------|----:|-----------------|---------------------|:---:|
| `module/progression/reading.go` | **652** | Module · ConfigSchema · **PhaseHookModule** · PlayerAwareModule | Config + State (L1-102) / HandleVoiceEnded (L104-184) / HandleAdvance (L186-267) / Factory+Init (L269-332) / HandleMessage (L342-419) / PlayerLeft · PlayerRejoined (L421-514) / GetState · Wire (L516-578) / BuildState · Cleanup · Schema (L580-621) / PhaseHook stubs (L623-652) | 3 (advance/voice_ended/jump) |
| `module/decision/voting.go` | **639** | Module · **PhaseReactor** · ConfigSchema · GameEventHandler · WinChecker · SerializableModule · RuleProvider · PlayerAwareModule | Config + Factory (L1-103) / HandleMessage (L104-196) / ReactTo · SupportedActions (L197-251) / open·closeVoting (L217-271) / tallyResults (L273-339) / Schema (L341-360) / BuildState · BuildStateFor (L362-432) / Cleanup (L434-442) / Validate · Apply (L446-517) / CheckWin (L521-541) / Save·RestoreState (L543-605) / GetRules (L607-639) | 2 (cast/change) |
| `module/decision/hidden_mission.go` | **559** | Module · ConfigSchema · SerializableModule · WinChecker · RuleProvider · PlayerAwareModule | Config · Factory · Init + subscribe (L1-119) / HandleMessage (L121-222) / completeMission (L225-247) / onClueAcquired · onVoteCast · onClueTransferred (L249-323) / Schema · BuildState · BuildStateFor · Cleanup (L325-403) / Save·RestoreState (L405-485) / CheckWin (L487-527) / GetRules (L529-559) | 3 (report/verify/check) + 3 event subscribers |
| `module/crime_scene/combination.go` | **543** | Module · GameEventHandler · WinChecker · RuleProvider · SerializableModule · PlayerAwareModule | Config · Init + graph build (L1-147) / checkNewCombos + clue map helpers (L149-195) / HandleMessage (L197-262) / findCombo · inputIDsMatch · hasCompleted (L264-316) / snapshot · BuildState · Cleanup (L318-368) / Validate · Apply (L370-408) / CheckWin (L410-439) / GetRules (L441-458) / Save·RestoreState · BuildStateFor (L460-533) | 1 (combine) + evidence.collected subscriber |
| `module/cluedist/trade_clue.go` | **532** | Module · ConfigSchema · **PhaseReactor** · SerializableModule · PlayerAwareModule | Config + Factory (L1-99) / HandleMessage + payloads (L100-138) / handleTradePropose/Accept/Decline (L140-253) / handleShowRequest/Accept/Decline (L255-367) / ReactTo · SupportedActions (L369-395) / Schema · BuildState · BuildStateFor · Cleanup (L397-477) / Save·RestoreState (L479-533) | 6 (trade × 3 + show × 3) |
| `module/decision/accusation.go` | **515** | Module · ConfigSchema · GameEventHandler · WinChecker · **PhaseHookModule** · PlayerAwareModule | Config + Factory (L1-98) / HandleMessage (L100-120) / handleAccuse · handleAccusationVote (L122-262, 함수 한 개 101줄 — **F-go-4**) / handleReset (L264-275) / Schema · BuildState · Cleanup (L277-327) / Validate · Apply (L329-451) / CheckWin (L453-476) / PhaseHook + BuildStateFor (L478-515) | 3 (accuse/vote/reset) |

## 2. Go 도메인 인프라 (3건)

| 파일 | LOC | 주요 섹션 | Struct/Export 수 |
|------|----:|---------|---:|
| `domain/social/service.go` | **759** | validMessageTypes · interfaces (L1-53) / friendService impl (L55-329, 10 메서드) / chatService impl (L331-703, 9 메서드 + advisory lock helper) / requireMembership · buildChatRoomResponse · mapMembers · textToString (L705-759) | 2 services + 2 interfaces |
| `ws/hub.go` | **649** | Constants + Hub struct (L1-95) / SetRegistry · SetSessionSender (L97-107) / run event loop (L109-147) / removeClientLocked · Register · Unregister (L149-192) / JoinSession · isReconnectLocked · gcRecentLeftLocked · LeaveSession (L194-301) / Broadcast × 3 wrappers + core (L303-352) / ReplayToClient (L354-379) / SendToPlayer · Whisper (L381-416) / Route + isSystemType (L418-482) / 5 query helpers (L484-531) / RegisterLifecycleListener + notifyPlayerLeft/Rejoined (L533-610) / gcAllRecentLeft · Stop (L612-649) | 1 Hub + 1 listener pattern |
| `domain/editor/service.go` | **505** | Request/Response types (L26-111) / Service interface 22 메서드 (L113-163) / service struct + constructor (L165-180) / Theme ops 7 메서드 (L182-398) / shared helpers (getOwnedTheme · text/ptr converters · slugCleanRe · generateSlug · isUniqueViolation · toThemeResponse) (L400-505) | 1 interface + 1 impl + ≥7 helpers |

## 3. TS Frontend (3건)

| 파일 | LOC | 현재 구조 | 주요 책임 |
|------|----:|---------|---------|
| `features/editor/api.ts` | **428** | Types (L1-199) + Query Keys (L201-216) + Theme Q/M 8 hooks (L220-341) + Character Q/M 4 hooks (L345-412) + Module Schemas (L374-383) + sibling re-exports (L415-428) | React Query hooks 단일 진입점. Maps/Locations/Clues 는 이미 sibling 파일로 분리되어 배럴만 re-export. |
| `features/game/components/GameChat.tsx` | **423** | Types (L17-62) + sanitize helpers (L64-83) + GameChat component (L89-423, JSX 200+ 라인 포함) | 3 탭(all/whisper/group) + 3 로컬 state(messages/whisper/group) + WS subscribe × 3 + group 생성 inline UI. **컴포넌트 150줄 한도 2.8배** — 실제 JSX 렌더 영역 L225-421 = 196줄. |
| `features/social/components/FriendsList.tsx` | **415** | FriendRow sub-component (L46-112) + PendingRow (L126-167) + AddFriendModal (L178-223) + FriendsList main (L229-415, JSX 140줄) | 이미 3개 sub-component 존재하지만 **동일 파일 내 선언** → 150줄 한도 실제 위반은 `FriendsList` 컴포넌트 자체. |

## 4. 예외 판정 (분할 대상 아님)

| 파일 | LOC | 판정 근거 |
|------|----:|---------|
| `engine/phase_engine_test.go` | 580 | **테스트 파일** — CLAUDE.md "테스트 table-driven 데이터 카운트에서 제외" 규정 해당. 16개 TestPhaseEngine_* 함수 응집, 분할 시 helper 중복 발생. PR-4 scope 제외. |
| `db/sqlc/*.sql.go` 5건 (accounts · editor · social · rooms · clues) | 각 500~900 | **자동 생성** — 수정 대상 아님. baseline §1 각주 참조. |
| `cmd/server/routes_editor.go` | 253 (Phase 18.5 분할 후) | Phase 18.5 에서 `routes_editor_flow/themes/media.go` 로 이미 분할됨. 현재 500 미만. PR-4 scope 제외. |

## 5. 함수 80줄 초과 (F-go-4) — PR-4 내 다룰 범위

| 함수 | 파일 | LOC | PR-4 처리 |
|------|------|---:|---------|
| `handleAccusationVote` | `module/decision/accusation.go` | 101 (L164-262) | **PR-4a 포함** — accusation 모듈 분할 시 `tally.go` 로 수학 판정 로직(L203-239) 추출 → `handleAccusationVote` 60줄 이하로 축소 |
| `editor/RequestUpload` 89 · `editor/ConfirmUpload` 85 | `domain/editor/media_service.go` | - | **PR-4 scope 외** — 이미 별도 파일, 함수 내부 단순화는 에디터 follow-up PR 로 이관 |
| `coin/PurchaseTheme` 156 · `RefundTheme` 115 | `domain/coin/service.go` | - | **PR-4 scope 외** — domain 별 PR, backlog 재분류 |
| `room/CreateRoom` 83 | `domain/rooms/service.go` | - | **PR-4 scope 외** — 동일 |

## 6. Blank Import 영향 범위 (확인 완료 — `internal/module/register.go`)

현재 진입점: `apps/server/internal/module/register.go` — **카테고리 패키지만 blank-import** (8 카테고리):

```go
package module
import (
    _ "…/module/cluedist"
    _ "…/module/communication"
    _ "…/module/core"
    _ "…/module/crime_scene"
    _ "…/module/decision"
    _ "…/module/exploration"
    _ "…/module/media"
    _ "…/module/progression"
)
```

각 카테고리 패키지 파일들(`voting.go`, `accusation.go`, ...)이 같은 `package decision` 에 속해 있으므로 **단일 import 로 모든 모듈 init() 이 호출**되는 구조.

### 분할 후 유지 전략: **카테고리 내부 register.go 패턴**

모듈을 sub-package 로 승격하면 `package decision` 이 더 이상 init() 을 소유하지 않는다. 해결책 두 가지:

**A. 카테고리 패키지에 `register.go` 신설 (권장)**:

```go
// apps/server/internal/module/decision/register.go
package decision
import (
    _ "…/module/decision/accusation"
    _ "…/module/decision/voting"
    _ "…/module/decision/hidden_mission"
)
```

`internal/module/register.go` 는 **변경 없음**. 카테고리 경계는 현재 8건 그대로 유지, 내부만 2층 구조로 확장. 단일 PR diff minimal.

**B. 최상위 register.go 확장**: 모든 모듈을 개별 경로로 import. 8줄 → 29줄. diff 가 크고 새 모듈 추가 시마다 최상위 편집 강제.

**결정**: **A 패턴 채택**. PR-4a 각 모듈 디렉터리 승격 커밋 다음에 카테고리별 `register.go` 신설 커밋 1건씩 추가 (커밋 단위는 그대로 유지).

### PR-4a 영향 대상 카테고리 (6 모듈 → 4 카테고리)

| 카테고리 | 승격 대상 모듈 | 카테고리 내부 register.go 필요 | 기타 같은 카테고리 파일 (미승격) |
|----------|--------------|:---:|-----|
| `decision` | accusation · voting · hidden_mission | **필수** | (기타 decision 모듈 — 확인 필요) |
| `progression` | reading | **필수** | (기타 progression 모듈 — 확인 필요) |
| `crime_scene` | combination | **필수** | evidence · location (이미 sub-files 일 수 있음, pr-4a 착수 시 재확인) |
| `cluedist` | trade_clue | **필수** | starting_clue · round_clue · timed_clue · conditional_clue (동일 카테고리 다수, **함께 승격 여부 판단 필요** — 미승격 시 category 내 혼재 발생) |

**추가 판단 필요 (PR-4a 착수 전 go-backend-engineer 에게 질의)**: cluedist 에 5+ 모듈이 있다면 trade_clue 만 디렉터리 승격하면 **파일 1개 + 디렉터리 1개** 혼재 구조가 된다. 일관성을 위해 cluedist 전체 모듈을 같이 승격할지 결정. 시간 상 PR-4a 한 번에 몰지, 후속 PR 로 점진 이행할지도 같이 결정.
