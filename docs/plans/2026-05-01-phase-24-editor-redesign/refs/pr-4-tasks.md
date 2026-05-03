# Phase 24 PR-4 — 페이즈 + 결말 Entity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 Flow 편집 화면을 Phase 24 entity 체계에 맞게 정리하고, 결말 목록 탭을 별도 entity 화면으로 추가한다.

**Architecture:** 페이즈는 다른 entity처럼 단순 좌측 리스트로 만들지 않고 기존 React Flow 기반 `FlowCanvas`를 유지한다. 대신 선택 노드 편집 패널을 모바일 친화적 세로 흐름과 제작자 친화 문구로 정리하고, 결말 노드는 별도 결말 entity 목록과 1:1로 연결할 수 있는 경계를 만든다. 결말 분기 매트릭스는 PR-5 범위이므로 이번 PR은 목록/콘텐츠/Flow 노드 연결까지만 구현한다.

**Tech Stack:** React 19, TypeScript, Vite, TanStack Query, React Flow, Tailwind CSS, Vitest + Testing Library, Playwright E2E, Go editor flow API는 기존 `flow_nodes`/`flow_edges`를 재사용한다.

---

## 1. 범위와 비범위

### 포함

- 페이즈 entity 화면: 기존 `FlowSubTab`/`FlowCanvas`를 Phase 24 표현으로 정리한다.
- 페이즈 노드 편집: 기본 정보, 시간/라운드, 자동 진행, 액션 편집을 제작자가 이해하기 쉬운 이름으로 유지한다.
- 결말 entity 목록 탭: Flow의 `ending` 노드들을 목록/상세 형태로 보여주고 라벨·아이콘·색상·공개 설명·결말 본문 Markdown 저장 경계를 제공한다.
- `EndingNodePanel`에서 Phase 24 결정과 충돌하는 “점수 배율” UI를 제거한다. 모든 결말 점수 배율은 1.0 고정이다.
- Flow 결말 노드와 결말 entity 상세가 같은 `flow_node.id`를 기준으로 동작하도록 한다.
- 모바일에서는 세로 흐름, 데스크톱에서는 Flow + 상세 패널 2열을 유지한다.
- 테스트: 페이즈/결말 focused unit + E2E smoke + typecheck/lint.

### 제외

- 결말 분기 질문/매트릭스 UI와 평가기: PR-5.
- 신규 DB 테이블 기반 ending CRUD: 이번 PR은 기존 `flow_nodes(type='ending')`를 entity source로 사용한다.
- 게임 종료 화면의 결말/점수 breakdown: PR-5 또는 런타임 후속 PR.
- 복잡한 모듈 설정 폼 자동 생성: PR-4에서는 섹션 경계와 기본 저장만 만든다.

## 2. 파일 구조

### 생성

- `apps/web/src/features/editor/components/design/EndingEntitySubTab.tsx`
  - 결말 목록 탭 컨테이너. Flow graph에서 ending node만 추출해 목록/상세를 렌더링한다.
- `apps/web/src/features/editor/components/design/EndingEntityDetail.tsx`
  - 결말 라벨, 아이콘/색상, 짧은 공개 설명, Markdown 본문 입력 UI.
- `apps/web/src/features/editor/components/design/__tests__/EndingEntitySubTab.test.tsx`
  - 결말 목록/빈 상태/선택/저장 동작 테스트.
- `apps/web/e2e/editor-phase-ending.spec.ts`
  - 에디터 디자인 탭에서 Flow와 결말 목록을 확인하는 smoke 테스트.

### 수정

- `apps/web/src/features/editor/components/design/FlowSubTab.tsx`
  - 상단에 “페이즈 흐름” 설명과 결말 목록 탭 진입 UI를 추가하거나 `DesignTab` 탭 구조에 맞게 분리한다.
- `apps/web/src/features/editor/components/design/FlowCanvas.tsx`
  - 모바일에서 Flow와 상세 패널이 세로로 쌓이도록 반응형 class를 조정한다.
- `apps/web/src/features/editor/components/design/NodeDetailPanel.tsx`
  - 삭제 버튼 문구와 빈 상태 문구를 제작자 친화적으로 정리한다.
- `apps/web/src/features/editor/components/design/PhaseNodePanel.tsx`
  - Phase 24 페이즈 entity 문구와 섹션 구분을 추가한다.
- `apps/web/src/features/editor/components/design/EndingNodePanel.tsx`
  - 점수 배율 입력 제거, `icon`/`color`/`contentKey` 저장 필드 추가.
- `apps/web/src/features/editor/flowTypes.ts`
  - `FlowNodeData`에 `icon`, `color`, `endingContent` 또는 `contentKey` 타입 필드 추가.
- `apps/web/src/features/editor/components/design/__tests__/EndingNodePanel.test.tsx`
  - 점수 배율 제거와 새 필드 저장 테스트 갱신.
- `apps/web/src/features/editor/components/design/__tests__/FlowSubTab.test.tsx`
  - 페이즈/결말 안내 문구 또는 탭 표시 테스트 갱신.
- `docs/plans/2026-05-01-phase-24-editor-redesign/checklist.md`
  - PR-4 상세 task 링크 상태 갱신.

## 3. 데이터 원칙

- 결말 entity의 1차 source는 `flow_nodes` 중 `type === "ending"`인 노드다.
- `label`, `description`, `icon`, `color`는 `flow_nodes.data`에 저장한다.
- 결말 본문 Markdown은 이번 PR에서 `flow_nodes.data.endingContent`로 시작한다. 추후 런타임 공개/다국어가 필요하면 `theme_contents` 기반 typed content로 옮길 수 있도록 `EndingEntityDetail` 내부 handler 경계를 분리한다.
- `score_multiplier`는 UI에서 제거하고, 기존 데이터에 값이 있어도 표시하지 않는다. PR-5 평가에서도 결말 배율은 1.0으로 취급한다.

## 4. 작업 순서

### Task 1 — 계획/기준선

- [x] **Step 1:** 새 worktree 생성

```bash
git worktree add .worktrees/phase-24-pr-4-phase-ending -b feat/phase-24-pr-4-phase-ending main
```

- [ ] **Step 2:** focused baseline 테스트 실행

```bash
pnpm --dir apps/web exec vitest run \
  src/features/editor/components/design/__tests__/FlowSubTab.test.tsx \
  src/features/editor/components/design/__tests__/FlowCanvas.test.tsx \
  src/features/editor/components/design/__tests__/PhaseNodePanelDebounce.test.tsx \
  src/features/editor/components/design/__tests__/EndingNodePanel.test.tsx
```

Expected: PASS. 실패하면 구현 전에 원인을 기록하고 기존 실패/신규 실패를 구분한다.

### Task 2 — 결말 entity 상세 테스트 RED

- [ ] **Step 1:** `EndingEntitySubTab.test.tsx`에 빈 상태와 목록 선택 테스트를 작성한다.
- [ ] **Step 2:** 테스트를 실행해 `EndingEntitySubTab` 미정의 실패를 확인한다.
- [ ] **Step 3:** `EndingEntitySubTab.tsx`와 `EndingEntityDetail.tsx` 최소 구현으로 테스트를 통과시킨다.
- [ ] **Step 4:** 결말 노드가 없을 때 “Flow에서 결말 노드를 추가하면 이곳에서 결말 내용을 작성할 수 있어요.” 문구가 보이게 한다.
- [ ] **Step 5:** Commit

```bash
git add apps/web/src/features/editor/components/design/EndingEntitySubTab.tsx \
  apps/web/src/features/editor/components/design/EndingEntityDetail.tsx \
  apps/web/src/features/editor/components/design/__tests__/EndingEntitySubTab.test.tsx
git commit -m "feat(editor): add ending entity list tab"
```

### Task 3 — EndingNodePanel Phase 24 정합성

- [ ] **Step 1:** `EndingNodePanel.test.tsx`에 “점수 배율 입력이 보이지 않는다” 테스트를 추가한다.
- [ ] **Step 2:** 테스트 실패를 확인한다.
- [ ] **Step 3:** `EndingNodePanel.tsx`에서 점수 배율 입력을 제거하고 아이콘/색상/설명 필드를 유지한다.
- [ ] **Step 4:** `FlowNodeData` 타입에 `icon?: string`, `color?: string`, `endingContent?: string`를 추가한다.
- [ ] **Step 5:** focused 테스트 통과 확인 후 commit.

```bash
pnpm --dir apps/web exec vitest run src/features/editor/components/design/__tests__/EndingNodePanel.test.tsx
git add apps/web/src/features/editor/components/design/EndingNodePanel.tsx apps/web/src/features/editor/flowTypes.ts apps/web/src/features/editor/components/design/__tests__/EndingNodePanel.test.tsx
git commit -m "fix(editor): align ending node fields with phase 24"
```

### Task 4 — 페이즈 Flow 반응형/문구 정리

- [ ] **Step 1:** `FlowCanvas.test.tsx` 또는 `FlowSubTab.test.tsx`에 모바일 세로 레이아웃 기준 class/문구 테스트를 추가한다.
- [ ] **Step 2:** `FlowCanvas.tsx`의 본문을 `flex-col lg:flex-row`로 조정하고 상세 패널 폭을 모바일 `w-full`, 데스크톱 `lg:w-72`로 조정한다.
- [ ] **Step 3:** `FlowSubTab.tsx` 상단에 제작자용 안내를 추가한다: “페이즈는 게임 진행 순서를 화살표로 연결합니다.”
- [ ] **Step 4:** `NodeDetailPanel.tsx` 빈 상태/삭제 문구를 제작자 친화적으로 바꾼다.
- [ ] **Step 5:** focused 테스트 통과 후 commit.

```bash
pnpm --dir apps/web exec vitest run \
  src/features/editor/components/design/__tests__/FlowSubTab.test.tsx \
  src/features/editor/components/design/__tests__/FlowCanvas.test.tsx \
  src/features/editor/components/design/__tests__/NodeDetailPanel.test.tsx
git add apps/web/src/features/editor/components/design/FlowSubTab.tsx \
  apps/web/src/features/editor/components/design/FlowCanvas.tsx \
  apps/web/src/features/editor/components/design/NodeDetailPanel.tsx \
  apps/web/src/features/editor/components/design/__tests__/FlowSubTab.test.tsx \
  apps/web/src/features/editor/components/design/__tests__/FlowCanvas.test.tsx \
  apps/web/src/features/editor/components/design/__tests__/NodeDetailPanel.test.tsx
git commit -m "refactor(editor): polish phase flow entity layout"
```

### Task 5 — DesignTab 연결

- [ ] **Step 1:** 현재 `DesignTab`의 하위 탭 구조를 확인한다.
- [ ] **Step 2:** 페이즈/결말 접근이 같은 디자인 영역에서 가능하도록 결말 탭을 추가한다. 기존 탭 이름은 비개발자 기준으로 유지한다.
- [ ] **Step 3:** `DesignTab.test.tsx`에 결말 탭 진입 테스트를 추가한다.
- [ ] **Step 4:** focused 테스트 통과 후 commit.

```bash
pnpm --dir apps/web exec vitest run src/features/editor/components/design/__tests__/DesignTab.test.tsx src/features/editor/components/design/__tests__/EndingEntitySubTab.test.tsx
git add apps/web/src/features/editor/components/DesignTab.tsx apps/web/src/features/editor/components/design/__tests__/DesignTab.test.tsx apps/web/src/features/editor/components/design/EndingEntitySubTab.tsx
git commit -m "feat(editor): wire ending entity tab into design editor"
```

### Task 6 — E2E smoke

- [ ] **Step 1:** `apps/web/e2e/editor-phase-ending.spec.ts` 작성.
- [ ] **Step 2:** mock/stub 기반으로 에디터 디자인 탭 진입 → 페이즈 Flow 안내 표시 → 결말 탭 빈 상태 또는 결말 목록 표시를 검증한다.
- [ ] **Step 3:** chromium focused E2E 실행.

```bash
pnpm --dir apps/web exec playwright test e2e/editor-phase-ending.spec.ts --project=chromium
```

- [ ] **Step 4:** Commit.

```bash
git add apps/web/e2e/editor-phase-ending.spec.ts
git commit -m "test(editor): cover phase and ending entity smoke"
```

### Task 7 — 최종 검증/PR

- [ ] **Step 1:** focused unit test 실행.

```bash
pnpm --dir apps/web exec vitest run \
  src/features/editor/components/design/__tests__/FlowSubTab.test.tsx \
  src/features/editor/components/design/__tests__/FlowCanvas.test.tsx \
  src/features/editor/components/design/__tests__/NodeDetailPanel.test.tsx \
  src/features/editor/components/design/__tests__/PhaseNodePanelDebounce.test.tsx \
  src/features/editor/components/design/__tests__/EndingNodePanel.test.tsx \
  src/features/editor/components/design/__tests__/EndingEntitySubTab.test.tsx \
  src/features/editor/components/design/__tests__/DesignTab.test.tsx
```

- [ ] **Step 2:** typecheck/lint 실행.

```bash
pnpm --dir apps/web typecheck
pnpm --dir apps/web exec eslint src/features/editor/components/DesignTab.tsx src/features/editor/components/design apps/web/e2e/editor-phase-ending.spec.ts
```

- [ ] **Step 3:** diff whitespace 검사.

```bash
git diff --check
```

- [ ] **Step 4:** PR 전 코드리뷰 수행. 타당한 지적만 반영한다.
- [ ] **Step 5:** PR 생성. 제목/본문은 한국어로 작성하고, `ready-for-ci` 라벨은 CodeRabbit/Codecov 검토 후에만 붙인다.

## 5. 완료 조건

- [ ] 페이즈 탭은 기존 Flow 편집 기능을 잃지 않고 Phase 24 안내/반응형 레이아웃을 제공한다.
- [ ] 결말 목록 탭에서 ending 노드 목록을 보고 상세 내용을 편집할 수 있다.
- [ ] 제작자 화면에 점수 배율처럼 정책상 제거된 항목이 보이지 않는다.
- [ ] 결말 entity와 Flow ending 노드는 같은 node id를 기준으로 연결된다.
- [ ] 모바일에서 Flow와 상세 패널이 세로로 쌓인다.
- [ ] focused unit, E2E smoke, typecheck, lint, `git diff --check`가 통과한다.
- [ ] Codecov patch coverage 70% 이상 또는 “수정된 커버 가능 라인 모두 테스트됨” 확인 후 merge한다.

## 6. 다음 PR 경계

- PR-5: 결말 분기 질문/매트릭스/JSONLogic 평가기/게임 종료 breakdown.
- PR-6: migration sweep, telemetry, legacy key 제거.
