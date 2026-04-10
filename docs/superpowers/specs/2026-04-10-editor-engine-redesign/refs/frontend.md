# 프론트엔드 에디터 + 게임플레이 아키텍처

> 부모: [../design.md](../design.md)

---

## 에디터 Progressive Disclosure 3레이어

### Layer 1: Template Studio (입문)

**대상**: 처음 사용하는 제작자
**UX**: 장르 프리셋 선택 → 폼 기반 편집 → 실시간 미리보기

```
1. 장르 선택 (크라임씬 / 스크립트킬 / 쥬번샤 / 머더미스터리)
2. 프리셋 선택 ("3라운드 투표형", "5라운드 스크립트 공개형", ...)
3. 테마 기본 정보 입력 (이름, 인원, 시간)
4. 캐릭터 편집 (이름, 역할, 스크립트)
5. 단서 편집 (리스트 뷰)
6. 저장 + 미리보기
```

### Layer 2: Phase Timeline (중급)

**대상**: 기본 구조를 이해한 제작자
**UX**: 비디오 타임라인 형태 페이즈 편집 + 드래그앤드롭

```
1. Layer 1 기능 포함
2. 페이즈 타임라인 뷰 (드래그앤드롭 순서 변경)
3. 페이즈 설정 패널 (시간, 조건, 액션)
4. 단서 배포 규칙 설정 (라운드별, 조건부)
5. 투표/지목 규칙 설정
6. 조건부 분기 (IF → THEN)
```

### Layer 3: Visual Node Editor (고급)

**대상**: 복잡한 게임 로직을 만드는 제작자
**UX**: React Flow 기반 노드 그래프 편집

```
1. Layer 2 기능 포함
2. React Flow 캔버스 (노드 + 엣지)
3. 커스텀 노드: Phase, Event, Condition, Action, Clue
4. 모듈 팔레트 (드래그 소스)
5. JSON Logic 시각적 규칙 편집
6. 단서 의존성/조합 그래프 편집
7. 게임 흐름 시뮬레이션
```

---

## 에디터 레이아웃

```
┌──────────────────────────────────────────────────────────────┐
│ Header: 로고 │ 테마명 │ 자동저장 ✓ │ 미리보기 │ 게시 | 설정   │
├──────────┬───────────────────────────────────┬───────────────┤
│ Sidebar  │              Main Canvas           │ Right Panel   │
│ (240px)  │              (flex-1)              │ (320px)       │
│          │                                    │               │
│ ┌──────┐ │  ┌──────────────────────────────┐ │ ┌───────────┐ │
│ │장르   │ │  │                              │ │ │선택된 노드│ │
│ │선택   │ │  │  React Flow Canvas           │ │ │상세 설정  │ │
│ │      │ │  │  (Phase Timeline / Node Editor)│ │ │           │ │
│ │──────│ │  │                              │ │ │ConfigSchema│ │
│ │모듈   │ │  │  ┌────┐  ┌────┐  ┌────┐    │ │ │→ 자동 UI  │ │
│ │팔레트 │ │  │  │Node│→│Node│→│Node│    │ │ │           │ │
│ │      │ │  │  └────┘  └────┘  └────┘    │ │ └───────────┘ │
│ │──────│ │  │                              │ │               │
│ │캐릭터 │ │  └──────────────────────────────┘ │               │
│ │목록   │ │                                    │               │
│ │      │ │  ┌──────────────────────────────┐ │               │
│ │──────│ │  │ Tab: 스토리|캐릭터|단서|규칙  │ │               │
│ │단서   │ │  │ (선택한 탭의 상세 편집)       │ │               │
│ │목록   │ │  └──────────────────────────────┘ │               │
│ └──────┘ │                                    │               │
├──────────┴────────────────────────────────────┴───────────────┤
│ Footer: 줌 | 레이어 전환(L1/L2/L3) | 언두/리두 | 유효성 검사  │
└──────────────────────────────────────────────────────────────┘
```

---

## React Flow 커스텀 노드

### 노드 타입

```tsx
const nodeTypes = {
  // Phase (타임라인)
  phaseNode:       PhaseNode,         // 페이즈 블록
  startNode:       StartNode,         // 게임 시작
  endNode:         EndNode,           // 게임 종료 (조건부 분기)

  // Event (노드 에디터)
  eventTrigger:    EventTriggerNode,  // 이벤트 트리거
  conditionNode:   ConditionNode,     // 조건 분기 (IF/AND/OR)
  actionNode:      ActionNode,        // 액션 실행

  // Clue (단서 시스템)
  clueNode:        ClueNode,          // 단서 정의
  clueDepNode:     ClueDependencyNode,// 단서 의존성
  clueComboNode:   ClueComboNode,     // 단서 조합

  // Data
  timerNode:       TimerNode,         // 타이머
  variableNode:    VariableNode,      // 변수 참조
};

const edgeTypes = {
  phaseTransition: PhaseTransitionEdge,  // 페이즈 전환
  eventFlow:       EventFlowEdge,        // 이벤트 흐름
  clueDependency:  ClueDependencyEdge,   // 단서 의존성 (실선)
  clueCombo:       ClueComboEdge,        // 단서 조합 (점선)
  dataRef:         DataRefEdge,          // 데이터 참조
};
```

### ConfigSchema → 자동 UI (Builder 패턴)

```tsx
function SchemaDrivenForm({ schema, value, onChange }: SchemaFormProps) {
  const fields = parseJsonSchema(schema);

  return (
    <Form>
      {fields.map(field => (
        <SchemaField key={field.key} field={field} value={value[field.key]} onChange={...} />
      ))}
    </Form>
  );
}

function SchemaField({ field, value, onChange }: FieldProps) {
  switch (field.type) {
    case 'string':
      return field.enum
        ? <Select options={field.enum} value={value} onChange={onChange} />
        : <TextInput value={value} onChange={onChange} />;
    case 'integer':
      return <NumberInput min={field.minimum} max={field.maximum} value={value} onChange={onChange} />;
    case 'boolean':
      return <Toggle checked={value} onChange={onChange} />;
    case 'array':
      return <ArrayEditor items={field.items} value={value} onChange={onChange} />;
    case 'object':
      return <SchemaDrivenForm schema={field.properties} value={value} onChange={onChange} />;
    default:
      return <TextInput value={value} onChange={onChange} />;
  }
}
```

---

## 게임플레이 화면

```
┌──────────────────────────────────────────────────────────────┐
│ Top Bar: 타이머 | 현재 페이즈 | 접속자 수 | 설정             │
├──────────┬──────────────────────────────────────┬────────────┤
│ Left     │          Main Play Area              │   Right    │
│ (200px)  │              (flex-1)                │   (280px)  │
│          │                                      │            │
│ 참가자   │  ┌──────────────────────────────┐    │ 채팅       │
│ 목록     │  │                              │    │            │
│ (역할/   │  │  장르별 커스텀 뷰              │    │ ───────── │
│  팀/     │  │  CrimeScene: 보드/맵 뷰        │    │ 단서 노트  │
│  상태)   │  │  ScriptKill: 스크립트 뷰어      │    │            │
│          │  │  Jubensha: 스크립트+미디어      │    │ ───────── │
│          │  │  MurderMystery: 카드 뷰         │    │ 투표 UI   │
│          │  │                              │    │ (장르별)    │
│          │  └──────────────────────────────┘    │            │
│          │                                      │ ───────── │
│          │  공통 컴포넌트: Timer, Modal, Toast  │ 미디어/BGM  │
└──────────┴──────────────────────────────────────┴────────────┘
```

---

## 상태 관리 (Zustand)

```
stores/
├── editor/
│   ├── themeStore.ts        // 테마 메타데이터
│   ├── flowStore.ts         // React Flow nodes/edges
│   ├── phaseStore.ts        // 페이즈 정의
│   ├── characterStore.ts    // 캐릭터/역할
│   ├── clueStore.ts         // 단서 (리스트 + 그래프)
│   ├── ruleStore.ts         // 규칙/승리조건
│   ├── moduleStore.ts       // 활성 모듈
│   ├── editorUIStore.ts     // 에디터 UI 상태
│   └── autoSaveStore.ts     // 자동저장
├── game/
│   ├── gameStore.ts         // 이벤트 기반 상태 (WS 수신 → 갱신)
│   └── playerStore.ts       // 내 플레이어 상태
└── shared/
    └── connectionStore.ts   // WebSocket 연결 상태
```

---

## 컴포넌트 트리

```
apps/web/src/features/editor/
├── components/
│   ├── EditorLayout.tsx
│   ├── Header/
│   │   ├── AutoSaveIndicator.tsx
│   │   ├── PreviewButton.tsx
│   │   └── PublishDialog.tsx
│   ├── Sidebar/
│   │   ├── GenreSelector.tsx
│   │   ├── ModulePalette.tsx
│   │   ├── CharacterList.tsx
│   │   └── ClueList.tsx
│   ├── Canvas/
│   │   ├── FlowEditor.tsx          // React Flow 래퍼
│   │   ├── TimelineView.tsx        // 타임라인 레이어
│   │   ├── TemplateView.tsx        // 템플릿 레이어
│   │   ├── nodes/
│   │   │   ├── PhaseNode.tsx
│   │   │   ├── ConditionNode.tsx
│   │   │   ├── ActionNode.tsx
│   │   │   ├── EventTriggerNode.tsx
│   │   │   └── ClueNode.tsx
│   │   └── edges/
│   ├── RightPanel/
│   │   ├── NodeConfigPanel.tsx
│   │   ├── SchemaDrivenForm.tsx    // ConfigSchema → 자동 UI
│   │   ├── ClueEditor.tsx
│   │   ├── RuleEditor.tsx
│   │   └── WinConditionEditor.tsx
│   └── Footer/
│       ├── LayerSwitch.tsx
│       └── ValidationStatus.tsx
├── hooks/
│   ├── useAutoSave.ts
│   ├── useFlowValidation.ts
│   ├── useSchemaToForm.ts
│   └── useClueGraph.ts
└── utils/
    ├── schemaParser.ts             // JSON Schema → FormFieldSpec
    ├── flowSerializer.ts           // nodes/edges ↔ JSON
    └── clueGraphBuilder.ts         // 단서 의존성 그래프 생성

apps/web/src/features/game/
├── components/
│   ├── GameLayout.tsx
│   ├── PlayerList.tsx
│   ├── shared/                     // Timer, Chat, VoteUI, Modal, Toast
│   └── genres/
│       ├── CrimeSceneView.tsx
│       ├── ScriptKillView.tsx
│       ├── JubenshaView.tsx
│       └── MurderMysteryView.tsx
└── hooks/
    └── useGameEvents.ts            // WS 이벤트 → Zustand store
```
