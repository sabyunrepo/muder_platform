import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { FlowSimulationPanel } from "../FlowSimulationPanel";
import type { Node, Edge } from "@xyflow/react";

afterEach(cleanup);

const makeNodes = (): Node[] => [
  { id: "s1", type: "start", position: { x: 0, y: 0 }, data: {} },
  { id: "p1", type: "phase", position: { x: 250, y: 0 }, data: { label: "조사", duration: 10 } },
  { id: "p2", type: "phase", position: { x: 500, y: 0 }, data: { label: "투표", duration: 5 } },
  { id: "e1", type: "ending", position: { x: 750, y: 0 }, data: {} },
];

const makeEdges = (): Edge[] => [
  { id: "e-s1-p1", source: "s1", target: "p1" },
  { id: "e-p1-p2", source: "p1", target: "p2" },
  { id: "e-p2-e1", source: "p2", target: "e1" },
];

describe("FlowSimulationPanel", () => {
  it("페이즈 노드가 없으면 빈 상태 메시지를 표시한다", () => {
    render(
      <FlowSimulationPanel
        nodes={[]}
        edges={[]}
        onHighlight={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/페이즈 노드가 없습니다/)).toBeDefined();
  });

  it("첫 페이즈 이름과 진행도를 표시한다", () => {
    render(
      <FlowSimulationPanel
        nodes={makeNodes()}
        edges={makeEdges()}
        onHighlight={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("조사")).toBeDefined();
    expect(screen.getByText(/1 \/ 2 페이즈/)).toBeDefined();
  });

  it("다음 버튼 클릭 시 다음 페이즈로 이동한다", () => {
    const onHighlight = vi.fn();
    render(
      <FlowSimulationPanel
        nodes={makeNodes()}
        edges={makeEdges()}
        onHighlight={onHighlight}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTitle("다음"));
    expect(screen.getByText("투표")).toBeDefined();
    expect(onHighlight).toHaveBeenCalledWith("p2");
  });

  it("총 소요시간을 표시한다", () => {
    render(
      <FlowSimulationPanel
        nodes={makeNodes()}
        edges={makeEdges()}
        onHighlight={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/총 15분/)).toBeDefined();
  });

  it("닫기 시 하이라이트를 해제한다", () => {
    const onHighlight = vi.fn();
    const onClose = vi.fn();
    render(
      <FlowSimulationPanel
        nodes={makeNodes()}
        edges={makeEdges()}
        onHighlight={onHighlight}
        onClose={onClose}
      />,
    );
    // Close button in header
    const closeButtons = screen.getAllByRole("button");
    const closeBtn = closeButtons.find((b) => !b.title || b.title === "");
    fireEvent.click(closeBtn!);
    expect(onHighlight).toHaveBeenCalledWith(null);
    expect(onClose).toHaveBeenCalled();
  });
});
