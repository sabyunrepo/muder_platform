import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ConfirmDialog } from "../ConfirmDialog";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ConfirmDialog", () => {
  it("제목과 설명, 취소/확인 버튼을 표시한다", () => {
    render(
      <ConfirmDialog
        isOpen
        title="장면을 삭제할까요?"
        description="연결된 선도 함께 삭제됩니다."
        confirmLabel="장면 삭제"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: "장면을 삭제할까요?" })).toBeDefined();
    expect(screen.getByText("연결된 선도 함께 삭제됩니다.")).toBeDefined();
    expect(screen.getByRole("button", { name: "취소" })).toBeDefined();
    expect(screen.getByRole("button", { name: "장면 삭제" })).toBeDefined();
  });

  it("취소와 확인 동작을 각각 호출한다", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        isOpen
        title="연결을 끊을까요?"
        description="이 작업은 즉시 저장됩니다."
        confirmLabel="연결 끊기"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    fireEvent.click(screen.getByRole("button", { name: "연결 끊기" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("처리 중에는 확인 버튼을 비활성화한다", () => {
    render(
      <ConfirmDialog
        isOpen
        title="미디어를 삭제할까요?"
        description="삭제 후에는 되돌릴 수 없습니다."
        confirmLabel="삭제"
        isConfirming
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "삭제" })).toHaveProperty(
      "disabled",
      true,
    );
  });
});
