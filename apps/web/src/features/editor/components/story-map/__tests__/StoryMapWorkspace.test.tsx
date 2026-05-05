import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../design/FlowCanvas", () => ({
  FlowCanvas: ({ themeId }: { themeId: string }) => (
    <div data-testid="flow-canvas">flow canvas {themeId}</div>
  ),
}));

import { StoryMapWorkspace } from "../StoryMapWorkspace";

afterEach(() => {
  cleanup();
});

describe("StoryMapWorkspace", () => {
  it("스토리 진행 중심 제작 화면과 플로우 캔버스를 함께 렌더링한다", () => {
    render(<StoryMapWorkspace themeId="theme-1" />);

    expect(screen.getByRole("heading", { name: "스토리 진행 제작" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "제작 라이브러리" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "장면 속성" })).toBeDefined();
    expect(screen.getByTestId("flow-canvas").textContent).toContain("theme-1");
  });

  it("작성자가 장면 흐름에 연결할 엔티티 묶음을 볼 수 있다", () => {
    render(<StoryMapWorkspace themeId="theme-1" />);

    expect(screen.getByText("PC 캐릭터")).toBeDefined();
    expect(screen.getByText("단서")).toBeDefined();
    expect(screen.getByText("장소")).toBeDefined();
    expect(screen.getByText("토론방")).toBeDefined();
    expect(screen.getByText("조사권")).toBeDefined();
    expect(screen.getByText("연출")).toBeDefined();
  });
});
