import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

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

import { PhaseNodePanel } from "../PhaseNodePanel";
import { flowKeys } from "../../../flowTypes";
import type { FlowGraphResponse } from "../../../flowTypes";

// ---------------------------------------------------------------------------
// Render helper with QueryClient
// ---------------------------------------------------------------------------

function renderWithClient(ui: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    qc,
    ...render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>),
  };
}

const makeGraph = (nodeId = "node-1", data: Record<string, unknown> = {}): FlowGraphResponse => ({
  nodes: [
    {
      id: nodeId,
      theme_id: "t1",
      type: "phase",
      position_x: 0,
      position_y: 0,
      data: { label: "테스트", ...data },
      created_at: "2026-04-15T00:00:00Z",
      updated_at: "2026-04-15T00:00:00Z",
    },
  ],
  edges: [],
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeNode = (data: Record<string, unknown> = {}) => ({
  id: "node-1",
  type: "phase" as const,
  position: { x: 0, y: 0 },
  data: { label: "테스트", ...data },
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();
  useUpdateFlowNodeMock.mockReturnValue({ mutate: mutateMock });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests: debounce + onBlur flush (PR-5)
// ---------------------------------------------------------------------------

describe("PhaseNodePanel debounce + onBlur flush", () => {
  it("debounce 1500ms 후에 mutate가 1회 호출된다", async () => {
    render(
      <PhaseNodePanel
        node={makeNode()}
        themeId="t1"
        onUpdate={vi.fn()}
      />,
    );

    const labelInput = screen.getByPlaceholderText("페이즈 이름");
    fireEvent.change(labelInput, { target: { value: "수사 페이즈" } });

    // 500ms old threshold — must NOT fire (regression guard).
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(mutateMock).not.toHaveBeenCalled();

    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(mutateMock).toHaveBeenCalledTimes(1);
    const [arg] = mutateMock.mock.calls[0] as [
      { nodeId: string; body: { data: { label: string } } },
    ];
    expect(arg.nodeId).toBe("node-1");
    expect(arg.body.data.label).toBe("수사 페이즈");
  });

  it("연속 change는 한 번만 저장된다 (debounce 재시작)", async () => {
    render(
      <PhaseNodePanel
        node={makeNode()}
        themeId="t1"
        onUpdate={vi.fn()}
      />,
    );

    const labelInput = screen.getByPlaceholderText("페이즈 이름");
    fireEvent.change(labelInput, { target: { value: "A" } });
    await act(async () => { vi.advanceTimersByTime(1000); });
    fireEvent.change(labelInput, { target: { value: "AB" } });
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(mutateMock).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(mutateMock).toHaveBeenCalledTimes(1);
  });

  it("onBlur 발생 시 timer 대기 없이 즉시 저장된다", () => {
    render(
      <PhaseNodePanel
        node={makeNode()}
        themeId="t1"
        onUpdate={vi.fn()}
      />,
    );

    const labelInput = screen.getByPlaceholderText("페이즈 이름");
    fireEvent.change(labelInput, { target: { value: "즉시" } });
    expect(mutateMock).not.toHaveBeenCalled();

    fireEvent.blur(labelInput);
    // No fake-timer advance — flush is synchronous.
    expect(mutateMock).toHaveBeenCalledTimes(1);
    const [arg] = mutateMock.mock.calls[0] as [
      { body: { data: { label: string } } },
    ];
    expect(arg.body.data.label).toBe("즉시");
  });

  it("select onBlur도 flush된다", () => {
    render(
      <PhaseNodePanel
        node={makeNode()}
        themeId="t1"
        onUpdate={vi.fn()}
      />,
    );

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "voting" } });
    fireEvent.blur(select);
    expect(mutateMock).toHaveBeenCalledTimes(1);
    const [arg] = mutateMock.mock.calls[0] as [
      { body: { data: { phase_type: string } } },
    ];
    expect(arg.body.data.phase_type).toBe("voting");
  });

  it("pending이 없으면 onBlur는 mutate를 호출하지 않는다", () => {
    render(
      <PhaseNodePanel
        node={makeNode()}
        themeId="t1"
        onUpdate={vi.fn()}
      />,
    );

    const labelInput = screen.getByPlaceholderText("페이즈 이름");
    fireEvent.blur(labelInput);
    expect(mutateMock).not.toHaveBeenCalled();
  });
});
