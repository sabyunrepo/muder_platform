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

function latestSavedGraph() {
  const calls = saveFlowMutateMock.mock.calls;
  return calls[calls.length - 1][0];
}

describe('useFlowData', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useFlowGraphMock.mockReturnValue({
      data: serverGraph,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    createNodeMutateMock.mockImplementation((_body, options) => {
      options?.onSuccess?.({
        id: 'n3',
        type: 'phase',
        data: { label: '새 장면' },
        position_x: 200,
        position_y: 0,
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

    expect(latestSavedGraph().nodes[0].data).toEqual({ label: '수정된 장면' });
    expect(latestSavedGraph().edges).toEqual([]);
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
});
