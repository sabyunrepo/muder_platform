import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EditorSaveConflictBanner } from "../EditorSaveConflictBanner";

describe("EditorSaveConflictBanner", () => {
  it("저장 충돌 원인과 복구 행동을 표시하고 각 콜백을 호출한다", () => {
    const onReload = vi.fn();
    const onPreserve = vi.fn();
    const onDismiss = vi.fn();

    render(
      <EditorSaveConflictBanner
        scopeLabel="스토리 정보"
        onReload={onReload}
        onPreserve={onPreserve}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByRole("alert", { name: "스토리 정보 저장 충돌" })).toBeDefined();
    expect(screen.getByText("스토리 정보 저장 충돌이 발생했습니다")).toBeDefined();
    expect(screen.getByText(/다른 탭이나 사용자가 더 최신 내용을 저장했습니다/)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "최신 상태 다시 불러오기" }));
    expect(onReload).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "내 변경 복사" }));
    expect(onPreserve).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    fireEvent.click(screen.getByRole("button", { name: "충돌 안내 닫기" }));
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });
});
