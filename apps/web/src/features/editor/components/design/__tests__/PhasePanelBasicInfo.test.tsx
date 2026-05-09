import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PhasePanelBasicInfo } from "../PhasePanelBasicInfo";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PhasePanelBasicInfo", () => {
  it("장면 타입은 기본 미선택 상태에서 설정 패치로 변경한다", () => {
    const onChange = vi.fn();
    const onFlush = vi.fn();

    render(
      <PhasePanelBasicInfo
        label={undefined}
        phaseType={undefined}
        onChange={onChange}
        onFlush={onFlush}
      />,
    );

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("");

    fireEvent.change(select, { target: { value: "voting" } });
    expect(onChange).toHaveBeenCalledWith({ phase_type: "voting" });

    fireEvent.blur(select);
    expect(onFlush).toHaveBeenCalledOnce();
  });

  it("장면 라벨 입력은 label 패치로 변경한다", () => {
    const onChange = vi.fn();

    render(
      <PhasePanelBasicInfo
        label=""
        phaseType="story_progression"
        onChange={onChange}
        onFlush={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("장면 이름"), {
      target: { value: "새 추리 장면" },
    });

    expect(onChange).toHaveBeenCalledWith({ label: "새 추리 장면" });
  });
});
