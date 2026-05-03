import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

const { useFlowDataMock, addNodeMock, updateNodeDataMock } = vi.hoisted(() => ({
  useFlowDataMock: vi.fn(),
  addNodeMock: vi.fn(),
  updateNodeDataMock: vi.fn(),
}));

vi.mock("../../../hooks/useFlowData", () => ({
  useFlowData: () => useFlowDataMock(),
}));

import { EndingEntitySubTab } from "../EndingEntitySubTab";

const makeNode = (id: string, data: Record<string, unknown> = {}, type = "ending") => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: { label: "진실", description: "사건의 전말", ...data },
});

beforeEach(() => {
  useFlowDataMock.mockReturnValue({
    nodes: [
      makeNode("ending-1", { label: "진실", icon: "🎭", endingContent: "범인은 밝혀졌다." }),
      makeNode("phase-1", { label: "1막" }, "phase"),
      makeNode("ending-2", { label: "오판", description: "잘못된 선택" }),
    ],
    isLoading: false,
    addNode: addNodeMock,
    updateNodeData: updateNodeDataMock,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("EndingEntitySubTab", () => {
  it("Flow의 ending 노드만 결말 목록에 표시한다", () => {
    render(<EndingEntitySubTab themeId="theme-1" />);

    expect(screen.getByText("결말 목록")).toBeDefined();
    expect(screen.getAllByText("진실").length).toBeGreaterThan(0);
    expect(screen.getAllByText("오판").length).toBeGreaterThan(0);
    expect(screen.queryByText("1막")).toBeNull();
  });

  it("결말이 없으면 제작자가 이해할 수 있는 빈 상태를 보여준다", () => {
    useFlowDataMock.mockReturnValue({
      nodes: [],
      isLoading: false,
      addNode: addNodeMock,
      updateNodeData: updateNodeDataMock,
    });

    render(<EndingEntitySubTab themeId="theme-1" />);

    expect(screen.getByText("아직 결말이 없습니다")).toBeDefined();
    expect(screen.getByText(/Flow에서 결말 노드를 추가하면/)).toBeDefined();
  });

  it("결말 추가 버튼은 ending 노드 생성을 요청한다", () => {
    render(<EndingEntitySubTab themeId="theme-1" />);

    fireEvent.click(screen.getByText("결말 추가"));

    expect(addNodeMock).toHaveBeenCalledWith("ending", expect.objectContaining({ x: expect.any(Number), y: 220 }));
  });

  it("검색어로 결말 목록을 좁힌다", () => {
    render(<EndingEntitySubTab themeId="theme-1" />);

    fireEvent.change(screen.getByPlaceholderText("결말 검색"), { target: { value: "오판" } });

    expect(screen.getAllByText("오판").length).toBeGreaterThan(0);
    expect(screen.queryByText("진실")).toBeNull();
  });

  it("상세 입력을 변경하면 선택한 결말 노드 데이터만 갱신한다", () => {
    render(<EndingEntitySubTab themeId="theme-1" />);

    fireEvent.change(screen.getByLabelText("결말 이름"), { target: { value: "자비" } });

    expect(updateNodeDataMock).toHaveBeenCalledWith("ending-1", { label: "자비" });
  });
});
