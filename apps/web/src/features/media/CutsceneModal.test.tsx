import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CutsceneModal, type ActiveCutscene } from "./CutsceneModal";
import type { VideoOrchestrator } from "./VideoOrchestrator";

describe("CutsceneModal", () => {
  let mockOrchestrator: VideoOrchestrator;
  let capturedOnEnded: (() => void) | null = null;

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    capturedOnEnded = null;
    mockOrchestrator = {
      playCutscene: vi.fn().mockImplementation(async (opts: any) => {
        capturedOnEnded = opts.onEnded ?? null;
      }),
      skipCutscene: vi.fn(),
      isPlaying: vi.fn().mockReturnValue(false),
      getCurrentMediaId: vi.fn().mockReturnValue(null),
      dispose: vi.fn(),
    };
  });

  const media = { id: "m1", sourceType: "YOUTUBE" as const, videoId: "abc" };
  const cutscene: ActiveCutscene = {
    media,
    bgmBehavior: "pause",
    skippable: true,
  };

  it("renders nothing when activeCutscene is null", () => {
    const { container } = render(
      <CutsceneModal
        orchestrator={mockOrchestrator}
        activeCutscene={null}
        isHost={true}
        onClose={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
    expect(mockOrchestrator.playCutscene).not.toHaveBeenCalled();
  });

  it("renders modal dialog when activeCutscene is set", () => {
    render(
      <CutsceneModal
        orchestrator={mockOrchestrator}
        activeCutscene={cutscene}
        isHost={true}
        onClose={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-label")).toBe("Cutscene");
  });

  it("calls playCutscene on mount with correct params", () => {
    render(
      <CutsceneModal
        orchestrator={mockOrchestrator}
        activeCutscene={cutscene}
        isHost={true}
        onClose={vi.fn()}
      />,
    );
    expect(mockOrchestrator.playCutscene).toHaveBeenCalledTimes(1);
    const callArg = (mockOrchestrator.playCutscene as any).mock.calls[0][0];
    expect(callArg.media).toBe(media);
    expect(callArg.bgmBehavior).toBe("pause");
    expect(callArg.skippable).toBe(true);
    expect(callArg.container).toBeInstanceOf(HTMLElement);
    expect(typeof callArg.onEnded).toBe("function");
  });

  it("shows skip button when skippable=true and isHost=true", () => {
    render(
      <CutsceneModal
        orchestrator={mockOrchestrator}
        activeCutscene={cutscene}
        isHost={true}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "컷신 건너뛰기" })).toBeTruthy();
  });

  it("hides skip button when skippable=true but isHost=false", () => {
    render(
      <CutsceneModal
        orchestrator={mockOrchestrator}
        activeCutscene={cutscene}
        isHost={false}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "컷신 건너뛰기" })).toBeNull();
  });

  it("hides skip button when skippable=false even if isHost=true", () => {
    render(
      <CutsceneModal
        orchestrator={mockOrchestrator}
        activeCutscene={{ ...cutscene, skippable: false }}
        isHost={true}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "컷신 건너뛰기" })).toBeNull();
  });

  it("skip button click calls orchestrator.skipCutscene", () => {
    render(
      <CutsceneModal
        orchestrator={mockOrchestrator}
        activeCutscene={cutscene}
        isHost={true}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "컷신 건너뛰기" }));
    expect(mockOrchestrator.skipCutscene).toHaveBeenCalledTimes(1);
  });

  it("onEnded callback (fired by orchestrator) calls onClose prop", async () => {
    const onClose = vi.fn();
    render(
      <CutsceneModal
        orchestrator={mockOrchestrator}
        activeCutscene={cutscene}
        isHost={true}
        onClose={onClose}
      />,
    );
    // Wait for playCutscene promise to resolve
    await Promise.resolve();
    await Promise.resolve();
    expect(capturedOnEnded).not.toBeNull();
    capturedOnEnded?.();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("unmount during playback triggers skip for cleanup", () => {
    (mockOrchestrator.isPlaying as any).mockReturnValue(true);
    const { unmount } = render(
      <CutsceneModal
        orchestrator={mockOrchestrator}
        activeCutscene={cutscene}
        isHost={true}
        onClose={vi.fn()}
      />,
    );
    unmount();
    expect(mockOrchestrator.skipCutscene).toHaveBeenCalled();
  });

  it("playCutscene rejection calls onClose", async () => {
    cleanup();
    const onClose = vi.fn();
    (mockOrchestrator.playCutscene as any).mockRejectedValueOnce(
      new Error("boom"),
    );
    // Silence expected console.error
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <CutsceneModal
        orchestrator={mockOrchestrator}
        activeCutscene={cutscene}
        isHost={true}
        onClose={onClose}
      />,
    );
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(onClose).toHaveBeenCalledTimes(1);
    errSpy.mockRestore();
  });
});
