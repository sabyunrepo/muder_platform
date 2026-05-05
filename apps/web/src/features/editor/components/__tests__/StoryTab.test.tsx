import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useFlowGraphMock = vi.fn();

vi.mock("@/features/editor/api", () => ({
  useEditorContent: () => ({
    data: { body: "# 오프닝\n\n플레이어가 저택에 도착한다." },
  }),
  useUpsertContent: () => ({
    mutateAsync: vi.fn(),
  }),
}));

vi.mock("@/features/editor/flowApi", () => ({
  useFlowGraph: () => useFlowGraphMock(),
}));

vi.mock("@/features/editor/hooks/useAutoSave", () => ({
  useAutoSave: vi.fn(),
}));

vi.mock("@/features/editor/components/reading/ReadingSectionList", () => ({
  ReadingSectionList: ({ themeId }: { themeId: string }) => (
    <div data-testid="reading-section-list">{themeId}</div>
  ),
}));

vi.mock("@/features/editor/components/design/StoryInformationDeliverySection", () => ({
  StoryInformationDeliverySection: ({ themeId }: { themeId: string }) => (
    <div data-testid="story-information-delivery-section">{themeId}</div>
  ),
}));

import { StoryTab } from "../StoryTab";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("StoryTab", () => {
  beforeEach(() => {
    useFlowGraphMock.mockReturnValue({
      data: {
        nodes: [
          {
            id: "scene-1",
            theme_id: "theme-1",
            type: "phase",
            data: { label: "오프닝", phase_type: "story_progression" },
            position_x: 100,
            position_y: 100,
            created_at: "2026-05-05T00:00:00Z",
            updated_at: "2026-05-05T00:00:00Z",
          },
        ],
        edges: [],
      },
      isLoading: false,
      isError: false,
    });
  });

  it("스토리 원고와 장면 기반 진행 요약을 함께 렌더링한다", async () => {
    render(<StoryTab themeId="theme-1" />);

    expect(await screen.findByDisplayValue(/플레이어가 저택에 도착한다/)).toBeDefined();
    expect(screen.getByText("스토리 장면 구성")).toBeDefined();
    expect(screen.getByText("1개 장면")).toBeDefined();
    expect(screen.getAllByText("오프닝").length).toBeGreaterThan(0);
    expect(screen.getByTestId("reading-section-list").textContent).toBe("theme-1");
    expect(screen.getByTestId("story-information-delivery-section").textContent).toBe("theme-1");
  });

  it("장면 구성을 불러오는 동안 빈 장면 요약을 보여주지 않는다", async () => {
    useFlowGraphMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    render(<StoryTab themeId="theme-1" />);

    expect(await screen.findByText("스토리 장면 구성을 불러오는 중입니다.")).toBeDefined();
    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
    expect(screen.getByRole("status").getAttribute("aria-atomic")).toBe("true");
    expect(screen.queryByText("0개 장면")).toBeNull();
  });

  it("장면 구성 로드 실패를 빈 장면 상태와 분리한다", async () => {
    useFlowGraphMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    render(<StoryTab themeId="theme-1" />);

    expect(await screen.findByText("스토리 장면 구성을 불러오지 못했습니다.")).toBeDefined();
    expect(screen.getByRole("alert").getAttribute("aria-live")).toBe("assertive");
    expect(screen.getByRole("alert").getAttribute("aria-atomic")).toBe("true");
    expect(screen.queryByText("0개 장면")).toBeNull();
  });

  it("장면이 없으면 빈 장면 요약을 명시적으로 보여준다", async () => {
    useFlowGraphMock.mockReturnValue({
      data: { nodes: [], edges: [] },
      isLoading: false,
      isError: false,
    });

    render(<StoryTab themeId="theme-1" />);

    expect(await screen.findByText("0개 장면")).toBeDefined();
    expect(screen.getByText("장면을 추가하면 스토리 진행 구성이 여기에 표시됩니다.")).toBeDefined();
  });
});
