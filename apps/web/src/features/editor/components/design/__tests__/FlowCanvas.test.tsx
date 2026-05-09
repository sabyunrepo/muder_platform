import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { saveMock, useFlowDataMock } = vi.hoisted(() => ({
  saveMock: vi.fn(),
  useFlowDataMock: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({
    children,
    nodes = [],
    edges = [],
    fitViewOptions,
    onSelectionChange,
  }: {
    children?: React.ReactNode;
    nodes?: Array<{ id: string; className?: string }>;
    edges?: Array<{ id: string; source: string; target: string }>;
    fitViewOptions?: { padding?: number };
    onSelectionChange?: (params: { nodes: unknown[]; edges: unknown[] }) => void;
  }) => (
    <div data-testid="react-flow" data-fit-padding={String(fitViewOptions?.padding ?? '')}>
      {nodes.map((node) => (
        <div key={node.id} data-testid={`rf-node-${node.id}`} className={node.className ?? ''} />
      ))}
      {edges.map((edge) => (
        <button
          key={edge.id}
          type="button"
          onClick={() => onSelectionChange?.({ nodes: [], edges: [edge] })}
        >
          {edge.id} 선택
        </button>
      ))}
      {children}
    </div>
  ),
  Background: () => <div data-testid="rf-background" />,
  MiniMap: () => <div data-testid="rf-minimap" />,
  Controls: () => <div data-testid="rf-controls" />,
  useNodesState: (init: unknown[]) => [init, vi.fn(), vi.fn()],
  useEdgesState: (init: unknown[]) => [init, vi.fn(), vi.fn()],
  addEdge: vi.fn(),
}));

vi.mock('../../../hooks/useFlowData', () => ({
  useFlowData: () => useFlowDataMock(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { FlowCanvas } from '../FlowCanvas';
import { FlowToolbar } from '../FlowToolbar';

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

beforeEach(() => {
  useFlowDataMock.mockReturnValue({
    nodes: [],
    edges: [],
    onNodesChange: vi.fn(),
    onEdgesChange: vi.fn(),
    onConnect: vi.fn(),
    isLoading: false,
    isSaving: false,
    save: saveMock,
    selectedNode: null,
    addNode: vi.fn(),
    updateNodeData: vi.fn(),
    deleteNode: vi.fn(),
    deleteEdge: vi.fn(),
    connectNodes: vi.fn(),
    onSelectionChange: vi.fn(),
    updateEdgeCondition: vi.fn(),
    applyPreset: vi.fn(),
  });
});

// ---------------------------------------------------------------------------
// FlowCanvas tests
// ---------------------------------------------------------------------------

describe('FlowCanvas', () => {
  it('로딩 중일 때 로딩 메시지를 표시한다', () => {
    useFlowDataMock.mockReturnValue({
      nodes: [],
      edges: [],
      onNodesChange: vi.fn(),
      onEdgesChange: vi.fn(),
      onConnect: vi.fn(),
      isLoading: true,
      isSaving: false,
      save: vi.fn(),
    });

    render(<FlowCanvas themeId="theme-1" />);
    expect(screen.getByText('로딩 중...')).toBeDefined();
  });

  it('로딩 완료 시 ReactFlow를 렌더링한다', () => {
    render(<FlowCanvas themeId="theme-1" />);
    expect(screen.getByTestId('react-flow')).toBeDefined();
  });

  it('선택 노드 변경 콜백을 현재 선택 상태로 호출한다', () => {
    const selectedNode = {
      id: 'scene-1',
      type: 'start',
      position: { x: 0, y: 0 },
      data: { label: '오프닝' },
    };
    useFlowDataMock.mockReturnValue({
      nodes: [selectedNode],
      edges: [],
      onNodesChange: vi.fn(),
      onEdgesChange: vi.fn(),
      onConnect: vi.fn(),
      isLoading: false,
      isSaving: false,
      save: saveMock,
      selectedNode,
    });
    const onSelectedNodeChange = vi.fn();

    render(<FlowCanvas themeId="theme-1" onSelectedNodeChange={onSelectedNodeChange} />);

    expect(onSelectedNodeChange).toHaveBeenCalledWith(selectedNode, { outgoingEdges: [] });
  });

  it('중복 게임 진행 요약 배지를 렌더링하지 않는다', () => {
    useFlowDataMock.mockReturnValue({
      nodes: [
        {
          id: 'scene-1',
          type: 'phase',
          position: { x: 0, y: 0 },
          data: { label: '오프닝', phase_type: 'story_progression' },
        },
        {
          id: 'ending-1',
          type: 'ending',
          position: { x: 100, y: 0 },
          data: { label: '진실 엔딩' },
        },
      ],
      edges: [{ id: 'e-scene-ending', source: 'scene-1', target: 'ending-1' }],
      onNodesChange: vi.fn(),
      onEdgesChange: vi.fn(),
      onConnect: vi.fn(),
      isLoading: false,
      isSaving: false,
      save: saveMock,
    });

    render(<FlowCanvas themeId="theme-1" />);
    expect(screen.queryByLabelText('게임 진행 요약')).toBeNull();
    expect(screen.queryByText('진행 단계 1')).toBeNull();
    expect(screen.queryByText('연결 1')).toBeNull();
    expect(screen.queryByText('조건 0')).toBeNull();
    expect(screen.queryByText('엔딩 1')).toBeNull();
    expect(screen.queryByText('스토리 장면 구성')).toBeNull();
  });

  it('모바일 우선 세로 레이아웃을 사용하고 데스크톱에서만 2열로 바뀐다', () => {
    render(<FlowCanvas themeId="theme-1" />);
    const workspace = screen.getByTestId('flow-workspace');
    expect(workspace.className).toContain('flex-col');
    expect(workspace.className).toContain('lg:flex-row');
  });

  it('우측 설정 패널에서 선택 안내를 보여준다', () => {
    render(<FlowCanvas themeId="theme-1" />);
    const sidePanel = screen.getByTestId('flow-side-panel');
    expect(sidePanel).toBeDefined();
    expect(screen.getByText('장면을 선택하면 세부 설정을 편집할 수 있습니다.')).toBeDefined();
  });

  it('ending 노드만 남은 그래프도 프리셋 적용 전에 덮어쓰기 확인을 요구한다', () => {
    const applyPreset = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    useFlowDataMock.mockReturnValue({
      nodes: [
        {
          id: 'ending-1',
          type: 'ending',
          position: { x: 0, y: 0 },
          data: { label: '진실 엔딩' },
        },
      ],
      edges: [],
      onNodesChange: vi.fn(),
      onEdgesChange: vi.fn(),
      onConnect: vi.fn(),
      isLoading: false,
      isSaving: false,
      save: saveMock,
      selectedNode: null,
      addNode: vi.fn(),
      updateNodeData: vi.fn(),
      deleteNode: vi.fn(),
      deleteEdge: vi.fn(),
      connectNodes: vi.fn(),
      onSelectionChange: vi.fn(),
      updateEdgeCondition: vi.fn(),
      applyPreset,
    });

    render(<FlowCanvas themeId="theme-1" />);

    fireEvent.click(screen.getByRole('button', { name: '프리셋' }));
    fireEvent.click(screen.getByText('클래식 머더미스터리'));

    expect(confirmSpy).toHaveBeenCalledWith('기존 흐름이 대체됩니다. 계속할까요?');
    expect(applyPreset).not.toHaveBeenCalled();
  });

  it('캔버스 밖으로 튀어나온 노드가 상단 미리보기 패널 클릭을 가로막지 않게 자른다', () => {
    render(<FlowCanvas themeId="theme-1" />);
    const canvas = screen.getByTestId('flow-canvas');
    expect(canvas.className).toContain('overflow-hidden');
    expect(screen.getByTestId('react-flow').getAttribute('data-fit-padding')).toBe('0.35');
  });

  it('ReactFlow 보조 컴포넌트들이 렌더링된다', () => {
    render(<FlowCanvas themeId="theme-1" />);
    expect(screen.getByTestId('rf-background')).toBeDefined();
    expect(screen.getByTestId('rf-minimap')).toBeDefined();
    expect(screen.getByTestId('rf-controls')).toBeDefined();
  });

  it('순서 점검 패널을 툴바로 닫으면 노드 하이라이트를 해제한다', () => {
    useFlowDataMock.mockReturnValue({
      nodes: [
        {
          id: 'p1',
          type: 'phase',
          position: { x: 0, y: 0 },
          data: { label: '오프닝', duration: 5 },
        },
        {
          id: 'p2',
          type: 'phase',
          position: { x: 100, y: 0 },
          data: { label: '조사', duration: 10 },
        },
      ],
      edges: [{ id: 'e-p1-p2', source: 'p1', target: 'p2' }],
      onNodesChange: vi.fn(),
      onEdgesChange: vi.fn(),
      onConnect: vi.fn(),
      isLoading: false,
      isSaving: false,
      save: saveMock,
    });

    render(<FlowCanvas themeId="theme-1" />);

    fireEvent.click(screen.getByRole('button', { name: '순서 점검' }));
    fireEvent.click(screen.getByTitle('다음'));
    expect(screen.getByTestId('rf-node-p2').className).toContain('!ring-2');

    fireEvent.click(screen.getByRole('button', { name: '순서 점검' }));
    expect(screen.getByTestId('rf-node-p2').className).not.toContain('!ring-2');
  });

  it('선택한 연결선을 버튼으로 끊을 수 있다', () => {
    const deleteEdge = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    useFlowDataMock.mockReturnValue({
      nodes: [
        {
          id: 'p1',
          type: 'phase',
          position: { x: 0, y: 0 },
          data: { label: '오프닝' },
        },
        {
          id: 'p2',
          type: 'phase',
          position: { x: 100, y: 0 },
          data: { label: '조사' },
        },
      ],
      edges: [{ id: 'e-p1-p2', source: 'p1', target: 'p2' }],
      onNodesChange: vi.fn(),
      onEdgesChange: vi.fn(),
      onConnect: vi.fn(),
      isLoading: false,
      isSaving: false,
      save: saveMock,
      selectedNode: null,
      addNode: vi.fn(),
      updateNodeData: vi.fn(),
      deleteNode: vi.fn(),
      deleteEdge,
      connectNodes: vi.fn(),
      onSelectionChange: vi.fn(),
      updateEdgeCondition: vi.fn(),
      applyPreset: vi.fn(),
    });

    render(<FlowCanvas themeId="theme-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'e-p1-p2 선택' }));
    expect(screen.getByText('오프닝 -> 조사')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '연결 끊기' }));
    expect(window.confirm).toHaveBeenCalledWith('선 연결을 끊을까요? 이 작업은 즉시 저장됩니다.');
    expect(deleteEdge).toHaveBeenCalledWith('e-p1-p2');
  });

  it('연결선 삭제 확인을 취소하면 연결을 유지한다', () => {
    const deleteEdge = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    useFlowDataMock.mockReturnValue({
      nodes: [
        { id: 'p1', type: 'phase', position: { x: 0, y: 0 }, data: { label: '오프닝' } },
        { id: 'p2', type: 'phase', position: { x: 100, y: 0 }, data: { label: '조사' } },
      ],
      edges: [{ id: 'e-p1-p2', source: 'p1', target: 'p2' }],
      onNodesChange: vi.fn(),
      onEdgesChange: vi.fn(),
      onConnect: vi.fn(),
      isLoading: false,
      isSaving: false,
      save: saveMock,
      selectedNode: null,
      addNode: vi.fn(),
      updateNodeData: vi.fn(),
      deleteNode: vi.fn(),
      deleteEdge,
      connectNodes: vi.fn(),
      onSelectionChange: vi.fn(),
      updateEdgeCondition: vi.fn(),
      applyPreset: vi.fn(),
    });

    render(<FlowCanvas themeId="theme-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'e-p1-p2 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '연결 끊기' }));

    expect(deleteEdge).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// FlowToolbar tests
// ---------------------------------------------------------------------------

describe('FlowToolbar', () => {
  it('저장 버튼이 렌더링된다', () => {
    render(<FlowToolbar onAddScene={vi.fn()} onSave={saveMock} isSaving={false} />);
    expect(screen.getByText('저장')).toBeDefined();
  });

  it('저장 버튼 클릭 시 onSave가 호출된다', () => {
    render(<FlowToolbar onAddScene={vi.fn()} onSave={saveMock} isSaving={false} />);
    fireEvent.click(screen.getByText('저장'));
    expect(saveMock).toHaveBeenCalledOnce();
  });

  it('isSaving=true 일 때 "저장 중..." 텍스트를 표시한다', () => {
    render(<FlowToolbar onAddScene={vi.fn()} onSave={saveMock} isSaving={true} />);
    expect(screen.getByText('저장 중...')).toBeDefined();
  });

  it('장면 추가 버튼만 렌더링하고 phase subtype 드롭다운을 숨긴다', () => {
    render(<FlowToolbar onAddScene={vi.fn()} onSave={saveMock} isSaving={false} />);
    expect(screen.getByRole('button', { name: '장면 추가' })).toBeDefined();
    expect(screen.queryByText('항목 추가')).toBeNull();
    expect(screen.queryByText('게임 라운드')).toBeNull();
    expect(screen.queryByText('투표')).toBeNull();
    expect(screen.queryByText('결말 연결')).toBeNull();
    expect(screen.queryByText('조건 분기')).toBeNull();
  });

  it('장면 추가 클릭 시 onAddScene이 호출된다', () => {
    const onAddScene = vi.fn();
    render(<FlowToolbar onAddScene={onAddScene} onSave={vi.fn()} isSaving={false} />);
    fireEvent.click(screen.getByText('장면 추가'));
    expect(onAddScene).toHaveBeenCalledOnce();
  });
});
