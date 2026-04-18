# PR-4b TS Split — 3 파일 배럴 + 컴포넌트 분할

> Scope: 3 TS/TSX 파일 (`features/editor/api.ts` 428 · `features/game/components/GameChat.tsx` 423 · `features/social/components/FriendsList.tsx` 415). Size M. Risk Low.
> 선행 의존: PR-7 Zustand Action Unification 권장 (GameChat 로컬 state → Domain store 이동). PR-7 미완이면 PR-4b 는 **파일 분할만** 수행하고 state 모델 변경은 out-of-scope.

## 1. `features/editor/api.ts` → 배럴 + sub-files

### 1.1 제안 구조

```
features/editor/api/
├── index.ts            # 배럴 re-export (하위 호환)
├── types.ts            # 공용 Request/Response types (ThemeResponse · CharacterResponse · ...)
├── keys.ts             # editorKeys 객체 (Query Keys SSOT)
├── themes.ts           # Theme Q/M 8 hooks (useEditorThemes/useEditorTheme/useCreateTheme/.../useSubmitForReview/useUpdateConfigJson)
├── characters.ts       # Character Q/M 4 hooks
├── content.ts          # Content Q/M (useEditorContent · useUpsertContent)
├── validation.ts       # useValidateTheme
└── moduleSchemas.ts    # useModuleSchemas + ModuleSchemasResponse type
```

기존 sibling(`editorClueApi.ts` · `editorMapApi.ts` · `flowApi.ts` · `readingApi.ts` · `mediaApi.ts` · `templateApi.ts` · `imageApi.ts` · `editorConfigApi.ts` · `clueEdgeApi.ts`) 은 **이번 PR 에서 이동하지 않는다**. F-react-3 의 핵심은 `api.ts` 단일 파일 423줄 해소이므로 sibling 통합은 후속 PR로.

### 1.2 배럴 (index.ts) 예시

```typescript
// features/editor/api/index.ts (30줄 이내)
export * from "./types";
export { editorKeys } from "./keys";
export * from "./themes";
export * from "./characters";
export * from "./content";
export * from "./validation";
export * from "./moduleSchemas";

// 레거시 sibling re-exports (기존 유지)
export { useEditorClues, useCreateClue, useUpdateClue, useDeleteClue } from "../editorClueApi";
export type { UpdateMapRequest, CreateLocationRequest, UpdateLocationRequest } from "../editorMapApi";
export {
  useEditorMaps, useCreateMap, useUpdateMap, useDeleteMap,
  useEditorLocations, useCreateLocation, useUpdateLocation, useDeleteLocation,
} from "../editorMapApi";
```

**Import path 하위호환**: 기존 `import { useEditorThemes } from "@/features/editor/api"` 가 그대로 동작. 점진 migration 을 위해 새 페이지는 `@/features/editor/api/themes` 처럼 sub-path import 권장. 단, ESLint rule "no-barrel-import" 활성화는 **이번 PR 범위 외**.

### 1.3 Tree-shake 검증

PR-4b 머지 전후 `vite build --mode analyze` 실행하여 bundle size delta 비교. 배럴로 인해 번들이 5% 이상 증가하면 배럴을 **type-only re-export + 명시적 hook re-export** 로 제한. Test plan 에 포함.

## 2. `features/game/components/GameChat.tsx` → 디렉터리 분할

### 2.1 제안 구조

```
features/game/components/GameChat/
├── index.tsx                 # 최상위 shell. 탭 state + 레이아웃 + 현재 탭 렌더링 (~150줄)
├── AllChatPanel.tsx          # 전체 채팅 탭 (~60줄)
├── WhisperPanel.tsx          # 귓속말 탭 (대상 selector + 메시지 리스트) (~90줄)
├── GroupPanel.tsx            # 그룹 탭 (그룹 목록 + 선택된 그룹 메시지) (~100줄)
├── CreateGroupForm.tsx       # 그룹 생성 inline UI (멤버 체크박스 + 제출) (~80줄)
├── ChatInput.tsx             # Input + Send 버튼 (탭별 placeholder + disabled 로직) (~50줄)
├── useChatMessages.ts        # 3 useWsEvent 구독 + appendMessage 로직 모음 (~80줄)
└── types.ts                  # ChatPayload · WhisperPayload · GroupMessagePayload · GroupChatData · TabType (~40줄)
```

**공유 utilities**:
- `sanitizeChat` · `appendMessage` · `MAX_*` 상수 → `types.ts` 또는 `utils.ts` (별도 파일 대신 types.ts 하단에 두어 파일 수 최소화)

### 2.2 State 모델 — PR-7 과의 경계

현재 GameChat 은 `messages`/`whisperMessages`/`groupMessages` 3개 로컬 state 를 사용하며, 이는 **Domain 계층에서 관리되어야 할 상태**(F-react-1). PR-7 (Zustand Action Unification) 이 먼저 머지되어 `useChatStore` (Domain) 가 생기면 PR-4b 는 `useChatMessages.ts` hook 이 `useChatStore` 를 subscribe 하도록 설계. PR-7 이 나중이면 PR-4b 는 **로컬 state 그대로 유지** 하고 F-react-1 은 PR-7 범위로 이관.

### 2.3 Import path 하위호환

기존 `import { GameChat } from "@/features/game/components/GameChat"` 은 TypeScript 의 `moduleResolution: "bundler"` 덕분에 자동으로 `GameChat/index.tsx` 로 resolve. **호출자 변경 없음**.

## 3. `features/social/components/FriendsList.tsx` → 디렉터리 분할

### 3.1 제안 구조

```
features/social/components/FriendsList/
├── index.tsx              # 최상위 shell. 탭 state + 검색 + 목록 렌더링 (~150줄)
├── FriendRow.tsx          # 친구 row + 삭제 확인 Modal (~90줄, 기존 L46-112)
├── PendingRow.tsx         # 대기 중인 요청 row (~50줄, 기존 L126-167)
├── AddFriendModal.tsx     # 친구 추가 Modal (~70줄, 기존 L178-223)
├── FriendsTab.tsx         # 친구 목록 탭 (검색 + EmptyState + 리스트) (~70줄)
├── PendingTab.tsx         # 대기 요청 탭 (~50줄)
└── useFriendActions.ts    # handleRemove · handleAccept · handleReject (toast 포함) (~60줄)
```

### 3.2 변경점 요약

- 현재 이미 파일 내부에 `FriendRow` · `PendingRow` · `AddFriendModal` sub-component 선언 → 각각 별도 파일로 승격.
- 메인 `FriendsList` 컴포넌트(L229-415, 186줄)를 탭 분리 + 핸들러 훅 추출로 150줄 이하로 축소.
- 공용 `getNicknameColor` import 는 그대로 유지 (`@/shared/utils/nickname`).

### 3.3 Import path 하위호환

디렉터리 승격 + `index.tsx` 패턴이므로 `import { FriendsList } from "@/features/social/components/FriendsList"` 그대로 동작.

## 4. 테스트 영향

| 대상 | 현재 테스트 | 분할 후 |
|------|------|---------|
| editor/api | `editorConfigApi.test.ts` · `mediaApi.test.ts` · `readingApi.test.ts` (sibling) | 기존 테스트 유지. 새 `api/themes.test.ts` · `api/characters.test.ts` 작성 권장 (PR-4b scope 포함) |
| GameChat | 확인 필요 — `GameChat.test.tsx` 있다면 import path 만 수정 | 탭별 단위 테스트 추가 가능 (별도 PR) |
| FriendsList | 확인 필요 | 동일 |

MSW handler 는 현 파일 (`apps/web/src/mocks/handlers/editor.ts` 등) 구조 무파괴. `@/features/editor/api` 배럴이 유지되므로 handler 가 참조하는 type 경로 변경 없음.

## 5. 커밋 granularity 제안

1. `refactor(phase-19): editor/api 배럴 + sub-files 분할 (F-react-3)`
2. `refactor(phase-19): GameChat 디렉터리 분할 + 탭 컴포넌트 추출 (F-react-1 partial — 파일 분할만)`
3. `refactor(phase-19): FriendsList 디렉터리 분할 + 탭 컴포넌트 추출 (F-react-4)`
4. `chore(phase-19): PR-4b bundle size 검증 + `wc -l` 한도 복귀 확인`

각 커밋은 `pnpm lint` + `pnpm typecheck` + `pnpm test` + `pnpm build` green.

## 6. 번들 분석 체크리스트 (PR-4b Merge Gate)

- [ ] `pnpm build --mode analyze` 전후 비교 스크린샷 첨부 (PR 설명)
- [ ] `features/editor/api` import 사이트 grep 결과 (현재 vs PR-4b 후) — 외부 페이지 경로 변경 없음 확인
- [ ] `features/game/components/GameChat` 호출 사이트 grep — `import` 경로 불변 확인
- [ ] `features/social/components/FriendsList` 동일
- [ ] Storybook (있다면) 경로 업데이트
