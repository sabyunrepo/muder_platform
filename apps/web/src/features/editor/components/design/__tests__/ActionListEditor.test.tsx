import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ActionListEditor,
  hasIncompletePresentationCueActions,
} from "../ActionListEditor";

const { useEditorCharactersMock, useEditorCluesMock, useMediaListMock } = vi.hoisted(() => ({
  useEditorCharactersMock: vi.fn(),
  useEditorCluesMock: vi.fn(),
  useMediaListMock: vi.fn(),
}));

vi.mock("../../../api/characters", () => ({
  useEditorCharacters: (...args: unknown[]) => useEditorCharactersMock(...args),
}));

vi.mock("../../../editorClueApi", () => ({
  useEditorClues: (...args: unknown[]) => useEditorCluesMock(...args),
}));

vi.mock("../../../mediaApi", () => ({
  useMediaList: (...args: unknown[]) => useMediaListMock(...args),
}));

vi.mock("../../media/MediaPicker", () => ({
  MediaPicker: ({
    open,
    title,
    filterType,
    useCase,
    selectedId,
    onSelect,
  }: {
    open: boolean;
    title?: string;
    filterType?: string;
    useCase?: string;
    selectedId?: string | null;
    onSelect: (media: { id: string }) => void;
  }) =>
    open ? (
      <button
        type="button"
        data-filter-type={filterType}
        data-use-case={useCase}
        data-selected-id={selectedId ?? ""}
        onClick={() => onSelect({ id: "media-1" })}
      >
        {title}
      </button>
    ) : null,
}));

vi.mock("../../../readingApi", () => ({
  useReadingSections: () => ({
    data: [
      {
        id: "reading-1",
        name: "금고 편지",
        lines: [{ Speaker: "", Text: "편지가 공개된다." }],
        bgmMediaId: null,
      },
    ],
  }),
}));

beforeEach(() => {
  useEditorCharactersMock.mockReturnValue({
    data: [
      { id: "character-1", name: "탐정" },
      { id: "character-2", name: "의사" },
    ],
    isLoading: false,
  });
  useEditorCluesMock.mockReturnValue({
    data: [
      { id: "clue-1", name: "금고 열쇠", is_common: false },
      { id: "clue-2", name: "공용 지도", is_common: true },
    ],
    isLoading: false,
  });
  useMediaListMock.mockImplementation((_themeId: string, type?: string) => ({
    data: [
      {
        id: "media-1",
        theme_id: "theme-1",
        name: type === "VIDEO" ? "엔딩 영상" : type === "IMAGE" ? "현장 사진" : "오프닝 BGM",
        type: type ?? "BGM",
        source_type: "FILE",
        tags: [],
        sort_order: 0,
        created_at: "2026-05-06T00:00:00Z",
      },
    ],
    isLoading: false,
  }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ActionListEditor", () => {
  it("새 트리거 실행 결과를 backend action 계약값으로 추가한다", () => {
    const onChange = vi.fn();

    render(<ActionListEditor label="장면 시작 트리거" actions={[]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ type: "OPEN_VOTING" }),
    ]);
    expect(screen.queryByText("OPEN_VOTING")).toBeNull();
  });

  it("legacy action 값도 제작자용 라벨로 보여준다", () => {
    render(
      <ActionListEditor
        label="장면 종료 트리거"
        actions={[{ id: "a1", type: "disable_chat" }]}
        onChange={vi.fn()}
      />,
    );

    const select = screen.getByRole("combobox", { name: "장면 종료 트리거 1 실행 결과" });
    expect(select).toHaveProperty("value", "disable_chat");
    expect(screen.getByRole("option", { name: "채팅 닫기 (기존값)" })).toBeDefined();
    expect(screen.getByRole("option", { name: "채팅 닫기" })).toBeDefined();
  });

  it("여러 실행 결과를 순서대로 저장 계약에 남긴다", () => {
    const onChange = vi.fn();
    render(
      <ActionListEditor
        label="비밀번호 트리거"
        actions={[
          { id: "a1", type: "OPEN_VOTING" },
          { id: "a2", type: "MUTE_CHAT" },
        ]}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "비밀번호 트리거 2 실행 결과" }), {
      target: { value: "STOP_AUDIO" },
    });

    expect(onChange).toHaveBeenCalledWith([
      { id: "a1", type: "OPEN_VOTING" },
      { id: "a2", type: "STOP_AUDIO" },
    ]);
  });

  it("연출 실행 결과의 미디어를 raw JSON 없이 params.mediaId로 저장한다", () => {
    const onChange = vi.fn();
    render(
      <ActionListEditor
        label="장면 시작 트리거"
        actions={[{ id: "bgm", type: "SET_BGM", params: {} }]}
        onChange={onChange}
        themeId="theme-1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "BGM 선택" }));
    const picker = screen.getByRole("button", { name: "장면 시작 트리거 1 BGM 선택" });
    expect(picker.getAttribute("data-filter-type")).toBe("BGM");
    expect(picker.getAttribute("data-use-case")).toBe("phase_bgm");
    fireEvent.click(picker);

    expect(onChange).toHaveBeenCalledWith([
      { id: "bgm", type: "SET_BGM", params: { mediaId: "media-1" } },
    ]);
  });

  it("배경 이미지 실행 결과를 이미지 picker의 params.mediaId로 저장한다", () => {
    const onChange = vi.fn();
    render(
      <ActionListEditor
        label="장면 시작 트리거"
        actions={[{ id: "bg", type: "SET_BACKGROUND", params: {} }]}
        onChange={onChange}
        themeId="theme-1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "배경 이미지 선택" }));
    const picker = screen.getByRole("button", { name: "장면 시작 트리거 1 배경 이미지 선택" });
    expect(picker.getAttribute("data-filter-type")).toBe("IMAGE");
    expect(picker.getAttribute("data-use-case")).toBe("presentation_background");
    fireEvent.click(picker);

    expect(onChange).toHaveBeenCalledWith([
      { id: "bg", type: "SET_BACKGROUND", params: { mediaId: "media-1" } },
    ]);
  });

  it("영상 연출 실행 결과는 VIDEO 미디어만 선택하도록 picker에 전달한다", () => {
    render(
      <ActionListEditor
        label="장면 연출"
        actions={[{ id: "video", type: "PLAY_MEDIA", params: { mediaId: "media-1" } }]}
        onChange={vi.fn()}
        themeId="theme-1"
      />,
    );

    expect(screen.getByText("엔딩 영상 · 영상")).toBeDefined();
    expect(screen.getByText("사용 위치: 장면 연출")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "영상 선택" }));
    const picker = screen.getByRole("button", { name: "장면 연출 1 영상 선택" });
    expect(picker.getAttribute("data-filter-type")).toBe("VIDEO");
    expect(picker.getAttribute("data-use-case")).toBe("video_action");
    expect(picker.getAttribute("data-selected-id")).toBe("media-1");
  });

  it("선택된 미디어가 목록에 없으면 삭제 또는 타입 불일치 상태를 표시하고 선택 해제할 수 있다", () => {
    useMediaListMock.mockReturnValue({ data: [], isLoading: false });
    const onChange = vi.fn();

    render(
      <ActionListEditor
        label="장면 연출"
        actions={[{ id: "bgm", type: "SET_BGM", params: { mediaId: "missing-media" } }]}
        onChange={onChange}
        themeId="theme-1"
      />,
    );

    expect(screen.getByText("선택한 미디어가 삭제됐거나 이 연출 유형과 맞지 않습니다.")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "선택 해제" }));

    expect(onChange).toHaveBeenCalledWith([{ id: "bgm", type: "SET_BGM", params: {} }]);
  });

  it("allowedTypes가 있으면 연출 cue만 추가하고 기존 일반 액션은 숨긴다", () => {
    const onChange = vi.fn();

    render(
      <ActionListEditor
        label="장면 연출"
        actions={[
          { id: "vote", type: "OPEN_VOTING" },
          { id: "bgm", type: "SET_BGM", params: { mediaId: "media-1" } },
        ]}
        allowedTypes={["SET_BGM", "PLAY_MEDIA"]}
        onChange={onChange}
        themeId="theme-1"
      />,
    );

    const select = screen.getByRole("combobox", { name: "장면 연출 1 실행 결과" });
    expect(select).toHaveProperty("value", "SET_BGM");
    expect(screen.queryByRole("option", { name: "투표 시작" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    expect(onChange).toHaveBeenCalledWith([
      { id: "vote", type: "OPEN_VOTING" },
      { id: "bgm", type: "SET_BGM", params: { mediaId: "media-1" } },
      expect.objectContaining({ type: "SET_BGM" }),
    ]);
  });

  it("preserveDisallowedActions가 켜지면 새 목록에 없는 기존 액션도 보존 표시한다", () => {
    render(
      <ActionListEditor
        label="장면 시작 액션"
        actions={[
          { id: "old-token", type: "GRANT_INVESTIGATION_TOKEN", params: { tokenId: "coin", amount: 1 } },
          { id: "bgm", type: "SET_BGM", params: { mediaId: "media-1" } },
        ]}
        allowedTypes={["SET_BGM"]}
        preserveDisallowedActions
        onChange={vi.fn()}
        themeId="theme-1"
      />,
    );

    expect(screen.getByRole("combobox", { name: "장면 시작 액션 1 실행 결과" })).toHaveProperty(
      "value",
      "GRANT_INVESTIGATION_TOKEN",
    );
    expect(screen.getByRole("option", { name: "조사권 추가 (기존값)" })).toBeDefined();
    expect(screen.getByRole("combobox", { name: "장면 시작 액션 2 실행 결과" })).toHaveProperty(
      "value",
      "SET_BGM",
    );
  });

  it("custom actionOptions와 기본 params로 장면 액션을 추가한다", () => {
    const onChange = vi.fn();

    render(
      <ActionListEditor
        label="장면 종료 액션"
        actions={[]}
        actionOptions={[{ value: "STOP_AUDIO", label: "BGM 종료" }]}
        allowedTypes={["STOP_AUDIO"]}
        createDefaultParamsForType={(type) => (type === "STOP_AUDIO" ? { scope: "bgm" } : undefined)}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ type: "STOP_AUDIO", params: { scope: "bgm" } }),
    ]);
  });

  it("조사권 추가 액션의 조사권 종류와 수량을 params로 저장한다", () => {
    const onChange = vi.fn();

    render(
      <ActionListEditor
        label="장면 시작 액션"
        actions={[{ id: "token", type: "GRANT_INVESTIGATION_TOKEN", params: { tokenId: "coin", amount: 1 } }]}
        investigationTokens={[
          { id: "coin", name: "동전", iconLabel: "코", defaultAmount: 2 },
          { id: "badge", name: "배지", iconLabel: "배", defaultAmount: 0 },
        ]}
        preserveDisallowedActions
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByDisplayValue("코 동전"), { target: { value: "badge" } });
    expect(onChange).toHaveBeenCalledWith([
      { id: "token", type: "GRANT_INVESTIGATION_TOKEN", params: { tokenId: "badge", amount: 1 } },
    ]);

    fireEvent.change(screen.getByRole("spinbutton", { name: "추가 수량" }), {
      target: { value: "3" },
    });
    expect(onChange).toHaveBeenLastCalledWith([
      { id: "token", type: "GRANT_INVESTIGATION_TOKEN", params: { tokenId: "coin", amount: 3 } },
    ]);
  });

  it("조사권 재설정 액션의 0 초기화 방식을 params로 저장한다", () => {
    const onChange = vi.fn();

    render(
      <ActionListEditor
        label="장면 시작 액션"
        actions={[
          { id: "token", type: "RESET_INVESTIGATION_TOKEN", params: { tokenId: "coin", mode: "default" } },
        ]}
        investigationTokens={[
          { id: "coin", name: "동전", iconLabel: "코", defaultAmount: 2 },
          { id: "badge", name: "배지", iconLabel: "배", defaultAmount: 0 },
        ]}
        preserveDisallowedActions
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "재설정 방식" }), {
      target: { value: "zero" },
    });

    expect(onChange).toHaveBeenCalledWith([
      { id: "token", type: "RESET_INVESTIGATION_TOKEN", params: { tokenId: "coin", mode: "zero" } },
    ]);
    expect(screen.getByText("시작 수량은 조사권 설정에서 정한 기본 지급량입니다.")).toBeDefined();
  });

  it("컬러 테마 실행 결과를 preset token으로 저장한다", () => {
    const onChange = vi.fn();
    render(
      <ActionListEditor
        label="장면 시작 트리거"
        actions={[{ id: "theme", type: "SET_THEME_COLOR", params: {} }]}
        onChange={onChange}
        themeId="theme-1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "긴장" }));

    expect(onChange).toHaveBeenCalledWith([
      { id: "theme", type: "SET_THEME_COLOR", params: { themeToken: "tension" } },
    ]);
  });

  it("themeId가 없으면 미디어 선택 버튼을 비활성화하고 안내문을 보여준다", () => {
    render(
      <ActionListEditor
        label="장면 시작 트리거"
        actions={[{ id: "bgm", type: "SET_BGM", params: {} }]}
        onChange={vi.fn()}
      />,
    );

    expect((screen.getByRole("button", { name: "BGM 선택" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByText("테마 화면에서 미디어를 선택할 수 있습니다.")).toBeDefined();
  });

  it("저장 전 연출 실행 결과의 mediaId 누락을 검출한다", () => {
    expect(hasIncompletePresentationCueActions([{ id: "bgm", type: "SET_BGM", params: {} }])).toBe(
      true,
    );
    expect(
      hasIncompletePresentationCueActions([
        { id: "bgm", type: "SET_BGM", params: { mediaId: "media-1" } },
        { id: "vote", type: "OPEN_VOTING" },
      ]),
    ).toBe(false);
    expect(
      hasIncompletePresentationCueActions([{ id: "theme", type: "SET_THEME_COLOR", params: {} }]),
    ).toBe(true);
    expect(
      hasIncompletePresentationCueActions([
        { id: "theme", type: "SET_THEME_COLOR", params: { themeToken: "noir" } },
      ]),
    ).toBe(false);
  });

  it("연출이 아닌 실행 결과로 바꾸면 미디어 params를 비운다", () => {
    const onChange = vi.fn();
    render(
      <ActionListEditor
        label="장면 종료 트리거"
        actions={[{ id: "bgm", type: "SET_BGM", params: { mediaId: "media-1" } }]}
        onChange={onChange}
        themeId="theme-1"
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "장면 종료 트리거 1 실행 결과" }), {
      target: { value: "OPEN_VOTING" },
    });

    expect(onChange).toHaveBeenCalledWith([{ id: "bgm", type: "OPEN_VOTING" }]);
  });

  it("읽기 대사 공개 실행 결과를 all players delivery params로 저장한다", () => {
    const onChange = vi.fn();
    render(
      <ActionListEditor
        label="단서 트리거"
        actions={[{ id: "info", type: "DELIVER_INFORMATION", params: { deliveries: [] } }]}
        onChange={onChange}
        themeId="theme-1"
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "단서 트리거 1 공개할 읽기 대사" }), {
      target: { value: "reading-1" },
    });

    expect(onChange).toHaveBeenCalledWith([
      {
        id: "info",
        type: "DELIVER_INFORMATION",
        params: {
          deliveries: [
            {
              id: "delivery-reading-1",
              target: { type: "all_players" },
              reading_section_ids: ["reading-1"],
            },
          ],
        },
      },
    ]);
  });

  it("숨겨진 실행 결과가 있어도 정보공개와 알림 필드는 화면 순번을 사용한다", () => {
    render(
      <ActionListEditor
        label="장면 시작 트리거"
        actions={[
          { id: "bgm", type: "SET_BGM", params: { mediaId: "media-1" } },
          { id: "info", type: "DELIVER_INFORMATION", params: { deliveries: [] } },
          { id: "broadcast", type: "BROADCAST_MESSAGE", params: { message: "" } },
        ]}
        hiddenTypes={["SET_BGM"]}
        onChange={vi.fn()}
        themeId="theme-1"
      />,
    );

    expect(
      screen.getByRole("combobox", { name: "장면 시작 트리거 1 공개할 읽기 대사" }),
    ).toBeDefined();
    expect(screen.getByRole("textbox", { name: "장면 시작 트리거 2 알림 문구" })).toBeDefined();
    expect(
      screen.queryByRole("combobox", { name: "장면 시작 트리거 2 공개할 읽기 대사" }),
    ).toBeNull();
    expect(screen.queryByRole("textbox", { name: "장면 시작 트리거 3 알림 문구" })).toBeNull();
  });

  it("legacy 읽기 대사 공개 실행 결과도 같은 필드와 필수값 검증을 사용한다", () => {
    render(
      <ActionListEditor
        label="단서 트리거"
        actions={[{ id: "legacy-info", type: "deliver_information", params: { deliveries: [] } }]}
        onChange={vi.fn()}
        themeId="theme-1"
      />,
    );

    expect(screen.getByRole("combobox", { name: "단서 트리거 1 공개할 읽기 대사" })).toBeDefined();
    expect(
      hasIncompletePresentationCueActions([
        { id: "legacy-info", type: "deliver_information", params: { deliveries: [] } },
      ]),
    ).toBe(true);
    expect(
      hasIncompletePresentationCueActions([
        {
          id: "legacy-info",
          type: "deliver_information",
          params: {
            deliveries: [
              {
                recipient_type: "all_players",
                readingSectionIds: ["reading-1"],
              },
            ],
          },
        },
      ]),
    ).toBe(false);
  });

  it("알림 보내기 실행 결과의 문구를 params.message로 저장한다", () => {
    const onChange = vi.fn();
    render(
      <ActionListEditor
        label="장소 트리거"
        actions={[{ id: "broadcast", type: "BROADCAST_MESSAGE", params: { message: "" } }]}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "장소 트리거 1 알림 문구" }), {
      target: { value: "금고가 열렸습니다." },
    });

    expect(onChange).toHaveBeenCalledWith([
      { id: "broadcast", type: "BROADCAST_MESSAGE", params: { message: "금고가 열렸습니다." } },
    ]);
  });

  it("알림 보내기 실행 결과의 대상을 params.target으로 저장한다", () => {
    const onChange = vi.fn();
    render(
      <ActionListEditor
        label="장소 트리거"
        actions={[{ id: "broadcast", type: "BROADCAST_MESSAGE", params: { message: "확인" } }]}
        onChange={onChange}
        themeId="theme-1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /탐정/ }));

    expect(onChange).toHaveBeenCalledWith([
      {
        id: "broadcast",
        type: "BROADCAST_MESSAGE",
        params: { message: "확인", target: { type: "character", character_id: "character-1" } },
      },
    ]);
  });

  it("단서 지급 실행 결과의 대상과 단서를 deliveries로 저장한다", () => {
    const onChange = vi.fn();
    render(
      <ActionListEditor
        label="장면 시작 액션"
        actions={[{ id: "grant", type: "GRANT_CLUE", params: { deliveries: [] } }]}
        onChange={onChange}
        themeId="theme-1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /탐정/ }));
    expect(onChange).toHaveBeenCalledWith([
      {
        id: "grant",
        type: "GRANT_CLUE",
        params: {
          deliveries: [
            expect.objectContaining({
              target: { type: "character", character_id: "character-1" },
              clue_ids: [],
            }),
          ],
        },
      },
    ]);

    fireEvent.click(screen.getByRole("button", { name: /금고 열쇠/ }));
    expect(onChange).toHaveBeenLastCalledWith([
      {
        id: "grant",
        type: "GRANT_CLUE",
        params: {
          deliveries: [
            expect.objectContaining({
              target: { type: "all_players" },
              clue_ids: ["clue-1"],
            }),
          ],
        },
      },
    ]);
  });

  it("단서 지급 실행 결과를 수정할 때 기존 추가 지급 규칙을 보존한다", () => {
    const onChange = vi.fn();
    render(
      <ActionListEditor
        label="장면 시작 액션"
        actions={[
          {
            id: "grant",
            type: "GRANT_CLUE",
            params: {
              deliveries: [
                {
                  id: "grant-1",
                  target: { type: "all_players" },
                  clue_ids: ["clue-1"],
                },
                {
                  id: "grant-2",
                  target: { type: "character", character_id: "character-2" },
                  clue_ids: ["clue-2"],
                },
              ],
            },
          },
        ]}
        onChange={onChange}
        themeId="theme-1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /탐정/ }));

    expect(onChange).toHaveBeenCalledWith([
      {
        id: "grant",
        type: "GRANT_CLUE",
        params: {
          deliveries: [
            {
              id: "grant-1",
              target: { type: "character", character_id: "character-1" },
              clue_ids: ["clue-1"],
            },
            {
              id: "grant-2",
              target: { type: "character", character_id: "character-2" },
              clue_ids: ["clue-2"],
            },
          ],
        },
      },
    ]);
  });

  it("읽기 대사 공개와 알림 보내기의 필수값 누락을 검출한다", () => {
    expect(
      hasIncompletePresentationCueActions([
        { id: "info", type: "DELIVER_INFORMATION", params: { deliveries: [] } },
      ]),
    ).toBe(true);
    expect(
      hasIncompletePresentationCueActions([
        {
          id: "info",
          type: "DELIVER_INFORMATION",
          params: {
            deliveries: [
              { target: { type: "all_players" }, reading_section_ids: ["reading-1"] },
            ],
          },
        },
      ]),
    ).toBe(false);
    expect(
      hasIncompletePresentationCueActions([
        { id: "broadcast", type: "BROADCAST_MESSAGE", params: { message: "" } },
      ]),
    ).toBe(true);
    expect(
      hasIncompletePresentationCueActions([
        { id: "grant", type: "GRANT_CLUE", params: { deliveries: [] } },
      ]),
    ).toBe(true);
    expect(
      hasIncompletePresentationCueActions([
        {
          id: "grant",
          type: "GRANT_CLUE",
          params: {
            deliveries: [
              { target: { type: "character", character_id: "character-1" }, clue_ids: ["clue-1"] },
            ],
          },
        },
      ]),
    ).toBe(false);
    expect(
      hasIncompletePresentationCueActions([
        {
          id: "grant",
          type: "GRANT_CLUE",
          params: {
            deliveries: [
              { target: { type: "character", character_id: "   " }, clue_ids: ["clue-1"] },
            ],
          },
        },
      ]),
    ).toBe(true);
  });
});
