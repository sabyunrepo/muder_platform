import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSetActiveTab = vi.fn();
const mockActiveTab = { current: "overview" };

vi.mock("../../stores/editorUIStore", () => ({
  useEditorUI: () => ({
    activeTab: mockActiveTab.current,
    setActiveTab: mockSetActiveTab,
  }),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { EditorTabNav } from "../EditorTabNav";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockActiveTab.current = "overview";
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EditorTabNav dynamic tabs", () => {
  it("모듈 미지정 시 always=true 탭만 표시된다", () => {
    render(<EditorTabNav />);
    expect(screen.getByText("기본정보")).toBeDefined();
    expect(screen.getByText("게임설계")).toBeDefined();
    expect(screen.queryByText("미디어")).toBeNull();
  });

  it("voice_chat 모듈 활성 시 미디어 탭이 표시된다", () => {
    render(<EditorTabNav activeModules={["voice_chat"]} />);
    expect(screen.getByText("미디어")).toBeDefined();
  });

  it("모듈 비활성 시 미디어 탭이 숨겨진다", () => {
    render(<EditorTabNav activeModules={["text_chat"]} />);
    expect(screen.queryByText("미디어")).toBeNull();
  });

  it("현재 탭이 숨겨지면 overview로 전환된다", () => {
    mockActiveTab.current = "media";
    render(<EditorTabNav activeModules={[]} />);
    expect(mockSetActiveTab).toHaveBeenCalledWith("overview");
  });
});
