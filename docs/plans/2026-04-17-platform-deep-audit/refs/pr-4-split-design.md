# PR-4 File Size Refactor Wave — 분할 설계 (index)

> Author: module-architect (Phase 19 W3 → Wave 3 준비)
> 대상 Finding: F-go-3 (P1, 500+ 초과 10건) · F-go-4 (P1, 함수 80+ 6건) · F-react-1 (P1, GameChat state 이중) · F-react-3 (P1, editor/api.ts 423) · F-react-4 (P1, FriendsList 415)
> Baseline: main @ 858a1fa (2026-04-17). baseline.md 수치와 실측(`wc -l`) 일치 확인 (reading 652, voting 639, hidden_mission 559, combination 543, trade_clue 532, accusation 515, social/service 759, ws/hub 649, editor/domain/service 505, GameChat 423, editor/api 428, FriendsList 415).

## 결론

원래 PR-4 (L, Med) 를 **2개 PR** 로 분할. 병렬 가능 (PR-4a/PR-4b 상이 파일 집합, import 경로 독립). Wave 3 내 동시 진행 가능.

| PR | Scope | 파일 수 | Size | Risk | Finding |
|----|-------|--------|------|------|---------|
| **PR-4a** | Go 모듈 6개 + social/ws/editor/domain 3개 분할 | 9 | **L** | **Med** | F-go-3·4 |
| **PR-4b** | TS editor/api.ts + GameChat + FriendsList 분할 | 3 | **M** | **Low** | F-react-1·3·4 |

원 PR-4 L 단일 머지 시 Go/TS 양 도메인 리뷰어 동시 요구 + cross-stack rebase 충돌 확률 증가 → 언어 경계로 먼저 가르고, Go 내부는 **모듈 분할 vs 도메인 인프라 분할**로 커밋을 나눈다.

## 문서 맵

- [refs/pr-4/current-state.md](pr-4/current-state.md) — 13 파일 실측 크기 + 섹션별 책임 맵
- [refs/pr-4/pr-4a-go-split.md](pr-4/pr-4a-go-split.md) — Go 9 파일 하위 패키지 분할 설계 (factory · 등록 패턴 유지)
- [refs/pr-4/pr-4b-ts-split.md](pr-4/pr-4b-ts-split.md) — TS 3 파일 배럴 re-export + 도메인 sub-files
- [refs/pr-4/execution-plan.md](pr-4/execution-plan.md) — 실행 순서 · 리스크 · 테스트 · 후속

## 분할 철학

### Go 모듈 (6개: reading · voting · hidden_mission · combination · trade_clue · accusation)

모든 모듈이 **`package xxx` 단일 파일 → `package xxx/` 디렉터리**로 승격.

**공통 레이아웃** (PR-2 split-design 의 "pr-2/" 서브디렉터리 패턴과 일치):

```
apps/server/internal/module/<category>/<module>/
├── module.go       # Module 인터페이스(Name/Init/Cleanup/HandleMessage dispatcher) + Factory + init() register + 컴파일 타임 assertion
├── config.go       # Config struct + Schema() (ConfigSchema 선언적 SSOT)
├── state.go        # internal state struct + BuildState / BuildStateFor / Save/Restore
├── handlers.go     # HandleMessage 분기 함수들 (handleX 각각)
├── reactor.go      # ReactTo / SupportedActions / OnPhaseEnter / OnPhaseExit (구현 모듈만)
└── events.go       # EventBus subscribe 콜백 (onX 핸들러, 해당 모듈만)
```

**Factory 서명 불변**: `engine.Register("<name>", func() engine.Module { return New<Name>Module() })` — blank import 경로만 `_ "github.com/.../module/<category>/<module>"` 로 1레벨 깊어진다. 기존 `_ "…/module/decision"` 단일 블랭크 import 가 session package 에서 사용되고 있는지 확인 필요(상위 패키지 init chain 확인 — pr-4/pr-4a-go-split.md §Blank Imports).

**싱글턴 금지 유지**: 모든 모듈은 여전히 `sync.RWMutex` + 세션별 Factory 생성. 디렉터리 분할은 파일 경계만 바꾸고 런타임 불변식(PhaseReactor 이벤트 순서, EventBus subscribe 타이밍) 은 100% 보존.

### Go 인프라 (3개: social/service.go 759 · ws/hub.go 649 · editor/domain/service.go 505)

각 파일은 **도메인 경계로 분할**하되 package 구조는 유지한다.

- `internal/domain/social/` → `friend_service.go` + `chat_service.go` + `types.go` + `helpers.go` (현재 2개 struct + helpers 혼재)
- `internal/ws/hub.go` → `hub.go` (struct + lifecycle) + `hub_broadcast.go` (Broadcast/Send/Whisper) + `hub_route.go` (Route dispatcher) + `hub_listeners.go` (notifyX / gc)
- `internal/domain/editor/service.go` → 이미 분할된 sibling (maps / clues / content / media) 와 동일 패턴으로 `service_theme.go` (Theme ops) + `service.go` (interface + constructor + shared helpers)

### TS 프론트 (3개)

- `features/editor/api.ts` → **배럴 re-export index** + `api/themes.ts` · `api/characters.ts` · `api/validation.ts` · `api/content.ts` · `api/module-schemas.ts` · `api/types.ts` 분할. sibling 파일 (editorClueApi / editorMapApi / flowApi / readingApi / mediaApi) 을 같은 `api/` 디렉터리로 흡수할지 여부는 **이번 PR 범위 외** (F-react-3 단독 해소만 목표).
- `features/game/components/GameChat.tsx` → `GameChat/` 디렉터리 + `index.tsx` (shell) + `GroupTab.tsx` + `WhisperTab.tsx` + `CreateGroupForm.tsx` + 공통 `useChatMessages.ts` (F-react-1: 로컬 state → **Zustand Domain layer 이동 후보** 지만, 상태 이동은 **PR-7 Zustand Action Unification** 와 conflict 가능 → PR-4b 는 파일 분할만 수행하고 state 모델 변경은 out-of-scope).
- `features/social/components/FriendsList.tsx` → `FriendsList/` 디렉터리 + `index.tsx` (shell + 탭 상태) + `FriendRow.tsx` + `PendingRow.tsx` + `AddFriendModal.tsx` + 공통 `constants.ts` (탭 타입).

## Finding → PR 매핑

| Finding | PR-4a | PR-4b | 비고 |
|---------|:----:|:----:|----|
| **F-go-3 500+ 10건** (P1) | 전체 | - | 10건 중 sqlc gen 없는 수동 파일만 대상 (6모듈 + 3인프라 = 9) |
| **F-go-4 함수 80+ 6건** (P1) | 2건 | - | `accusation.handleAccusationVote` (101) 는 PR-4a 안에서 `handlers.go/vote_tally.go` 로 분리 가능. `editor/RequestUpload·ConfirmUpload` 는 media sibling 이므로 **별도 follow-up** (이미 routes_editor_media.go 분할됨 → 재확인 필요). `coin/Purchase·Refund` · `room/CreateRoom` 은 **out of PR-4 scope** (domain 별 PR). |
| **F-react-1 GameChat state 이중** (P1) | - | 파일 분할만 | state 모델은 PR-7 범위. 여기선 컴포넌트 150줄 한도만 해소. |
| **F-react-3 editor/api.ts** (P1) | - | 전체 | 배럴 패턴으로 import 경로 무파괴 (`@/features/editor/api` 유지). |
| **F-react-4 FriendsList 415** (P1) | - | 전체 | 150줄 한도 초과 3 컴포넌트 합본 → 디렉터리 분할. |

## 실행 순서 요약

```
Wave 3 전반  → PR-4a (L, Med)   Go 9 파일, 단일 sweeping 커밋 지양, 카테고리별 3~4 커밋
Wave 3 전반  → PR-4b (M, Low)   TS 3 파일, Go 와 파일셋 disjoint 이므로 병렬 가능
Wave 3 후반  → PR-8 Module Cache Isolation (S) — PR-7 의존, PR-4 와 독립
```

Feature flag: **불요**. 파일 분할은 외부 공개 API / 패키지 경로 불변을 원칙으로 하며, Factory 서명·init() 등록·배럴 re-export 으로 caller 영향을 0 으로 만든다. blank import 경로만 1 case 추가 변경 (서버 main 에서 `_ "…/module/decision"` → `_ "…/module/decision/accusation" _ "…/module/decision/voting" _ "…/module/decision/hidden_mission"` 3줄로 확장) — `current-state.md` 에 exhaustive 리스트 첨부.

## 주요 리스크 TOP 3

1. **Go 모듈 디렉터리 승격 시 test 파일 package 재배치 누락** — 각 모듈은 `*_test.go` 를 10~20개 동반. `package decision` → `package voting` 전환 시 기존 "decision_test" 가 참조하던 private 심볼(예: `AccusationModule.timeNow`, `votingSavedState`) 접근이 깨질 수 있음. **완화**: 테스트는 `*_internal_test.go` 로 유지하고 package 를 새 이름으로 동반 변경. PR-4a 는 **test 파일 포함 diff** 로 단일 커밋 단위를 구성.

2. **blank import 누락으로 engine.Register 미호출 → 런타임 "unknown module" 500 에러** — 새 sub-package 를 서버 main 에서 import 하지 않으면 `init()` 이 돌지 않는다. **완화**: `cmd/server/main.go` (또는 `internal/module/register.go` 배럴) 에 **모든** 신규 경로를 한 번에 추가하는 커밋을 PR-4a 에 묶고, CI 에 `go test ./apps/server/internal/module/... -run TestRegistry_AllModulesRegistered` gate 추가 (PR-5 Coverage Gate 이후 활용).

3. **React 배럴 re-export 가 Vite tree-shake 을 저해** — `features/editor/api.ts` 가 18개 hook을 전부 re-export 하면 번들러가 사용 안 하는 훅을 drop 못할 위험. **완화**: 새 구조에서 배럴은 **types 전용 + 명시적 named re-export** 로 제한. 각 페이지는 `@/features/editor/api/themes` 처럼 **sub-path import** 를 권장. 단, 점진 migration 을 위해 레거시 `@/features/editor/api` 는 하위 호환 보존. 번들 크기는 `vite build --mode analyze` 로 PR-4b 전후 비교 필수(test plan 에 포함).

## 다음 단계 (PR-4 착수 전 확인 필요)

1. **phase_engine_test.go (580줄, 테스트 파일)** — 500줄 초과이지만 table-driven 테스트 + 16개 TestPhaseEngine_* 함수로 응집. CLAUDE.md "자동 생성 코드 예외 / 테스트 table-driven 데이터 제외" 규정에 따라 **예외 허용** (pr-4/current-state.md §3 에 예외 승인 기록).
2. **sqlc gen 5건(회계·에디터·소셜·방·단서 query 생성물)** 은 500 초과여도 리팩터 대상 아님. baseline §1 각주 확인 후 PR-4 scope 에서 제외 명시.
3. **`apps/server/cmd/server/routes_editor.go`** (backlog 언급 "editor/handler.go" 실체) 는 Phase 18.5 에서 이미 분할됨 (`routes_editor_flow/themes/media.go`). PR-4 는 이 파일 재확인만 하고 스킵.
4. **react-frontend-engineer 와 PR-7 conflict 조정**: PR-7 (Zustand Action Unification) 이 먼저 머지되면 GameChat 로컬 state 3개(`messages/whisperMessages/groupMessages`) 가 Domain store 로 이동된다. PR-4b 는 PR-7 머지 후 착수하여 이동된 state 기준으로 컴포넌트 분할.
5. **go-backend-engineer 에게 blank import 배럴 (internal/module/register.go) 존재 여부** 조회 → 없으면 PR-4a 에 신설 제안.

## 참조

- baseline: `refs/shared/baseline.md` §1 (Go 500+) §2 (TS 400+) §3 (함수 80+/60+)
- audit: `refs/audits/01-go-backend.md` F-go-3, F-go-4
- audit: `refs/audits/02-react-frontend.md` F-react-1, F-react-3, F-react-4
- 선행 분할 사례: `apps/server/cmd/server/routes_editor.go` → `routes_editor_{flow,themes,media}.go` (Phase 18.5, commit `1bc1f23`)
- Factory 패턴 SSOT: `apps/server/internal/engine/registry.go`, `apps/server/internal/engine/factory.go`
- 유사 PR split 사례: `refs/pr-2-split-design.md`
