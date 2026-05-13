import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import type { Edge, Node } from "@xyflow/react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

vi.mock("../PhaseNodePanel", () => ({
  PhaseNodePanel: ({ headerActions }: { headerActions?: ReactNode }) => (
    <div>
      <div data-testid="scene-settings-header">
        <span>장면 설정</span>
        {headerActions}
      </div>
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { NodeDetailPanel } from "../NodeDetailPanel";

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(type: string, data: Record<string, unknown> = {}): Node {
  return {
    id: "node-1",
    type,
    position: { x: 0, y: 0 },
    data,
  };
}

const storyNodes: Node[] = [
  makeNode("phase", { label: "오프닝" }),
  { ...makeNode("phase", { label: "조사" }), id: "node-2" },
  { ...makeNode("ending", { label: "엔딩" }), id: "node-3" },
];

const storyEdges: Edge[] = [{ id: "edge-1", source: "node-1", target: "node-2" }];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("NodeDetailPanel", () => {
  it("node가 null이면 '편집할 장면을 선택하세요' 를 표시한다", () => {
    render(
      <NodeDetailPanel
        node={null}
        themeId="t1"
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("편집할 장면을 선택하세요")).toBeDefined();
  });

  it("start 노드이면 편집 불가 메시지를 표시한다", () => {
    render(
      <NodeDetailPanel
        node={makeNode("start")}
        themeId="t1"
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("시작 지점은 고정되어 있어 편집할 수 없습니다")).toBeDefined();
  });

  it("start 노드에는 삭제 버튼이 없다", () => {
    render(
      <NodeDetailPanel
        node={makeNode("start")}
        themeId="t1"
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.queryByText("장면 삭제")).toBeNull();
  });

  it("start 노드에서도 다음 장면 연결을 편집할 수 있다", () => {
    const onConnectNodes = vi.fn();
    render(
      <NodeDetailPanel
        node={{ ...makeNode("start"), id: "start-1" }}
        themeId="t1"
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        nodes={[
          { ...makeNode("start"), id: "start-1" },
          { ...makeNode("phase", { label: "오프닝" }), id: "node-1" },
        ]}
        edges={[]}
        onConnectNodes={onConnectNodes}
        onDeleteEdge={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("연결할 다음 장면"), {
      target: { value: "node-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "연결" }));

    expect(onConnectNodes).toHaveBeenCalledWith("start-1", "node-1");
  });

  it("phase 노드이면 PhaseNodePanel을 렌더링한다", () => {
    render(
      <NodeDetailPanel
        node={makeNode("phase", { label: "수사 단계" })}
        themeId="t1"
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("장면 설정")).toBeDefined();
  });

  it("phase 노드에는 삭제 버튼이 있다", () => {
    render(
      <NodeDetailPanel
        node={makeNode("phase")}
        themeId="t1"
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("장면 삭제")).toBeDefined();
  });

  it("삭제 버튼 클릭 시 onDelete가 노드 id와 함께 호출된다", () => {
    const onDelete = vi.fn();
    render(
      <NodeDetailPanel
        node={makeNode("phase")}
        themeId="t1"
        onUpdate={vi.fn()}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByText("장면 삭제"));
    const dialog = screen.getByRole("dialog", { name: "장면을 삭제할까요?" });
    expect(within(dialog).getByText("연결된 선도 함께 삭제됩니다.")).toBeDefined();
    fireEvent.click(within(dialog).getByRole("button", { name: "장면 삭제" }));
    expect(onDelete).toHaveBeenCalledWith("node-1");
  });

  it("삭제 확인을 취소하면 onDelete를 호출하지 않는다", () => {
    const onDelete = vi.fn();
    render(
      <NodeDetailPanel
        node={makeNode("phase")}
        themeId="t1"
        onUpdate={vi.fn()}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByText("장면 삭제"));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "장면을 삭제할까요?" })).getByRole(
        "button",
        { name: "취소" },
      ),
    );

    expect(onDelete).not.toHaveBeenCalled();
  });

  it("복제 버튼 클릭 시 onDuplicate가 노드 id와 함께 호출된다", () => {
    const onDuplicate = vi.fn();
    render(
      <NodeDetailPanel
        node={makeNode("phase")}
        themeId="t1"
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={onDuplicate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "장면 복제" }));

    expect(onDuplicate).toHaveBeenCalledWith("node-1");
  });

  it("장면 액션은 장면 설정 제목 줄에 보여준다", () => {
    render(
      <NodeDetailPanel
        node={storyNodes[0]}
        themeId="t1"
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        nodes={storyNodes}
        edges={[]}
        onConnectNodes={vi.fn()}
        onDeleteEdge={vi.fn()}
      />,
    );

    const header = screen.getByTestId("scene-settings-header");
    const duplicateButton = screen.getByRole("button", { name: "장면 복제" });
    const deleteButton = screen.getByRole("button", { name: "장면 삭제" });

    expect(header.contains(duplicateButton)).toBe(true);
    expect(header.contains(deleteButton)).toBe(true);
  });

  it("선택한 장면에서 다음 장면을 버튼으로 연결할 수 있다", () => {
    const onConnectNodes = vi.fn();
    render(
      <NodeDetailPanel
        node={storyNodes[0]}
        themeId="t1"
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        nodes={storyNodes}
        edges={[]}
        onConnectNodes={onConnectNodes}
        onDeleteEdge={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("연결할 다음 장면"), {
      target: { value: "node-2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "연결" }));

    expect(onConnectNodes).toHaveBeenCalledWith("node-1", "node-2");
  });

  it("선택한 장면에서 기존 연결을 해제할 수 있다", () => {
    const onDeleteEdge = vi.fn();
    render(
      <NodeDetailPanel
        node={storyNodes[0]}
        themeId="t1"
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        nodes={storyNodes}
        edges={storyEdges}
        onConnectNodes={vi.fn()}
        onDeleteEdge={onDeleteEdge}
      />,
    );

    expect(screen.getByText("조사")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "조사 연결 해제" }));

    expect(onDeleteEdge).toHaveBeenCalledWith("edge-1");
  });
});
