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
});
