# PR C-1: Editor 3-Column Layout + EditorUIStore

> Phase C | 의존: 없음 | Wave: W1

---

## 목표
기존 tab-based `EditorLayout`을 3-column 레이아웃으로 교체.
Layer 1 (Template Studio) 진입점. 기존 tab 기능은 하위 호환 유지.

## 변경 파일

**신규**
```
apps/web/src/features/editor/
  components/
    StudioLayout.tsx              # 3-column 레이아웃 컨테이너
    Sidebar/SidebarPanel.tsx      # 좌측 사이드바 (240px, 접이식)
    Canvas/StudioCanvas.tsx       # 중앙 캔버스 (flex-1, tab 컨텐츠)
    RightPanel/RightPanel.tsx     # 우측 설정 패널 (320px, 접이식)
    Footer/EditorFooter.tsx       # 하단 툴바
  stores/editorUIStore.ts         # 확장: sidebar/rightPanel 상태
```

**수정**
```
apps/web/src/features/editor/
  components/EditorLayout.tsx     # Layer 전환 로직
  constants.ts                    # EDITOR_LAYERS enum
```

## EditorUIStore 확장

```typescript
interface EditorUIState {
  // 기존
  activeTab: EditorTab;
  setActiveTab: (tab: EditorTab) => void;
  validationErrors: Record<string, string[]>;
  // 신규
  activeLayer: 'L1' | 'L2' | 'L3';
  setActiveLayer: (layer: 'L1' | 'L2' | 'L3') => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  rightPanelCollapsed: boolean;
  toggleRightPanel: () => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
}
```

## StudioLayout 동작

- `activeLayer === 'L1'` → StudioLayout 렌더링
- `activeLayer` 기본값 `'L1'` (기존 tab 레이아웃은 `EditorLayout` 유지)
- SidebarPanel: 장르/캐릭터/단서 탭 전환 (C-2, C-4, C-5에서 채움)
- StudioCanvas: 기존 TabContent 그대로 렌더링
- RightPanel: `selectedNodeId`에 따라 동적 컨텐츠 (C-3, C-4, C-5에서 채움)
- EditorFooter: validation status + L1/L2 전환 버튼

## 테스트

- `StudioLayout.test.tsx`: 3-column 렌더링, 접기/펼치기, Layer 전환
- `EditorFooter.test.tsx`: L1/L2 버튼, validation status 표시
