import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { FlowNodeData } from "../../../flowTypes";
import { InformationDeliveryPanel } from "../InformationDeliveryPanel";
import { DELIVER_INFORMATION_ACTION } from "../phaseEditorAdapter";

const { useEditorCharactersMock, useReadingSectionsMock } = vi.hoisted(() => ({
  useEditorCharactersMock: vi.fn(),
  useReadingSectionsMock: vi.fn(),
}));

vi.mock("../../../api", () => ({
  useEditorCharacters: () => useEditorCharactersMock(),
}));

vi.mock("../../../readingApi", () => ({
  useReadingSections: () => useReadingSectionsMock(),
}));

vi.stubGlobal("crypto", { randomUUID: () => "delivery-new" });

const characters = [
  { id: "char-1", name: "탐정 A" },
  { id: "char-2", name: "용의자 B" },
];

const sections = [
  { id: "rs-1", name: "비밀 편지", lines: [{ Text: "편지" }] },
  { id: "rs-2", name: "저택 소문", lines: [{ Text: "소문" }, { Text: "증언" }] },
];

beforeEach(() => {
  useEditorCharactersMock.mockReturnValue({ data: characters, isLoading: false });
  useReadingSectionsMock.mockReturnValue({ data: sections, isLoading: false });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("InformationDeliveryPanel", () => {
  it("모든 페이즈에서 캐릭터별 정보 전달 설정을 추가할 수 있다", () => {
    const onChange = vi.fn();
    render(<InformationDeliveryPanel themeId="theme-1" phaseData={{}} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "캐릭터별 추가" }));

    expect(screen.getByText("받을 캐릭터를 선택하세요 · 0개 정보")).toBeDefined();
    expect(onChange).toHaveBeenCalledWith({ onEnter: [] });
  });

  it("캐릭터와 전달 정보를 검색하고 여러 정보를 선택/삭제할 수 있다", () => {
    const onChange = vi.fn();
    const phaseData: FlowNodeData = {
      onEnter: [
        {
          id: "info",
          type: DELIVER_INFORMATION_ACTION,
          params: {
            deliveries: [
              {
                id: "d1",
                target: { type: "character" },
                reading_section_ids: ["rs-1"],
              },
            ],
          },
        },
      ],
    };

    render(<InformationDeliveryPanel themeId="theme-1" phaseData={phaseData} onChange={onChange} />);

    fireEvent.change(screen.getByPlaceholderText("이름으로 찾기"), {
      target: { value: "용의자" },
    });
    fireEvent.click(screen.getByRole("button", { name: /용의자 B/ }));

    expect(onChange).toHaveBeenLastCalledWith({
      onEnter: [
        {
          id: "info",
          type: DELIVER_INFORMATION_ACTION,
          params: {
            deliveries: [
              {
                id: "d1",
                target: { type: "character", character_id: "char-2" },
                reading_section_ids: ["rs-1"],
              },
            ],
          },
        },
      ],
    });

    fireEvent.change(screen.getByPlaceholderText("정보 이름으로 찾기"), {
      target: { value: "저택" },
    });
    fireEvent.click(screen.getByRole("button", { name: /저택 소문/ }));

    expect(onChange).toHaveBeenLastCalledWith({
      onEnter: [
        {
          id: "info",
          type: DELIVER_INFORMATION_ACTION,
          params: {
            deliveries: [
              {
                id: "d1",
                target: { type: "character", character_id: "char-2" },
                reading_section_ids: ["rs-1", "rs-2"],
              },
            ],
          },
        },
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: "전달 설정 1 삭제" }));
    expect(onChange).toHaveBeenLastCalledWith({ onEnter: [] });
  });

  it("스토리 진행 페이즈에서는 모든 플레이어 공통 전달을 추가할 수 있다", () => {
    const onChange = vi.fn();
    render(
      <InformationDeliveryPanel
        themeId="theme-1"

        phaseData={{ phase_type: "story_progression" }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "전체 전달" }));

    expect(screen.getByText("모든 플레이어 · 0개 정보")).toBeDefined();
    expect(onChange).toHaveBeenCalledWith({ onEnter: [] });
  });
});
