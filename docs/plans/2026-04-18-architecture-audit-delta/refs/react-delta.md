# React Frontend Audit Delta — Phase 19 → 20 (2026-04-18)

> **Window:** `ba20344` → `23c925c` (Phase 20 clue-edges 정식 승격 #71~#78 + graphify 툴링 #79~#81)
> **Scope:** `apps/web/src/features/editor/**` + 간접 spot-check.
> **Baseline:** Phase 19 F-02 `docs/plans/2026-04-17-platform-deep-audit/refs/audits/02-react-frontend.md` (P1: 5, P2: 5).

---

## 1. Phase 19 F-02 Delta (해소·악화·무변화)

| ID | Severity | 상태 | 근거 (delta) |
|----|----------|------|-------------|
| F-react-1 GameChat 이중 상태 | P1 | **무변화** | `GameChat.tsx` 423줄 유지, `useGameChatStore/addMessage/addWhisper` import **0건** (Grep). gameChatStore는 여전히 dead code. delta에서 손대지 않음. |
| F-react-2 profileApi fetch 우회 | P1 | **무변화** | `apps/web/src/services/profileApi.ts` 미변경. `imageApi.ts:87` presigned PUT은 의도적 저수준 접근(유지). |
| F-react-3 editor/api.ts 423줄 | P1 | **부분 해소 → 여전히 P1** | 428줄(`wc -l`). Clue hooks → `editorClueApi.ts`(79), Map/Location hooks → `editorMapApi.ts`(127)로 추출 + 배럴 re-export. 단 **types 90+줄이 api.ts에 잔존**, theme/character hooks도 동거 → 티어(400) **5줄 초과**. 분할 방향은 옳음, 완결 필요. |
| F-react-4 FriendsList 415줄 | P1 | **무변화** | 미변경. |
| F-react-5 Connection↔Domain 경계 | P1 | **무변화** | `useGameSync.ts`/`gameMessageHandlers.ts` 이중 경로 그대로. delta 범위 밖. |
| F-react-6 moduleStoreFactory GC | P2 | **무변화** | 미변경. |
| F-react-7 `.getState()` 16건 | P2 | **개선** | 프로덕션 `.getState()` 보유 파일 11건(services 4, hooks 3, features 3, stores 1). editor delta는 신규 `.getState()` **0건**(useClueEdgeData는 selector 기반). |
| F-react-8 `shallow` 미사용 | P2 | **무변화** | `shallow` import **0건** (Grep). 신규 multi-field selector 없음 → 즉시 위험 없음. |
| F-react-9 GamePage lazy Suspense | P2 | **무변화** | delta 범위 밖. |
| F-react-10 UIStore 분산 | P2 | **무변화** | delta 범위 밖. |

**요약:** Phase 20은 editor 단일 도메인 focus라 F-02 전역 finding 대부분은 무변화. 유일한 positive delta는 **F-react-3 부분 해소**(clue/map/location API 파일 분할).

---

## 2. 신규 Finding (D-RF-N)

### D-RF-N1 · `features/editor/api.ts` 티어 여전히 초과 — 428줄 (P2)

- **Evidence:** `wc -l apps/web/src/features/editor/api.ts` = 428. Phase 19 때 423줄, 이후 `LocationResponse.from_round/until_round`, `ClueResponse.reveal_round/hide_round` 등 round 필드 추가로 순증.
- **Impact:** F-react-3이 제시한 "도메인별 API + 배럴 re-export" 패턴을 절반만 적용 — clue/map/location hooks는 이동했지만 types·theme·character hooks·module-schemas hook이 한 파일에 공존. 티어 규칙 관점에서는 여전히 위반 상태.
- **Proposal:** types만 `features/editor/types.ts`로 분리(배럴 re-export 유지) → 330줄대 복귀 예상. theme/character hook 분할은 선택 사항.
- **Cross-refs:** F-react-3 follow-up.

### D-RF-N2 · `ClueForm.tsx` native HTML `<textarea>`/`<select>`/`<input type="checkbox">` 사용 (P3-info)

- **Evidence:** `ClueForm.tsx:210-217`(textarea), `ClueFormAdvancedFields.tsx:92-98/160-165/218-223`(checkbox), `:184-195/205-215`(select), `:120-146`(round `<input type="number">`). `LocationRow.tsx:90-126`, `LocationsSubTab.tsx:113-173`(map/location picker buttons).
- **Impact:** **프로젝트 규칙 상 허용됨** — CLAUDE.md는 "글로벌 jittda-ui 규칙은 MMP v3에 적용되지 않음"을 명시, Tailwind 직접 사용 + `shared/components/ui/{Button,Input,Modal,Spinner}`만 공용 wrapper. 따라서 native 태그 허용. **단 `Input` wrapper는 있는데 `Textarea`/`Select`/`Checkbox`/`Switch` wrapper가 없어** 동일 스타일(border/bg/focus ring)을 파일마다 복붙(ClueFormAdvancedFields만 4회). 스타일 drift + a11y 속성(focus-visible ring-offset-slate-900) 누락 위험.
- **Proposal:** `shared/components/ui/Textarea.tsx` + `Checkbox.tsx` + `Select.tsx` 신설(현재 3개 파일에서 동일 tailwind 클래스 반복 → 공통화 우선순위 증가). 기존 `Input.tsx`와 동일 패턴으로 `label`·`error`·`className` prop 노출.
- **Cross-refs:** [cross:design-a11y] — a11y 영역과 공조 여지(디자인 시스템 추가 라운드).

### D-RF-N3 · `useClueEdgeData` 낙관적 업데이트 롤백 경로의 에러 코드 파싱 (P2)

- **Evidence:** `apps/web/src/features/editor/hooks/useClueEdgeData.ts:146-157` — `err.message?.includes("EDGE_CYCLE_DETECTED")`, `err.message?.includes("EDGE_INVALID_CRAFT_OR")`로 문자열 매칭. `clueEdgeApi.ts`는 `api.put<…>`만 사용(BaseAPI 경유 OK) → `ApiHttpError` 계열이지만 `err.message`는 Problem Details `title|detail` 문자열.
- **Impact:** RFC 9457 `code`·`type`·`status` 필드가 있는데 message substring으로 분기하면 (1) 백엔드가 detail 문구 바꾸면 UI 분기 깨짐, (2) 다국어 전환 시 즉시 붕괴. Phase 19 F-sec-4 대칭인 프론트 고장 지점.
- **Proposal:** `ApiHttpError.code`(또는 `problem.code`)를 `useClueEdgeData`에서 직접 참조. 에러 code 레지스트리 `shared/lib/error-codes.ts`에 `EDGE_CYCLE_DETECTED` / `EDGE_INVALID_CRAFT_OR` 상수 추가 + `isEdgeCycleError(err)` 헬퍼.
- **Cross-refs:** [cross:go-backend] 에러 코드 레지스트리 일치 / [cross:test] MSW handler에서 `code` 필드 stub 확인.

### D-RF-N4 · `useClueEdgeData` 서버 groups → local state effect dep 누락 주석으로 suppress (P3-info)

- **Evidence:** `useClueEdgeData.ts:112-115` `useEffect(() => { if (groups) setEdges(groupsToEdges(groups)); }, [groups])` + `// eslint-disable-next-line react-hooks/exhaustive-deps`.
- **Impact:** 낙관적 업데이트 중 `groups` 객체 referential identity 변화로 optimistic state 되돌림 가능. 현재 react-query 캐시가 `setQueryData`로 동기화되므로 실제 race 시나리오는 드물지만 lint suppress는 리팩터 내성이 낮음.
- **Proposal:** `setEdges` 추가(stable setter이므로 deps에 포함해도 안전) + `groupsToEdges`를 `useMemo`로 감싸고 `useEffect` 대신 `if (groups && snapshot !== prevSnapshot) setEdges(...)` 같은 명시적 비교. 또는 react-query의 `initialData` + selector 패턴으로 effect 자체 제거.
- **Cross-refs:** 없음.

### D-RF-N5 · `LocationsSubTab` role="button" div 중첩 — 내부 `<button>` 배치 (P2, a11y)

- **Evidence:** `LocationsSubTab.tsx:143-174` — `<div role="button" tabIndex={0}>` 안에 실제 `<button type="button">`(172줄, 삭제)를 stopPropagation으로 배치. 동일 패턴 `ClueCard.tsx:56-104`, `ClueListRow.tsx:18-58`.
- **Impact:** Nested interactive role은 WAI-ARIA 위반. 스크린리더에서 "button button" 중첩 발화, Tab 순서 혼란. 키보드 포커스가 div에 머물면 삭제 버튼에 도달하려면 Shift+Tab 필요.
- **Proposal:** outer는 `<div role="listbox option">` + 내부 삭제를 별도 `<Button>`으로 두거나, 카드 전체를 `<button>`으로 만들고 삭제는 카드 바깥 hover action으로 분리. MMP에 `shared/components/ui/Card` wrapper가 없어 디자인 시스템 공백.
- **Cross-refs:** [cross:design-a11y] 07 finding과 병합 후보.

### D-RF-N6 · `LocationRow` inline round input — optimistic rollback 패턴 반복 (P3-info)

- **Evidence:** `LocationRow.tsx:44-75` commitRounds + `onError: () => { toast.error; setFromRound(...); setUntilRound(...); }`. 동일 "mutate + on error rollback local state" 패턴이 `useClueEdgeData`(edge delete), `ClueForm`(image post-create) 등 3회 중복.
- **Impact:** 저장 실패 시 UI 되돌리기 로직이 각 컴포넌트에 흩어져 유지보수 비용 증가. 에러 메시지 문구 drift(이미 `"라운드 저장에 실패했습니다"` vs `"엣지 저장에 실패했습니다"` vs `"단서 수정에 실패했습니다"`)도 일관성 없음.
- **Proposal:** `features/editor/hooks/useOptimisticField.ts` — `{ value, setValue, commit }` + rollback 표준화. 또는 react-query `useMutation` `onMutate/onError` 패턴으로 통합(낙관적 업데이트 + context rollback). 도입은 후속 Phase.
- **Cross-refs:** 없음.

---

## 3. 파일 크기 위반 스캔 (Phase 20 delta 파일만)

| 파일 | 줄수 | 한도 | 상태 |
|------|------|------|------|
| `features/editor/api.ts` | **428** | 400 | **초과 (F-react-3 ongoing)** |
| `ClueForm.tsx` | 246 | 400 (file) / 150 (component) | component 한도 1.6배 — 서브컴포넌트(ClueFormImageSection, AdvancedFields) 이미 추출됨. 본체 form state 22개로 `useClueFormState` 훅 추출 여지 |
| `ClueFormAdvancedFields.tsx` | 239 | 400 / 150 | component 한도 1.6배 — 동일 native HTML 반복이 분량 차지(D-RF-N2 해소 시 ≤150줄 복귀 예상) |
| `LocationsSubTab.tsx` | 234 | 400 / 150 | component 한도 1.56배 — Map list / Location picker / Clue assign 세 섹션 inline |
| `useClueEdgeData.ts` | 197 | 400 / 60(func) | `useClueEdgeData` 훅 본체 ~100줄, 컴포넌트는 아님 → OK |
| `LocationRow.tsx` | 138 | 400 / 150 | OK (138 ≤ 150) |
| `clueEdgeApi.ts` | 62 | 400 | OK |
| `editorClueApi.ts` | 79 | 400 | OK |
| `editorMapApi.ts` | 127 | 400 | OK |
| `ClueEdgeGraph.tsx` | 108 | 400 / 150 | OK |
| `ClueCard.tsx` | 107 | 400 / 150 | OK |
| `ClueListRow.tsx` | 60 | 400 / 150 | OK |

**요약:** 신규 한도 초과 컴포넌트 **0**(모두 150줄 이하 권장선 내). `api.ts` 5줄 초과 1건은 F-react-3 후속.

---

## 4. Zustand 3-layer & API 패턴 준수

- **Connection/Domain 경계:** delta 파일 전부 react-query + `api.{get,post,put,deleteVoid}` 경유. Zustand store 직접 `.getState()` 호출 **0건**. 신규 경계 위반 없음.
- **BaseAPI 상속:** `clueEdgeApi.ts:43/57`, `editorClueApi.ts:15/27/59/69`, `editorMapApi.ts:40/52/62/71/87/99/112/121` 모두 `api.*` 싱글턴(ApiClient/BaseAPI) 사용. 직접 `fetch(` **0건**.
- **lucide-react 전용:** delta 파일 아이콘 수입 — `ChevronDown`(ClueFormAdvancedFields), `Loader2`(ClueEdgeGraph), `MapPin, Trash2`(LocationRow), `Map, Plus, Trash2`(LocationsSubTab), `Trash2, Image`(ClueCard), `Trash2`(ClueListRow), `LayoutList, GitBranch`(CluesTab). `react-icons`/`@heroicons` 수입 **0건** (Grep). 준수.
- **native HTML (MMP 규칙):** 허용 범위. 단 D-RF-N2에 명시된 wrapper 공백으로 스타일 drift 누적.

---

## 5. graphify Insight (apps/web/features/editor)

- **Community 14 "Editor Module Tabs"** (81 nodes) — `ActionListEditor`, `BranchNode`, `CharacterAssignPanel` 등 editor 서브탭 대부분. `ClueForm`·`ClueFormAdvancedFields`·`ClueFormImageSection`는 hyperedge **"ClueForm composes image + advanced field sub-components"**(신뢰 1.00, EXTRACTED)로 잡혀 있어 서브컴포넌트 추출 의도가 그래프에도 반영됨 — F-react-3 분할 성과 확증.
- **Community 21 "Characters Tab (Editor)"** (65 nodes) — `CharacterCard/Form/ListTab/CharactersTab.test`에 `ClueCard`, `clueEdgeApi`가 같이 잡혀 있음. Clue 기능이 Character 커뮤니티로 섞인 것은 `api.ts` 단일 파일에 import 집중되어 AST extraction이 한 덩어리로 본 결과 → D-RF-N1 분할 후 재-graphify 시 커뮤니티 재정렬 기대.
- **Community 26 "Clue Interaction & Editor API"** (48 nodes) — `CluePanel`, `editor api.ts`, `editor constants.ts` 등 게임 런타임 Clue UI와 editor api가 같은 커뮤니티. 런타임↔에디터 경계가 `api.ts` 파일을 허브로 공유하는 구조라는 힌트 — types 분리(D-RF-N1 proposal)가 커뮤니티 경계 해소에도 기여.
- **Hyperedge "ClueEdgeGraph graph components: ClueNode + RelationEdge"** (EXTRACTED 1.00) — 정식 승격된 ClueEdgeGraph가 graph에 정식 구성원으로 등록. 이전 ClueRelationGraph hyperedge는 이미 `Clue Edges E2E Test Suite` 하위로 편입(graph update 이후).
- **God nodes 상위 10개는 모두 Go 계열(`New()`, `unlock()`, `Queries` 등)** — 프론트 단일 파일에 과도 집중된 허브 없음. `editor/api.ts` 자체는 react-query 훅 허브지만 god node 임계점(≥97 edges)에는 못 미침.
- **Surprising connections에서 editor 관련 관계는 c6-autosave-validation → SchemaDrivenForm(INFERRED)** 1건만. delta 범위에서 새로 생긴 구조적 놀람은 없음.

---

## 6. 우선순위 제안 (Phase 21 or cleanup candidates)

| Priority | Finding | 근거 | 제안 wave |
|----------|---------|------|-----------|
| **P1** | F-react-3 완결 (D-RF-N1) — `api.ts` types 분리 | 여전히 티어 5줄 초과, 분할 방향 절반 완료 | W0 quick-win (≤30min) |
| **P1** | D-RF-N3 — `ApiHttpError.code` 기반 에러 분기 | 다국어/메시지 변경에 깨지는 UI 분기, F-sec-4와 프론트 대칭 | W1 go-backend와 공조 |
| **P2** | D-RF-N5 — nested interactive role a11y | WAI-ARIA 위반 3곳(ClueCard, ClueListRow, LocationsSubTab) | W2 design-a11y 통합 |
| **P2** | D-RF-N2 — `Textarea/Select/Checkbox` UI wrapper | native 허용이지만 스타일 drift 방지 + advanced fields 컴포넌트 150줄 이하 복귀 | W2 (W3 fix-loop 전) |
| **P3** | D-RF-N4 — useEffect exhaustive-deps 정리 | lint suppress 제거, optimistic rollback 안정성 | W3 cleanup |
| **P3** | D-RF-N6 — optimistic rollback 헬퍼 통합 | 중복 3건, 문구 drift | W3 cleanup |

---

## 7. 종료 메트릭

- **총 발견:** **6건** 신규 + Phase 19 F-02 10건 중 **1건 부분 해소** (F-react-3 clue/map/location 추출)
- **신규 P0:** **0건**
- **신규 P1:** **2건** (D-RF-N1 api.ts 완결, D-RF-N3 ApiHttpError.code 기반 분기)
- **신규 P2:** **2건** (D-RF-N2 UI wrapper 공백, D-RF-N5 nested interactive)
- **신규 P3-info:** **2건** (D-RF-N4 effect deps, D-RF-N6 rollback 중복)
- **파일 티어 초과:** 1건(`editor/api.ts` 428줄, 기존 finding 연장)
- **컴포넌트 150줄 초과(신규):** 0건(advanced fields/form/locations-subtab는 native HTML 반복으로 줄 수 올라간 구조적 배경, D-RF-N2 해소 시 감소)
- **connection/domain 경계 위반 신규:** 0건
- **BaseAPI 우회:** 0건
- **lucide-react 외 아이콘:** 0건

**1줄 요약:** Phase 20 delta는 F-react-3 방향으로 clue/map/location API를 분리해 **부분 해소**했으나 api.ts 본체는 여전히 티어 초과(428/400), 신규로는 **RFC 9457 code 미활용(D-RF-N3)** 과 **native `<input>`/`<textarea>`/`<select>` wrapper 공백(D-RF-N2)** 이 P1/P2로 승격될 만한 품질 신호. 신규 P0 없음.
