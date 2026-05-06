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
  useEditorCharactersMock.mockReturnValue({
    data: characters,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
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

describe("InformationDeliveryPanel", () => {
  it("모든 페이즈에서 캐릭터별 정보 전달 설정을 추가할 수 있다", () => {
    const onChange = vi.fn();
    render(<InformationDeliveryPanel themeId="theme-1" phaseData={{}} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "캐릭터별 추가" }));

    expect(screen.getByText("받을 캐릭터를 선택하세요 · 0개 대사")).toBeDefined();
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

    fireEvent.change(screen.getByPlaceholderText("대사 이름으로 찾기"), {
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


  it("캐릭터 또는 읽기 대사 조회 실패를 빈 상태와 구분하고 재시도할 수 있다", () => {
    const refetchCharacters = vi.fn();
    const refetchSections = vi.fn();
    useEditorCharactersMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
      refetch: refetchCharacters,
    });
    useReadingSectionsMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
      refetch: refetchSections,
    });

    render(<InformationDeliveryPanel themeId="theme-1" phaseData={{}} onChange={vi.fn()} />);

    expect(screen.getByText("읽기 대사 전달에 필요한 캐릭터와 대사 목록을 불러오지 못했습니다.")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "다시 불러오기" }));

    expect(refetchCharacters).toHaveBeenCalledTimes(1);
    expect(refetchSections).toHaveBeenCalledTimes(1);
  });

  it("phaseData onEnter 변경이 들어오면 저장된 전달 설정을 다시 반영한다", () => {
    const firstPhaseData: FlowNodeData = {
      onEnter: [
        {
          id: "info",
          type: DELIVER_INFORMATION_ACTION,
          params: {
            deliveries: [
              {
                id: "d1",
                target: { type: "character", character_id: "char-1" },
                reading_section_ids: ["rs-1"],
              },
            ],
          },
        },
      ],
    };
    const nextPhaseData: FlowNodeData = {
      onEnter: [
        {
          id: "info",
          type: DELIVER_INFORMATION_ACTION,
          params: {
            deliveries: [
              {
                id: "d2",
                target: { type: "character", character_id: "char-2" },
                reading_section_ids: ["rs-2"],
              },
            ],
          },
        },
      ],
    };

    const { rerender } = render(
      <InformationDeliveryPanel themeId="theme-1" phaseData={firstPhaseData} onChange={vi.fn()} />,
    );
    expect(screen.getByText("탐정 A · 1개 대사")).toBeDefined();

    rerender(<InformationDeliveryPanel themeId="theme-1" phaseData={nextPhaseData} onChange={vi.fn()} />);

    expect(screen.getByText("용의자 B · 1개 대사")).toBeDefined();
  });


  it("캐릭터가 없으면 캐릭터별 추가를 비활성화하고 안내한다", () => {
    useEditorCharactersMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<InformationDeliveryPanel themeId="theme-1" phaseData={{}} onChange={vi.fn()} />);

    expect((screen.getByRole("button", { name: "캐릭터별 추가" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("아직 전달 설정이 없습니다. 전체 전달을 눌러 모든 플레이어에게 줄 공통 대사를 설정해 주세요.")).toBeDefined();
  });

  it("모든 페이즈에서 모든 플레이어 공통 전달을 추가할 수 있다", () => {
    const onChange = vi.fn();
    render(
      <InformationDeliveryPanel
        themeId="theme-1"
        phaseData={{ phase_type: "investigation" }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "전체 전달" }));

    expect(screen.getByText("모든 플레이어 · 0개 대사")).toBeDefined();
    expect(onChange).toHaveBeenCalledWith({ onEnter: [] });
  });
});
