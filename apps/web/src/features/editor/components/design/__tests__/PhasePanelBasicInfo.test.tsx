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
    const options = screen.getAllByRole("option") as HTMLOptionElement[];
    expect(options.map((option) => [option.value, option.textContent])).toEqual([
      ["investigation", "수사"],
      ["discussion", "토론"],
      ["voting", "투표/질문"],
      ["story_progression", "리딩"],
    ]);
    expect(select.value).toBe("investigation");

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

  it("리딩과 투표/질문은 기존 저장값을 그대로 사용한다", () => {
    const onChange = vi.fn();

    render(
      <PhasePanelBasicInfo
        label=""
        phaseType="story_progression"
        onChange={onChange}
        onFlush={vi.fn()}
      />,
    );

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("story_progression");

    fireEvent.change(select, { target: { value: "voting" } });
    expect(onChange).toHaveBeenCalledWith({ phase_type: "voting" });
    expect(screen.queryByRole("option", { name: "reading" })).toBeNull();
    expect(screen.queryByRole("option", { name: "voting_question" })).toBeNull();
  });
});
