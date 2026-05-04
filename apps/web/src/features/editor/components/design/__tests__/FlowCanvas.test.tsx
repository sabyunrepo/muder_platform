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
    nodeClassName,
  }: {
    children?: React.ReactNode;
    nodes?: Array<{ id: string }>;
    nodeClassName?: (node: { id: string }) => string;
  }) => (
    <div data-testid="react-flow">
      {nodes.map((node) => (
        <div
          key={node.id}
          data-testid={`rf-node-${node.id}`}
          className={nodeClassName?.(node) ?? ""}
        />
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

  it('장면 노드가 있으면 스토리 장면 요약을 렌더링한다', () => {
    useFlowDataMock.mockReturnValue({
      nodes: [
        {
          id: 'scene-1',
          type: 'phase',
          position: { x: 0, y: 0 },
          data: { label: '오프닝', phase_type: 'story_progression' },
        },
      ],
      edges: [],
      onNodesChange: vi.fn(),
      onEdgesChange: vi.fn(),
      onConnect: vi.fn(),
      isLoading: false,
      isSaving: false,
      save: saveMock,
    });

    render(<FlowCanvas themeId="theme-1" />);
    expect(screen.getByText('스토리 장면 구성')).toBeDefined();
    expect(screen.getByText('1개 장면')).toBeDefined();
    expect(screen.getByText('오프닝')).toBeDefined();
  });

  it('모바일 우선 세로 레이아웃을 사용하고 데스크톱에서만 2열로 바뀐다', () => {
    render(<FlowCanvas themeId="theme-1" />);
    const workspace = screen.getByTestId('flow-workspace');
    expect(workspace.className).toContain('flex-col');
    expect(workspace.className).toContain('lg:flex-row');
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
});

// ---------------------------------------------------------------------------
// FlowToolbar tests
// ---------------------------------------------------------------------------

describe('FlowToolbar', () => {
  it('저장 버튼이 렌더링된다', () => {
    render(
      <FlowToolbar onAddNode={vi.fn()} onSave={saveMock} isSaving={false} />,
    );
    expect(screen.getByText('저장')).toBeDefined();
  });

  it('저장 버튼 클릭 시 onSave가 호출된다', () => {
    render(
      <FlowToolbar onAddNode={vi.fn()} onSave={saveMock} isSaving={false} />,
    );
    fireEvent.click(screen.getByText('저장'));
    expect(saveMock).toHaveBeenCalledOnce();
  });

  it('isSaving=true 일 때 "저장 중..." 텍스트를 표시한다', () => {
    render(
      <FlowToolbar onAddNode={vi.fn()} onSave={saveMock} isSaving={true} />,
    );
    expect(screen.getByText('저장 중...')).toBeDefined();
  });

  it('항목 추가 버튼 클릭 시 드롭다운이 열린다', () => {
    render(
      <FlowToolbar onAddNode={vi.fn()} onSave={saveMock} isSaving={false} />,
    );
    fireEvent.click(screen.getByText('항목 추가'));
    expect(screen.getByText('장면')).toBeDefined();
    expect(screen.getByText('분기')).toBeDefined();
    expect(screen.getByText('엔딩')).toBeDefined();
  });

  it('드롭다운에서 노드 선택 시 onAddNode가 호출된다', () => {
    const onAddNode = vi.fn();
    render(
      <FlowToolbar onAddNode={onAddNode} onSave={vi.fn()} isSaving={false} />,
    );
    fireEvent.click(screen.getByText('항목 추가'));
    fireEvent.click(screen.getByText('장면'));
    expect(onAddNode).toHaveBeenCalledWith('phase');
  });
});
