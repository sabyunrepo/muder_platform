import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFlowData } from '../useFlowData';

const { useFlowGraphMock, saveFlowMutateMock, createNodeMutateMock, deleteNodeMutateMock } =
  vi.hoisted(() => ({
    useFlowGraphMock: vi.fn(),
    saveFlowMutateMock: vi.fn(),
    createNodeMutateMock: vi.fn(),
    deleteNodeMutateMock: vi.fn(),
  }));

vi.mock('../../flowApi', () => ({
  useFlowGraph: useFlowGraphMock,
  useSaveFlow: () => ({ mutate: saveFlowMutateMock, isPending: false }),
  useCreateFlowNode: () => ({ mutate: createNodeMutateMock }),
  useDeleteFlowNode: () => ({ mutate: deleteNodeMutateMock }),
}));

const serverGraph = {
  nodes: [
    {
      id: 'n1',
      type: 'phase',
      data: { label: '오프닝' },
      position_x: 0,
      position_y: 0,
    },
    {
      id: 'n2',
      type: 'phase',
      data: { label: '조사' },
      position_x: 100,
      position_y: 0,
    },
  ],
  edges: [
    {
      id: 'e1',
      source_id: 'n1',
      target_id: 'n2',
      label: null,
      condition: null,
      sort_order: 0,
    },
  ],
};

function cloneServerGraph() {
  return JSON.parse(JSON.stringify(serverGraph)) as typeof serverGraph;
}

function latestSavedGraph() {
  const calls = saveFlowMutateMock.mock.calls;
  return calls[calls.length - 1][0];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('useFlowData', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useFlowGraphMock.mockReturnValue({
      data: cloneServerGraph(),
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    createNodeMutateMock.mockImplementation((body, options) => {
      options?.onSuccess?.({
        id: 'n3',
        type: body.type,
        data: body.data,
        position_x: body.position_x,
        position_y: body.position_y,
      });
    });
    deleteNodeMutateMock.mockImplementation((_id, options) => {
      options?.onSuccess?.();
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('edge 삭제 직후 ref를 갱신해 저장 payload에서 연결을 제거한다', () => {
    const { result } = renderHook(() => useFlowData('theme-1'));

    act(() => {
      result.current.deleteEdge('e1');
      vi.runOnlyPendingTimers();
    });

    expect(latestSavedGraph().edges).toEqual([]);
  });

  it('연속 node 변경과 edge 삭제가 stale graph로 저장되지 않는다', () => {
    const { result } = renderHook(() => useFlowData('theme-1'));

    act(() => {
      result.current.updateNodeData('n1', { label: '수정된 장면' });
      result.current.deleteEdge('e1');
      vi.runOnlyPendingTimers();
    });

    expect(saveFlowMutateMock).toHaveBeenCalledTimes(1);
    expect(latestSavedGraph().nodes[0].data).toEqual({ label: '수정된 장면' });
    expect(latestSavedGraph().edges).toEqual([]);
  });

  it('onNodesChange가 position 변경을 ref와 autosave payload에 반영한다', () => {
    const { result } = renderHook(() => useFlowData('theme-1'));

    act(() => {
      result.current.onNodesChange([
        { type: 'position', id: 'n1', position: { x: 50, y: 50 } },
      ]);
      vi.runOnlyPendingTimers();
    });

    expect(latestSavedGraph().nodes[0]).toMatchObject({ position_x: 50, position_y: 50 });
  });

  it('flow graph refetch 후에도 선택한 장면 설정 패널을 유지한다', () => {
    const { result, rerender } = renderHook(() => useFlowData('theme-1'));

    act(() => {
      result.current.onSelectionChange({ nodes: [result.current.nodes[0]] });
    });

    expect(result.current.selectedNode?.id).toBe('n1');

    const refreshedGraph = cloneServerGraph();
    refreshedGraph.nodes[0].data = { label: '저장된 오프닝' };
    useFlowGraphMock.mockReturnValue({
      data: refreshedGraph,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    rerender();

    expect(result.current.selectedNode).toMatchObject({
      id: 'n1',
      data: { label: '저장된 오프닝' },
    });
    expect(result.current.nodes.find((node) => node.id === 'n1')?.selected).toBe(true);
  });

  it('onEdgesChange가 edge 삭제를 ref와 autosave payload에 반영한다', () => {
    const { result } = renderHook(() => useFlowData('theme-1'));

    act(() => {
      result.current.onEdgesChange([{ type: 'remove', id: 'e1' }]);
      vi.runOnlyPendingTimers();
    });

    expect(latestSavedGraph().edges).toEqual([]);
  });

  it('onConnect가 새 edge를 추가하고 autosave payload에 포함한다', () => {
    const { result } = renderHook(() => useFlowData('theme-1'));

    act(() => {
      result.current.onConnect({
        source: 'n2',
        target: 'n1',
        sourceHandle: null,
        targetHandle: null,
      });
      vi.runOnlyPendingTimers();
    });

    expect(latestSavedGraph().edges).toHaveLength(2);
    expect(latestSavedGraph().edges[1]).toMatchObject({ source_id: 'n2', target_id: 'n1' });
  });

  it('onConnect가 같은 source의 기존 연결을 새 연결로 교체한다', () => {
    const { result } = renderHook(() => useFlowData('theme-1'));

    act(() => {
      result.current.onConnect({
        source: 'n1',
        target: 'n2',
        sourceHandle: null,
        targetHandle: null,
      });
      vi.runOnlyPendingTimers();
    });

    expect(latestSavedGraph().edges).toHaveLength(1);
    expect(latestSavedGraph().edges[0]).toMatchObject({ source_id: 'n1', target_id: 'n2' });
  });

  it('onConnect가 서버 저장 가능한 UUID edge id를 생성한다', () => {
    const { result } = renderHook(() => useFlowData('theme-1'));

    act(() => {
      result.current.onConnect({
        source: 'n2',
        target: 'n1',
        sourceHandle: null,
        targetHandle: null,
      });
      vi.runOnlyPendingTimers();
    });

    expect(latestSavedGraph().edges[1].id).toMatch(UUID_RE);
  });

  it('connectNodes가 서버 저장 가능한 UUID edge id를 생성한다', () => {
    const { result } = renderHook(() => useFlowData('theme-1'));

    act(() => {
      result.current.connectNodes('n2', 'n1');
      vi.runOnlyPendingTimers();
    });

    expect(latestSavedGraph().edges[1].id).toMatch(UUID_RE);
  });

  it('connectNodes가 같은 source의 기존 연결을 새 연결로 교체한다', () => {
    const { result } = renderHook(() => useFlowData('theme-1'));

    act(() => {
      result.current.connectNodes('n1', 'n2');
      vi.runOnlyPendingTimers();
    });

    expect(latestSavedGraph().edges).toHaveLength(1);
    expect(latestSavedGraph().edges[0]).toMatchObject({ source_id: 'n1', target_id: 'n2' });
  });

  it('duplicateNode가 장면 내용만 복제하고 연결은 복제하지 않는다', () => {
    const { result } = renderHook(() => useFlowData('theme-1'));

    act(() => {
      result.current.duplicateNode('n1');
    });

    expect(createNodeMutateMock).toHaveBeenCalledWith(
      {
        type: 'phase',
        data: { label: '오프닝 복사본' },
        position_x: 80,
        position_y: 60,
      },
      expect.any(Object)
    );
  });

  it('node 삭제 성공 시 연결된 edge도 ref와 저장 payload에서 제거한다', () => {
    const { result } = renderHook(() => useFlowData('theme-1'));

    act(() => {
      result.current.deleteNode('n1');
      vi.runOnlyPendingTimers();
    });

    expect(deleteNodeMutateMock).toHaveBeenCalledWith('n1', expect.any(Object));
    expect(latestSavedGraph().nodes.map((node: { id: string }) => node.id)).toEqual(['n2']);
    expect(latestSavedGraph().edges).toEqual([]);
  });

  it('node 추가 시 전달된 제작자용 기본값을 create payload에 포함한다', () => {
    const { result } = renderHook(() => useFlowData('theme-1'));

    act(() => {
      result.current.addNode(
        'phase',
        { x: 200, y: 120 },
        { label: '1라운드 조사', phase_type: 'investigation', rounds: 1 }
      );
    });

    expect(createNodeMutateMock).toHaveBeenCalledWith(
      {
        type: 'phase',
        data: { label: '1라운드 조사', phase_type: 'investigation', rounds: 1 },
        position_x: 200,
        position_y: 120,
      },
      expect.any(Object)
    );
  });

  it('프리셋 적용 후 edge 삭제가 최신 프리셋 edge 목록을 기준으로 동작한다', () => {
    const { result } = renderHook(() => useFlowData('theme-1'));

    act(() => {
      result.current.applyPreset(
        [
          { id: 'p1', type: 'phase', position: { x: 0, y: 0 }, data: { label: '프리셋 1' } },
          { id: 'p2', type: 'phase', position: { x: 100, y: 0 }, data: { label: '프리셋 2' } },
        ],
        [{ id: 'preset-edge', source: 'p1', target: 'p2' }]
      );
      result.current.deleteEdge('preset-edge');
      vi.runOnlyPendingTimers();
    });

    expect(latestSavedGraph().nodes.map((node: { id: string }) => node.id)).toEqual(['p1', 'p2']);
    expect(latestSavedGraph().edges).toEqual([]);
  });

  it('새 node 생성 성공 시 ref를 갱신해 다음 저장에 포함한다', () => {
    const { result } = renderHook(() => useFlowData('theme-1'));

    act(() => {
      result.current.addNode('phase', { x: 200, y: 0 });
      vi.runOnlyPendingTimers();
    });

    expect(createNodeMutateMock).toHaveBeenCalled();
    expect(latestSavedGraph().nodes.map((node: { id: string }) => node.id)).toContain('n3');
  });

  it('node 생성 성공 시 생성된 React Flow node를 콜백으로 전달한다', () => {
    const onCreated = vi.fn();
    const { result } = renderHook(() => useFlowData('theme-1'));

    act(() => {
      result.current.addNode('ending', { x: 240, y: 160 }, undefined, { onCreated });
    });

    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({
      id: 'n3',
      type: 'ending',
      position: { x: 240, y: 160 },
      data: {},
    }));
  });
});
