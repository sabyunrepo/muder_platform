import { cleanup, fireEvent, render, screen, within, act } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  defaultBlocks,
  writeMockBlocks,
  type ReadingBlock,
} from "@/features/editor/mockReadingBlocks";
import ReadingScriptEditorMockPage from "../ReadingScriptEditorMockPage";
import ReadingScriptPlayerMockPage from "../ReadingScriptPlayerMockPage";

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", createStorage());
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("ReadingScriptEditorMockPage", () => {
  it("기본 읽기 블록을 보여주고 블록 추가/대본 변환을 저장한다", () => {
    renderWithRouter(<ReadingScriptEditorMockPage />);

    expect(screen.getByRole("heading", { name: "읽기 대사 블록 에디터 목업" })).toBeDefined();
    expect(screen.getByText("5개")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "영상" }));
    fireEvent.click(screen.getByRole("button", { name: "GM 메모" }));

    expect(screen.getByText("7개")).toBeDefined();
    expect(screen.getByText("CCTV 01")).toBeDefined();
    expect(screen.getByDisplayValue("여기에 GM 진행 메모를 작성하세요.")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "대본 입력" }));
    const modal = screen.getByRole("heading", { name: "대본 입력으로 블록 생성" }).closest("section");
    expect(modal).not.toBeNull();

    fireEvent.change(within(modal as HTMLElement).getByRole("textbox"), {
      target: { value: "이미지: 어두운 복도\nBGM: 정지\n윤서연: 문이 열려 있었어요." },
    });
    fireEvent.click(within(modal as HTMLElement).getByRole("button", { name: "블록 생성" }));

    expect(screen.getByText("3개")).toBeDefined();
    expect(screen.getAllByText("어두운 복도").length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("문이 열려 있었어요.")).toBeDefined();
  });
});

describe("ReadingScriptPlayerMockPage", () => {
  it("음성 대기 후 다음 읽기 블록으로 진행한다", () => {
    vi.useFakeTimers();
    writeMockBlocks(defaultBlocks);

    const { container } = renderWithRouter(<ReadingScriptPlayerMockPage />);

    expect(screen.getByRole("heading", { name: "읽기 대사 테스트 화면" })).toBeDefined();
    expect(container.querySelector(".mmp-runtime-boundary")?.getAttribute("data-game-runtime-theme")).toBe(
      "immersive",
    );
    expect(screen.getByText("모두 눈을 감아주세요.")).toBeDefined();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "음성 종료 대기" }).disabled).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2600);
    });

    const nextButton = screen.getByRole("button", { name: "방장 계속" });
    expect(nextButton.disabled).toBe(false);
    fireEvent.click(nextButton);

    expect(screen.getByText("저택 전경 · center")).toBeDefined();
  });

  it("저장된 이미지/영상/BGM/GM 메모 블록을 테스트 화면에 표시한다", () => {
    const blocks: ReadingBlock[] = [
      {
        id: "image-test",
        type: "image",
        mediaId: "image-hall",
        position: "full",
        size: "small",
        advanceType: "gm",
      },
      {
        id: "video-test",
        type: "video",
        mediaId: "video-cctv",
        autoplay: false,
        waitUntilEnd: false,
        advanceType: "gm",
      },
      { id: "bgm-test", type: "bgm", mediaId: "bgm-opening", mode: "once" },
      { id: "note-test", type: "gmNote", text: "비밀 투표를 시작한다." },
    ];
    writeMockBlocks(blocks);

    renderWithRouter(<ReadingScriptPlayerMockPage />);

    expect(screen.getByText("어두운 복도 · full")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "방장 계속" }));
    expect(screen.getByText("CCTV 01")).toBeDefined();
    expect(screen.getByText("수동 재생 · 즉시 진행 가능")).toBeDefined();
  });
});
