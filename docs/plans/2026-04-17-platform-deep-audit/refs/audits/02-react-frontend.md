# Audit 02 — react-frontend (W2 draft)

> Primary 관점: Zustand 3-layer 경계, 컴포넌트 경계·prop drilling, React Router lazy 실효성, 파일 400/컴포넌트 150/함수 60 리밋, BaseAPI 상속, selector shape.
> 측정 시점: 2026-04-17. Baseline: `refs/shared/baseline.md` §2.

## Scope

- `apps/web/src/{stores,services,hooks,pages,features,shared,components}/**` production 코드.
- Zustand slice 경계(Connection/Domain/UI) + selector 사용 패턴 + Module Factory 독립성.
- React Router `lazy()` 적용 범위와 `GameChat`·`FriendsList`·`editor/api.ts` 등 한도 초과 파일.
- Service 계층: `services/api.ts` ApiClient + `services/profileApi.ts` + `features/*/api.ts` 직접 fetch 잔재.
- 제외: WCAG/Seed token(07), WS envelope·재접속(09), MSW handler(04/09). 다른 영역 징후는 `[cross:area]`.

## Method

- `wc -l` 전수 스캔 + 150/400/60줄 초과 식별 (Grep `output_mode=count` / Read 헤드).
- Grep: `fetch\(` · `lazy\(` · `useContext` · `persist\(` · `.getState()` · `shallow` · `use\w+Store\(` 호출 패턴.
- Zustand 스토어 13개 실측 (`apps/web/src/stores/*.ts`): layer 소속, selector 노출, 크로스 레이어 import.
- Service/API entrypoint 4종 읽음(`api.ts`, `profileApi.ts`, `editor/api.ts` 헤드, `features/auth/api.ts`).
- React Router lazy 38건 집계 (`App.tsx` 30 + `GamePage.tsx` 3 + `TabContent.tsx` 8 + 기타 3).

## Findings

### F-react-1: `GameChat.tsx` Domain 채팅 상태를 컴포넌트 로컬 `useState`로 이중 보유

- **Severity: P1**
- **Evidence**: `apps/web/src/features/game/components/GameChat.tsx:89-100` (9개 `useState`) vs `apps/web/src/stores/gameChatStore.ts:47-60` (`useGameChatStore`의 `messages`/`whisperMessages`/`addMessage` 전혀 import 안 됨), `apps/web/src/stores/gameMessageHandlers.ts:1-105` (chat 이벤트 미등록 → store에 써지는 경로 없음).
- **Impact**: Domain layer로 설계된 `gameChatStore`가 dead code. 실제 채팅은 컴포넌트가 `useWsEvent`로 직접 수신해 로컬 `useState`에 누적 → `GameChat` 언마운트(탭 전환·Suspense fallback) 시 히스토리 유실. 재접속·chat 스냅샷 재개 경로와도 어긋남. 파일도 150줄 컴포넌트 한도의 **2.8배(423줄)**.
- **Proposal**: (a) `gameChatStore`에 `addWhisper`·`addGroupMessage` slice 확장 후 WS 이벤트 구독은 `registerGameHandlers`로 이동(현재 chat·whisper·module event 전부 누락). (b) `GameChat`은 store selector만 사용하도록 축소(탭 UI·입력 UI 서브컴포넌트 추출 — `ChatTabNav`, `WhisperTargetPicker`(이미 존재) 재사용, `GroupCreatePanel` 신규).
- **Cross-refs**: `[cross:09]` ws-contract — `CHAT_MESSAGE`/`CHAT_WHISPER`/`MODULE_EVENT("groupMessage")`가 `gameMessageHandlers.ts`에 미등록, envelope 3자 드리프트 후보.

### F-react-2: `services/profileApi.ts` BaseAPI 우회 + 에러 RFC 9457 손실

- **Severity: P1**
- **Evidence**: `apps/web/src/services/profileApi.ts:6-29` — `fetch(\`${BASE_URL}/v1/profile/avatar\`, …)` 직접 호출. 401 자동 refresh, `ApiHttpError`(Problem Details) 파싱, `credentials: "include"` 기본값 전부 복제·누락. 에러 메시지는 `body?.detail ?? "…실패"` 문자열로 평탄화되어 `ApiError.code`·`status`·`type` 소실.
- **Impact**: (1) refresh token 자동 재시도가 동작 안 해 아바타 업로드 중 access token 만료 시 사용자가 재로그인해야 함. (2) GlobalErrorBoundary/ApiError 디스패처가 `ApiHttpError` 기반이라 avatar 업로드 실패는 error code 레지스트리·Sentry trace context 경로를 타지 않음. (3) multipart payload 용도의 BaseAPI 확장이 없다는 구조적 공백 → 동일 패턴 이탈 재생산 소지.
- **Proposal**: `ApiClient`에 `postForm<T>(path, formData, options)` 메서드를 추가해 `Content-Type` 자동 설정을 생략하고 `rawFetch` 경로만 공용화. `profileApi.uploadAvatar`는 `api.postForm(...)`으로 교체. `BaseUrl`·`BASE_URL` 중복 상수도 `services/api.ts`로 export 통일.
- **Cross-refs**: `[cross:05]` security — 평문 에러 문자열이 프론트에서 `toast.error(e.message)`로 그대로 노출되는지 여부는 security 영역에서 독립 판단.

### F-react-3: `features/editor/api.ts` 423줄 단일 파일 — 도메인 슬라이스 미분리

- **Severity: P1 (파일 크기 티어 초과 + 테마/캐릭터/단서/흐름 4 도메인 혼재)**
- **Evidence**: `apps/web/src/features/editor/api.ts` 총 423줄 (baseline §2 등록). Types 섹션만 `EditorThemeSummary`·`EditorThemeResponse`·`EditorCharacterResponse`·`CreateThemeRequest`·`UpdateThemeRequest`·`CreateCharacterRequest`·`UpdateCharacterRequest`·`CreateClueRequest`·`UpdateClueRequest` 등이 한 파일에 병렬 선언(1-119줄 확인), 이어서 `useQuery`/`useMutation` 훅이 동일 파일에서 혼재. 같은 editor feature 에 별도로 `flowApi`, `mediaApi`, `readingApi`, `imageApi` 파일이 이미 존재 → "도메인별 API + 배럴 re-export" 컨벤션은 인정되나 `api.ts`만 티어 초과.
- **Impact**: Phase 18.5 `routes_editor.go` 분할과 대칭이 안 맞는 상태. hooks 변경 시 re-render 스코프·tree-shake 경계 모호, MSW handler 작성 시 import 경로 추적 비용 증가. **400줄 초과 프로덕션 파일 3개 중 하나**(baseline §2) — 누적 리팩터 부채로 P1 승격.
- **Proposal**: `features/editor/api/` 디렉터리 신설 → `themes.ts` / `characters.ts` / `clues.ts` / `index.ts`(배럴) 분할. 기존 import path는 `@/features/editor/api` 유지(배럴). Types 분리는 선택(훅과 가까이 두어 colocation 유지 권장).
- **Cross-refs**: 없음.

### F-react-4: `FriendsList.tsx` 415줄 + 모달/확인/검색 혼재 — 컴포넌트 150줄 한도 2.8배

- **Severity: P1 (3개 한도 초과 프로덕션 파일 중 하나)**
- **Evidence**: `apps/web/src/features/social/components/FriendsList.tsx` 총 415줄 (baseline §2). `FriendRow`(46-)·`useState(showConfirm)`·검색 input·pending/friends 탭·remove 확인 모달이 한 파일에 병치. `useFriends`·`usePendingRequests`·`useSendFriendRequest`·`useAcceptFriendRequest`·`useRejectFriendRequest`·`useRemoveFriend` 6개 훅을 단일 컴포넌트에서 소비.
- **Impact**: 컴포넌트 150 한도 2.8배. 탭 전환이나 remove 모달 상태가 같은 렌더 트리를 무효화해 친구 목록 스크롤·타이핑 중 리렌더 빈번. 테스트 작성 시 mock 설정 비용 큼(`Social.test.tsx`가 이미 635줄로 확대됨 — baseline top1 테스트 파일).
- **Proposal**: `FriendsList` → `FriendsTabs`(탭 라우팅) + `FriendRow`(이미 내부 정의, 파일 분리) + `PendingRequestRow` + `RemoveFriendConfirm` + `SearchInput` 서브컴포넌트 분리. 각 ≤100줄 목표. data fetching은 container가 소유하고 presentational은 props.
- **Cross-refs**: `[cross:04]` test-engineer — `Social.test.tsx` 635줄 분할은 test 영역 draft.

### F-react-5: Connection layer가 Domain selector·setter를 직접 호출 — 경계 규약 위반

- **Severity: P1**
- **Evidence**: `apps/web/src/hooks/useGameSync.ts:69-110` — `useGameStore.getState().hydrateFromSnapshot`, `.setPhase`, `.addPlayer`, `.removePlayer`, `.resetGame`, 그리고 `getModuleStore(...).getState().setData/mergeData`를 한 훅에서 호출. `useWsClient` 콜러가 connection 상태를 받은 직후 바로 Domain store을 mutate. `stores/gameMessageHandlers.ts:44-103`에도 동일 패턴(`registerGameHandlers`가 `useGameSessionStore.getState`를 직접 참조)이 병렬 존재 — 즉 "Connection → Domain" 경유 규약이 hooks·stores 두 경로로 **중복**.
- **Impact**: 3-layer 원칙("레이어 간 직접 참조 금지, 반드시 action 경유")에서 요구하는 단일 접점(action/payload)이 부재. (1) 메시지 수신 로직이 `useGameSync.ts` 안 `useEffect`와 `gameMessageHandlers.ts` 양쪽에 있어 어느 쪽이 source of truth인지 불투명. (2) WS envelope이 추가되면 양쪽을 모두 수정해야 해 드리프트 가능. (3) 테스트에서 `useGameSessionStore.setState` mocking과 `getState` mocking 이중 sync 비용.
- **Proposal**: Domain store에 `applyWsEvent(event, payload)` 단일 action을 추가하고 `useGameSync`·`registerGameHandlers` 둘 중 하나로 구독 경로를 단일화. module store mutation도 `useGameSessionStore.applyModuleState(moduleId, settings)` 내부에서 `getModuleStore(moduleId).getState().setData(...)`를 감싸 외부 훅에서 `getModuleStore` 직접 접근을 제거.
- **Cross-refs**: `[cross:09]` ws-contract — envelope ↔ reducer 매핑 단일화는 ws-contract 공동 영역.

### F-react-6: Module Factory 스토어가 GC 없이 Map 캐시로 누적

- **Severity: P2 (경계: P1 후보 — 누수 재현 시나리오 확보 시 승격)**
- **Evidence**: `apps/web/src/stores/moduleStoreFactory.ts:28` `const moduleStores = new Map<string, StoreApi<ModuleStore>>();` 모듈 스토어 전역 Map. 83줄 `useStore(store, selector ?? ((s) => s as unknown as T))` — selector 없으면 전체 state 구독. `clearModuleStores()`(90-95)는 `resetGame` 시점이 아니라 `pages/GamePage.tsx` unmount 경로에서만 호출(GamePage.tsx:11-13 `clearModuleStores` import 확인).
- **Impact**: (1) 사용자가 `/game/:id` 라우트에서 강제 새로고침 대신 lobby로 soft-navigate해 GamePage가 unmount되면 clearModuleStores는 호출되지만, tab 간 빠른 세션 전환에서 동일 moduleId가 새 세션에서도 그대로 shared instance가 되어 **세션간 상태 누수** 가능. (moduleId가 전역이고 sessionId 네임스페이스 없음.) (2) `useModuleStore("x")` no-selector 호출 패턴이 있으면 전체 state를 매번 리렌더 — 현재 `GameChat.tsx:109`가 selector `(s) => s.data as GroupChatData`로 안전.
- **Proposal**: Factory 키를 `${sessionId}:${moduleId}`로 변경(가능하면 `getModuleStore(sessionId, moduleId)` 시그니처). `clearModuleStores`를 `useGameSessionStore.resetGame`의 마지막 스텝에 포함해 단일 진입점화. no-selector 오버로드에는 dev 경고를 넣어 사용 방지.
- **Cross-refs**: `[cross:03]` module-architect — 서버 측 Factory 세션 독립성(`session_id → module instance`)과 클라이언트 cache 키 일치 여부 확인 필요.

### F-react-7: `.getState()` 호출이 프로덕션 코드 16건 — React 외부 mutation 지점 분산

- **Severity: P2**
- **Evidence**: Grep `\.getState\(\)` → 프로덕션 16건(services 4, hooks 10, pages 1, stores 1). 특히 `hooks/useGameSync.ts`에서 10회 호출(69, 75, 81, 83, 90, 97, 103, 110, 117 + `useAuthStore.getState().user?.id`), `services/api.ts`에서 refresh flow 3회.
- **Impact**: `useSyncExternalStore` 없이 `getState()`로 snapshot을 읽어 action을 호출하는 경로가 많을수록 React 트리 밖에서 mutation이 일어나 DevTools 추적·테스트 mocking·StrictMode 이중 호출 복원이 복잡. 현재 `useAuthStore.getState`는 API client 내부 dynamic import로 circular 방지한 의도적 선택이라 허용범위지만, `useGameSync`의 집중도는 Domain action 네이밍(apply*)으로 흡수하는 편이 나음.
- **Proposal**: Domain action을 `apply*` 시리즈로 정리해 `useGameSync`가 `useGameSessionStore((s) => s.applyPhase)` 등 selector로 action reference만 구독하도록 리팩터(불필요한 `.getState()` 제거). 서비스·인증 레이어의 `.getState()`는 유지(circular 방지 의도 있음).
- **Cross-refs**: 없음.

### F-react-8: Zustand selector에 `shallow` 미사용 — 참조 타입 selector 위험

- **Severity: P2**
- **Evidence**: `shallow` / `zustand/shallow` import — Grep 결과 **0건**. 그러나 `gameSessionStore`는 `players: Player[]`, `modules: ModuleConfig[]`, `socialStore`는 `onlineFriends: Set<string>` 등 참조 기반 필드 다수. 현재 사용처는 `useGameStore((s) => s.players)` 단일 슬라이스라 ok지만, 신규 `useStore(shallow(...))` 기반 multi-field selector 도입 가능성 존재. `socialStore.setFriendOnline`(44-50) 등은 이미 `new Set(...)` 복사로 참조 불변성 보장.
- **Impact**: 현행 코드는 위험 없음(단일 필드 selector). 단 신규 기여자가 `const { a, b } = useXStore((s) => ({ a: s.a, b: s.b }))` 패턴을 도입하면 매 렌더 새 객체 → 무한 리렌더 가능. 가드레일 부재.
- **Proposal**: ESLint 커스텀 룰 또는 `docs/plans/2026-04-05-rebuild/refs/architecture.md` 가이드에 "multi-field selector 필요 시 `useStore(store, selector, shallow)` 강제" 추가. 현재 셀렉터를 교체할 필요는 없음.
- **Cross-refs**: `[cross:08]` docs-navigator — 가이드 문서 업데이트는 docs 영역.

### F-react-9: React Router lazy 적용은 양호하나 `GamePage` 내부 `Suspense` 경계가 부분적

- **Severity: P2**
- **Evidence**: Grep `lazy\(` 결과 38건 — `App.tsx` 30개 라우트 전부 lazy, `TabContent.tsx` 8개 editor 서브탭 lazy. 반면 `pages/GamePage.tsx:34-48`가 3개 컴포넌트(`GameHUD`/`PhaseTransition`/`GameChat`)를 lazy로 감싸지만, `GameChat`은 `isChatOpen` 토글과 무관하게 mount 시 즉시 chunk fetch(조건부 render는 flag로 제어). 초기 진입 시 3개 chunk가 병렬 fetch되어 First Contentful Paint 이점 제한적.
- **Impact**: FCP/TTI에 크게 영향은 없으나(이미 30개 페이지 lazy), lazy의 실효성이 감소. `GameChat`처럼 특정 플로우에서만 필요한 컴포넌트는 toggle 이후 mount(lazy render-on-demand)로 챙기면 chunk fetch 비용까지 지연 가능.
- **Proposal**: `GameChat`은 `{isChatOpen && <Suspense fallback=…><GameChat …/></Suspense>}` 패턴으로 toggle 후 mount. `PhaseTransition`도 현재 phase 전환 시에만 필요하면 동일 패턴. `GameHUD`는 상시 필요 → eager import 고려.
- **Cross-refs**: 없음.

### F-react-10: `UIStore`가 sidebar/modal만 관리 — 실제 전역 UI 상태 분산

- **Severity: P2**
- **Evidence**: `apps/web/src/stores/uiStore.ts` 전체 51줄. field = `sidebarOpen`, `activeModal: string | null` 뿐. 반면 voice overlay (`VoiceOverlay.tsx:51-54` `selectIsPanelOpen`·`selectCurrentChannel`)·voice bottom sheet(`VoiceBottomSheet.tsx:34-40`) 등 UI flag는 `voiceStore` 내부에 혼재. `GamePage.tsx:56 isChatOpen`은 컴포넌트 로컬. 즉 UI layer가 세 계층(uiStore / 도메인 store 혼재 / 컴포넌트 로컬)에 퍼져 있음.
- **Impact**: "UI 레이어는 컴포넌트 로컬 우선, 전역은 UI 레이어"라는 규약이 voice 기능부터 위배. 추후 키보드 단축키·command palette 등 cross-component UI 상호작용 확장 시 배치 기준 모호.
- **Proposal**: UI layer 정책을 `refs/architecture.md`에 "세션 간 유지되는 패널/모달 flag만 uiStore, 단일 기능 내부 UI flag는 domain store UI slice(예: `voiceStore.ui`)로 네이밍 규약 수립" 형태로 명시. 코드 이동은 Phase 19 감사 범위 외(기준부터 확정).
- **Cross-refs**: `[cross:08]` docs-navigator — 규약 문서 갱신.

## Metrics

- 프로덕션 TS/TSX 파일: 331 (baseline).
- 400줄 초과 프로덕션 파일: 3 (`GameChat.tsx` 423 · `editor/api.ts` 423 · `FriendsList.tsx` 415).
- 컴포넌트 150줄 초과(신뢰 기준: tsx 프로덕션, 테스트 제외): 상위 20개 중 15개 이상이 editor feature — 티어 초과 재고 대상.
- Zustand 스토어 개수: 13 (`stores/*.ts`).
- Connection layer: 1 (`connectionStore`). Domain: 8 (game/reading/social/voice/audio/theme/moduleFactory/chat). UI/auth 겸용: 2 (uiStore, authStore). 헬퍼 2 (gameSelectors, gameMessageHandlers).
- React Router lazy 적용: 30/30 페이지(App.tsx) + 11 서브컴포넌트. `Suspense` fallback: `App.tsx` 1개(루트) — 페이지별 boundary 없음(보완 여지).
- 직접 fetch 잔재: 프로덕션 3건(`services/api.ts` refresh · `services/profileApi.ts` avatar · `features/editor/imageApi.ts:87` presigned PUT · `features/audio/AudioManager.ts:57` media blob fetch). 이 중 auth refresh + S3 presigned + audio blob은 의도적 저수준 접근. `profileApi`만 BaseAPI 우회(F-react-2).
- `lazy()`/`Suspense` 조합 부족으로 in-viewport 전까지 지연 가능한 lazy 후보: `GamePage`의 3개(F-react-9).
- `shallow` import: 0 (F-react-8).
- `.getState()` 프로덕션 호출: 16 (F-react-7).
- `createContext`/`useContext` 프로덕션: 1 파일(`features/audio/audioOrchestratorContext.ts`) — Context 과용 없음. 양호.

## Advisor-Ask

1. Connection ↔ Domain 경계 규약을 `useGameSync` 단일 경로로 일원화할지, `gameMessageHandlers` 중심으로 일원화할지(F-react-5) — 테스트 전략까지 묶여 test-engineer 공조 필요.
2. `moduleStoreFactory` 캐시 키에 sessionId 네임스페이스를 도입할 경우(F-react-6) 서버 측 Factory 구조와의 대칭성(module-architect 영역) 확인 시점이 W3 이전인지 이후인지.
3. 파일 400 초과 3건(F-react-3·4, GameChat는 F-react-1로 포함)을 Phase 19 fix-wave에 즉시 포함할지, 별도 후속 Phase(19.x)로 미룰지 — 현재 스코프 범람 위험 평가 필요.
