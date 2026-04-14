import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ValidationPanel } from "../ValidationPanel";
import type { DesignWarning } from "../../validation";

// Mock editorUIStore
const mockSetActiveTab = vi.fn();
vi.mock("../../stores/editorUIStore", () => ({
  useEditorUI: () => ({ setActiveTab: mockSetActiveTab }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const makeWarning = (
  type: "error" | "warning",
  category: string,
  message: string,
): DesignWarning => ({ type, category, message } as DesignWarning);

describe("ValidationPanel", () => {
  it("경고 없으면 통과 메시지를 표시한다", () => {
    render(<ValidationPanel warnings={[]} onClose={vi.fn()} />);
    expect(screen.getByText(/검증 통과/)).toBeDefined();
  });

  it("에러 클릭 시 해당 탭으로 이동한다", () => {
    const onClose = vi.fn();
    const warnings = [makeWarning("error", "phases", "페이즈 없음")];
    render(<ValidationPanel warnings={warnings} onClose={onClose} />);
    fireEvent.click(screen.getByText("페이즈 없음"));
    expect(mockSetActiveTab).toHaveBeenCalledWith("design");
    expect(onClose).toHaveBeenCalled();
  });

  it("characters 카테고리는 characters 탭으로 이동한다", () => {
    const warnings = [makeWarning("warning", "characters", "캐릭터 문제")];
    render(<ValidationPanel warnings={warnings} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("캐릭터 문제"));
    expect(mockSetActiveTab).toHaveBeenCalledWith("characters");
  });

  it("clues 카테고리는 clues 탭으로 이동한다", () => {
    const warnings = [makeWarning("warning", "clues", "단서 문제")];
    render(<ValidationPanel warnings={warnings} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("단서 문제"));
    expect(mockSetActiveTab).toHaveBeenCalledWith("clues");
  });
});
