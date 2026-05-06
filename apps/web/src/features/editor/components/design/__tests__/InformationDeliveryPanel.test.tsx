import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { FlowNodeData } from "../../../flowTypes";
import { InformationDeliveryPanel } from "../InformationDeliveryPanel";
import { DELIVER_INFORMATION_ACTION } from "../phaseEditorAdapter";

const { useEditorCharactersMock, useReadingSectionsMock, useStoryInfosMock } = vi.hoisted(() => ({
  useEditorCharactersMock: vi.fn(),
  useReadingSectionsMock: vi.fn(),
  useStoryInfosMock: vi.fn(),
}));

vi.mock("../../../api", () => ({
  useEditorCharacters: () => useEditorCharactersMock(),
}));

vi.mock("../../../readingApi", () => ({
  useReadingSections: () => useReadingSectionsMock(),
}));

vi.mock("../../../storyInfoApi", () => ({
  useStoryInfos: () => useStoryInfosMock(),
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
const storyInfos = [
  {
    id: "info-1",
    themeId: "theme-1",
    title: "숨겨진 단서",
    body: "모두가 확인해야 하는 공개 정보",
    imageMediaId: null,
    relatedCharacterIds: [],
    relatedClueIds: [],
    relatedLocationIds: [],
    sortOrder: 0,
    version: 1,
    createdAt: "2026-05-06T00:00:00Z",
    updatedAt: "2026-05-06T00:00:00Z",
  },
  {
    id: "info-2",
    themeId: "theme-1",
    title: "비밀 통로",
    body: "서재 뒤쪽에 통로가 있다",
    imageMediaId: "media-1",
    relatedCharacterIds: [],
    relatedClueIds: [],
    relatedLocationIds: [],
    sortOrder: 1,
    version: 1,
    createdAt: "2026-05-06T00:00:00Z",
    updatedAt: "2026-05-06T00:00:00Z",
  },
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
  useStoryInfosMock.mockReturnValue({
    data: storyInfos,
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
  it("모든 페이즈에서 캐릭터별 장면 연결 설정을 추가할 수 있다", () => {
    const onChange = vi.fn();
    render(<InformationDeliveryPanel themeId="theme-1" phaseData={{}} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "캐릭터별 대상 추가" }));

    expect(screen.getByText("받을 캐릭터를 선택하세요 · 대사 0개 · 정보 0개")).toBeDefined();
    expect(onChange).toHaveBeenCalledWith({ onEnter: [] });
  });

  it("캐릭터, 읽기 대사, 공개 정보를 검색하고 선택/삭제할 수 있다", () => {
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
                story_info_ids: ["info-1"],
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
                story_info_ids: ["info-1"],
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
                story_info_ids: ["info-1"],
              },
            ],
          },
        },
      ],
    });

    fireEvent.change(screen.getByPlaceholderText("정보 제목으로 찾기"), {
      target: { value: "비밀" },
    });
    fireEvent.click(screen.getByRole("button", { name: /비밀 통로/ }));

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
                story_info_ids: ["info-1", "info-2"],
              },
            ],
          },
        },
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: "장면 연결 1 삭제" }));
    expect(onChange).toHaveBeenLastCalledWith({ onEnter: [] });
  });


  it("캐릭터 또는 읽기 대사 조회 실패를 빈 상태와 구분하고 재시도할 수 있다", () => {
    const refetchCharacters = vi.fn();
    const refetchSections = vi.fn();
    const refetchStoryInfos = vi.fn();
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
    useStoryInfosMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
      refetch: refetchStoryInfos,
    });

    render(<InformationDeliveryPanel themeId="theme-1" phaseData={{}} onChange={vi.fn()} />);

    expect(screen.getByText("장면 연결에 필요한 캐릭터, 읽기 대사, 정보 목록을 불러오지 못했습니다.")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "다시 불러오기" }));

    expect(refetchCharacters).toHaveBeenCalledTimes(1);
    expect(refetchSections).toHaveBeenCalledTimes(1);
    expect(refetchStoryInfos).toHaveBeenCalledTimes(1);
  });

  it("phaseData onEnter 변경이 들어오면 저장된 장면 연결 설정을 다시 반영한다", () => {
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
                story_info_ids: ["info-1"],
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
                story_info_ids: [],
              },
            ],
          },
        },
      ],
    };

    const { rerender } = render(
      <InformationDeliveryPanel themeId="theme-1" phaseData={firstPhaseData} onChange={vi.fn()} />,
    );
    expect(screen.getByText("탐정 A · 대사 1개 · 정보 1개")).toBeDefined();

    rerender(<InformationDeliveryPanel themeId="theme-1" phaseData={nextPhaseData} onChange={vi.fn()} />);

    expect(screen.getByText("용의자 B · 대사 1개 · 정보 0개")).toBeDefined();
  });


  it("캐릭터가 없으면 캐릭터별 대상 추가를 비활성화하고 안내한다", () => {
    useEditorCharactersMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<InformationDeliveryPanel themeId="theme-1" phaseData={{}} onChange={vi.fn()} />);

    expect((screen.getByRole("button", { name: "캐릭터별 대상 추가" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("아직 장면 연결이 없습니다. 전체 대상 추가를 눌러 모든 플레이어가 볼 대사나 정보를 연결해 주세요.")).toBeDefined();
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

    fireEvent.click(screen.getByRole("button", { name: "전체 대상 추가" }));

    expect(screen.getByText("모든 플레이어 · 대사 0개 · 정보 0개")).toBeDefined();
    expect(onChange).toHaveBeenCalledWith({ onEnter: [] });
  });
});
