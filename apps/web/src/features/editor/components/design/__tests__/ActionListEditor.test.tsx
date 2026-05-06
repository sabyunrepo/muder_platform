import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ActionListEditor,
  hasIncompletePresentationCueActions,
} from "../ActionListEditor";

vi.mock("../../media/MediaPicker", () => ({
  MediaPicker: ({
    open,
    title,
    onSelect,
  }: {
    open: boolean;
    title?: string;
    onSelect: (media: { id: string }) => void;
  }) =>
    open ? (
      <button type="button" onClick={() => onSelect({ id: "media-1" })}>
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

afterEach(cleanup);

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
    fireEvent.click(screen.getByRole("button", { name: "장면 시작 트리거 1 BGM 선택" }));

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
    fireEvent.click(screen.getByRole("button", { name: "장면 시작 트리거 1 배경 이미지 선택" }));

    expect(onChange).toHaveBeenCalledWith([
      { id: "bg", type: "SET_BACKGROUND", params: { mediaId: "media-1" } },
    ]);
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
  });
});
