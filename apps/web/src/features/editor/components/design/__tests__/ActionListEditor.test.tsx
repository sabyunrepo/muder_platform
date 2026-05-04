import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionListEditor } from "../ActionListEditor";

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
});
