import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { FlowGraphResponse } from "../../../flowTypes";
import { DELIVER_INFORMATION_ACTION } from "../phaseEditorAdapter";
import { StoryInformationDeliverySection } from "../StoryInformationDeliverySection";

const { mutateMock, useEditorCharactersMock, useReadingSectionsMock } = vi.hoisted(() => ({
  mutateMock: vi.fn(),
  useEditorCharactersMock: vi.fn(),
  useReadingSectionsMock: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

vi.mock("../../../flowApi", () => ({
  useUpdateFlowNode: () => ({ mutate: mutateMock }),
}));

vi.mock("../../../api", () => ({
  useEditorCharacters: () => useEditorCharactersMock(),
}));

vi.mock("../../../readingApi", () => ({
  useReadingSections: () => useReadingSectionsMock(),
}));

vi.stubGlobal("crypto", { randomUUID: () => "delivery-new" });

const graph: FlowGraphResponse = {
  nodes: [
    {
      id: "scene-2",
      theme_id: "theme-1",
      type: "phase",
      data: { label: "조사 시작", phase_type: "investigation" },
      position_x: 120,
      position_y: 200,
      created_at: "2026-05-05T00:00:00Z",
      updated_at: "2026-05-05T00:00:00Z",
    },
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
};

beforeEach(() => {
  mutateMock.mockClear();
  useEditorCharactersMock.mockReturnValue({
    data: [{ id: "char-1", name: "탐정 A" }],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  useReadingSectionsMock.mockReturnValue({
    data: [{ id: "rs-1", name: "공통 규칙", lines: [{ Text: "규칙" }] }],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("StoryInformationDeliverySection", () => {
  it("스토리 탭에서 장면을 선택해 정보 공개 설정을 저장한다", () => {
    render(<StoryInformationDeliverySection themeId="theme-1" graph={graph} />);

    expect(screen.getByText("장면별 정보 공개 설정")).toBeDefined();
    expect(screen.getByText("오프닝")).toBeDefined();
    expect(screen.getByText("조사 시작")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /조사 시작/ }));
    fireEvent.click(screen.getByRole("button", { name: "전체 전달" }));
    fireEvent.click(screen.getByRole("button", { name: /공통 규칙/ }));

    expect(mutateMock).toHaveBeenLastCalledWith(
      {
        nodeId: "scene-2",
        body: {
          data: {
            label: "조사 시작",
            phase_type: "investigation",
            onEnter: [
              {
                id: "delivery-new",
                type: DELIVER_INFORMATION_ACTION,
                params: {
                  deliveries: [
                    {
                      id: "delivery-new",
                      target: { type: "all_players" },
                      reading_section_ids: ["rs-1"],
                    },
                  ],
                },
              },
            ],
          },
        },
      },
      expect.any(Object),
    );
  });

  it("장면이 없으면 정보 공개 설정 대신 빈 상태를 보여준다", () => {
    render(<StoryInformationDeliverySection themeId="theme-1" graph={{ nodes: [], edges: [] }} />);

    expect(screen.getByText("0개")).toBeDefined();
    expect(screen.getByText("스토리 진행에서 장면을 추가하면 정보 공개 대상을 설정할 수 있습니다.")).toBeDefined();
    expect(screen.queryByText("장면 선택")).toBeNull();
  });
});
