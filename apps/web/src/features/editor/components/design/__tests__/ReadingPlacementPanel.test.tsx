import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DELIVER_INFORMATION_ACTION } from "../../../entities/shared/actionAdapter";
import { ReadingPlacementPanel } from "../ReadingPlacementPanel";

const { useReadingSectionsMock } = vi.hoisted(() => ({
  useReadingSectionsMock: vi.fn(),
}));

vi.mock("../../../readingApi", () => ({
  useReadingSections: () => useReadingSectionsMock(),
}));

const sections = [
  { id: "rs-1", name: "오프닝 낭독", lines: [{ Text: "시작" }] },
  { id: "rs-2", name: "비밀 편지", lines: [{ Text: "편지" }] },
];

beforeEach(() => {
  useReadingSectionsMock.mockReturnValue({
    data: sections,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ReadingPlacementPanel", () => {
  it("읽기 대사를 검색하고 선택/제거할 수 있다", () => {
    const onChange = vi.fn();
    render(<ReadingPlacementPanel themeId="theme-1" phaseData={{}} onChange={onChange} />);

    fireEvent.change(screen.getByPlaceholderText("대사 이름으로 찾기"), {
      target: { value: "편지" },
    });
    fireEvent.click(screen.getByRole("button", { name: /비밀 편지/ }));

    expect(onChange).toHaveBeenLastCalledWith({
      onEnter: [
        {
          id: expect.any(String),
          type: DELIVER_INFORMATION_ACTION,
          params: {
            deliveries: [
              {
                id: "reading-placement",
                target: { type: "all_players" },
                reading_section_ids: ["rs-2"],
                story_info_ids: [],
              },
            ],
          },
        },
      ],
    });
  });

  it("기존 저장된 읽기 대사 연결을 선택 상태로 표시한다", () => {
    render(
      <ReadingPlacementPanel
        themeId="theme-1"
        phaseData={{
          onEnter: [
            {
              id: "info",
              type: DELIVER_INFORMATION_ACTION,
              params: {
                deliveries: [
                  { id: "d1", target: { type: "character", character_id: "char-1" }, reading_section_ids: ["rs-1"] },
                ],
              },
            },
          ],
        }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("1개 선택")).toBeDefined();
    expect(screen.getAllByText("오프닝 낭독").length).toBeGreaterThan(0);
  });

  it("조회 실패를 빈 상태와 구분하고 재시도할 수 있다", () => {
    const refetch = vi.fn();
    useReadingSectionsMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
      refetch,
    });

    render(<ReadingPlacementPanel themeId="theme-1" phaseData={{}} onChange={vi.fn()} />);

    expect(screen.getByText("읽기 대사 목록을 불러오지 못했습니다.")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "다시 불러오기" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
