/**
 * EndingNodePanel — Phase 21 E-1 동등화 회귀 테스트.
 *
 * Phase 18.5 종료 시점에는 EndingNodePanel이 debounce(500ms) + unmount cleanup만
 * 가지고 있었고 optimistic / rollback / onBlur flush가 누락된 미완성 상태였다.
 * useDebouncedMutation 훅 도입으로 PhaseNodePanel 수준의 보호가 자동 적용되었으므로,
 * 본 spec은 동등화된 동작을 회귀 가드로 잠근다:
 *
 *   1. debounce 500ms (window 보존)
 *   2. 연속 change는 한 번만 저장 (debounce 재시작)
 *   3. onBlur → 즉시 flush (timer 대기 없음)
 *   4. optimistic graph cache 갱신
 *   5. mutate onError → rollback + toast.error
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const { mutateMock, useUpdateFlowNodeMock, toastError } = vi.hoisted(() => ({
  mutateMock: vi.fn(),
  useUpdateFlowNodeMock: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: toastError },
}));

vi.mock("../../../flowApi", () => ({
  useUpdateFlowNode: () => useUpdateFlowNodeMock(),
}));

import { EndingNodePanel } from "../EndingNodePanel";
import { flowKeys, type FlowGraphResponse } from "../../../flowTypes";

function renderWithClient(ui: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    qc,
    ...render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>),
  };
}

const makeGraph = (nodeId = "ending-1", data: Record<string, unknown> = {}): FlowGraphResponse => ({
  nodes: [
    {
      id: nodeId,
      theme_id: "t1",
      type: "ending",
      position_x: 0,
      position_y: 0,
      data: { label: "엔딩 A", ...data },
      created_at: "2026-04-30T00:00:00Z",
      updated_at: "2026-04-30T00:00:00Z",
    },
  ],
  edges: [],
});

const makeNode = (data: Record<string, unknown> = {}) => ({
  id: "ending-1",
  type: "ending" as const,
  position: { x: 0, y: 0 },
  data: { label: "엔딩 A", ...data },
});

beforeEach(() => {
  vi.useFakeTimers();
  useUpdateFlowNodeMock.mockReturnValue({ mutate: mutateMock });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("EndingNodePanel debounce + onBlur flush", () => {

  it("Phase 24 정책에 따라 점수 배율 입력을 표시하지 않는다", () => {
    renderWithClient(
      <EndingNodePanel node={makeNode({ score_multiplier: 2 })} themeId="t1" onUpdate={vi.fn()} />,
    );

    expect(screen.queryByText("점수 배율")).toBeNull();
  });

  it("아이콘과 표시 색상을 저장할 수 있다", () => {
    renderWithClient(
      <EndingNodePanel node={makeNode()} themeId="t1" onUpdate={vi.fn()} />,
    );

    fireEvent.change(screen.getByPlaceholderText("예: 🎭"), { target: { value: "💚" } });
    fireEvent.blur(screen.getByPlaceholderText("예: 🎭"));

    expect(mutateMock).toHaveBeenCalledTimes(1);
    const [arg] = mutateMock.mock.calls[0] as [
      { nodeId: string; body: { data: { icon: string } } },
    ];
    expect(arg.body.data.icon).toBe("💚");
  });
  it("debounce 500ms 후에 mutate가 1회 호출된다", async () => {
    renderWithClient(
      <EndingNodePanel node={makeNode()} themeId="t1" onUpdate={vi.fn()} />,
    );

    const labelInput = screen.getByPlaceholderText("엔딩 이름");
    fireEvent.change(labelInput, { target: { value: "정의 승리" } });

    // 499ms — must NOT fire yet.
    await act(async () => {
      vi.advanceTimersByTime(499);
    });
    expect(mutateMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(mutateMock).toHaveBeenCalledTimes(1);
    const [arg] = mutateMock.mock.calls[0] as [
      { nodeId: string; body: { data: { label: string } } },
    ];
    expect(arg.nodeId).toBe("ending-1");
    expect(arg.body.data.label).toBe("정의 승리");
  });

  it("연속 change는 한 번만 저장된다 (debounce 재시작)", async () => {
    renderWithClient(
      <EndingNodePanel node={makeNode()} themeId="t1" onUpdate={vi.fn()} />,
    );

    const labelInput = screen.getByPlaceholderText("엔딩 이름");
    fireEvent.change(labelInput, { target: { value: "A" } });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.change(labelInput, { target: { value: "AB" } });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(mutateMock).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(mutateMock).toHaveBeenCalledTimes(1);
  });

  it("onBlur 발생 시 timer 대기 없이 즉시 저장된다", () => {
    renderWithClient(
      <EndingNodePanel node={makeNode()} themeId="t1" onUpdate={vi.fn()} />,
    );

    const labelInput = screen.getByPlaceholderText("엔딩 이름");
    fireEvent.change(labelInput, { target: { value: "즉시" } });
    expect(mutateMock).not.toHaveBeenCalled();

    fireEvent.blur(labelInput);
    expect(mutateMock).toHaveBeenCalledTimes(1);
  });

  it("optimistic update: flush 시점에 graph cache가 갱신된다", async () => {
    // Phase 21 round-2 (perf-H2): applyOptimistic은 schedule이 아닌 flush
    // 시점에만 호출되어 빠른 타이핑 시 canvas re-render 폭증을 회피한다.
    // schedule 직후에는 cache 그대로, debounce window가 지나면 갱신.
    const { qc } = renderWithClient(
      <EndingNodePanel node={makeNode()} themeId="t1" onUpdate={vi.fn()} />,
    );
    qc.setQueryData(flowKeys.graph("t1"), makeGraph());

    const labelInput = screen.getByPlaceholderText("엔딩 이름");
    fireEvent.change(labelInput, { target: { value: "엔딩 B" } });

    // Schedule 직후 — cache 변경 없음 (perf-H2 fix).
    const beforeFlush = qc.getQueryData<FlowGraphResponse>(flowKeys.graph("t1"));
    const beforeNode = beforeFlush?.nodes.find((n) => n.id === "ending-1");
    expect((beforeNode?.data as { label?: string }).label).toBe("엔딩 A");
    expect(mutateMock).not.toHaveBeenCalled();

    // Debounce window 종료 → flush → applyOptimistic + mutate.
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    const afterFlush = qc.getQueryData<FlowGraphResponse>(flowKeys.graph("t1"));
    const afterNode = afterFlush?.nodes.find((n) => n.id === "ending-1");
    expect((afterNode?.data as { label?: string }).label).toBe("엔딩 B");
    expect(mutateMock).toHaveBeenCalledTimes(1);
  });

  it("pending body가 있는 상태에서 unmount 시 자동 flush된다", async () => {
    // E-12 회귀: schedule 직후 (debounce window 만료 전) 컴포넌트가 unmount되면
    // useDebouncedMutation의 useUnmountFlush가 pending body를 즉시 발화해야 한다.
    // 다른 panel로 이동하거나 탭을 떠나도 마지막 입력이 사라지지 않도록 보장.
    const { unmount } = renderWithClient(
      <EndingNodePanel node={makeNode()} themeId="t1" onUpdate={vi.fn()} />,
    );

    const labelInput = screen.getByPlaceholderText("엔딩 이름");
    fireEvent.change(labelInput, { target: { value: "마지막 입력" } });
    expect(mutateMock).not.toHaveBeenCalled();

    // Unmount — debounce timer 만료 전이라도 pending body는 자동 flush.
    unmount();
    expect(mutateMock).toHaveBeenCalledTimes(1);
    const [arg] = mutateMock.mock.calls[0] as [
      { nodeId: string; body: { data: { label: string } } },
    ];
    expect(arg.body.data.label).toBe("마지막 입력");
  });

  it("mutate 실패 시 graph cache가 rollback되고 toast.error가 발화한다", async () => {
    const { qc } = renderWithClient(
      <EndingNodePanel node={makeNode()} themeId="t1" onUpdate={vi.fn()} />,
    );
    const original = makeGraph("ending-1", { label: "원본" });
    qc.setQueryData(flowKeys.graph("t1"), original);

    const labelInput = screen.getByPlaceholderText("엔딩 이름");
    fireEvent.change(labelInput, { target: { value: "변경" } });

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(mutateMock).toHaveBeenCalledTimes(1);
    const [, opts] = mutateMock.mock.calls[0] as [
      unknown,
      { onError?: (e: Error) => void },
    ];
    expect(typeof opts?.onError).toBe("function");

    act(() => {
      opts.onError?.(new Error("boom"));
    });
    const cached = qc.getQueryData<FlowGraphResponse>(flowKeys.graph("t1"));
    const node = cached?.nodes.find((n) => n.id === "ending-1");
    expect((node?.data as { label?: string }).label).toBe("원본");
    expect(toastError).toHaveBeenCalledWith("저장에 실패했습니다");
  });
});
