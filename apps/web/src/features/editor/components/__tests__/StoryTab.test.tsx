import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../reading/ReadingSectionList", () => ({
  ReadingSectionList: ({ themeId }: { themeId: string }) => (
    <div data-testid="reading-section-list">{themeId}</div>
  ),
}));

import { StoryTab } from "../StoryTab";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("StoryTab", () => {
  it("읽기 대사 관리 화면만 렌더링한다", () => {
    render(<StoryTab themeId="theme-1" />);

    expect(screen.getByText("읽기 대사")).toBeDefined();
    expect(screen.getByText("장면에서 읽거나 들려줄 대사 묶음")).toBeDefined();
    expect(screen.getByText("스토리 진행 · 장면 설정")).toBeDefined();
    expect(screen.getByTestId("reading-section-list").textContent).toBe("theme-1");
  });

  it("사용하지 않는 마크다운 원고와 중복 장면 요약을 표시하지 않는다", () => {
    render(<StoryTab themeId="theme-1" />);

    expect(screen.queryByPlaceholderText("마크다운으로 스토리를 작성하세요...")).toBeNull();
    expect(screen.queryByText("스토리 장면 구성")).toBeNull();
    expect(screen.queryByText("장면별 정보 공개 설정")).toBeNull();
  });
});
