import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  useReadingStore,
  type ReadingLineWire,
} from "@/stores/readingStore";
import { ReadingOverlay } from "../ReadingOverlay";

const linesGm: ReadingLineWire[] = [
  { index: 0, text: "GM line", speaker: "Narrator", advanceBy: "gm" },
];
const linesVoice: ReadingLineWire[] = [
  {
    index: 0,
    text: "Voice line",
    speaker: "Alice",
    advanceBy: "voice",
    voiceMediaId: "media-1",
  },
];
const linesRole: ReadingLineWire[] = [
  { index: 0, text: "Role line", speaker: "Bob", advanceBy: "role:detective" },
];

describe("ReadingOverlay", () => {
  beforeEach(() => {
    useReadingStore.getState().clear();
  });

  afterEach(() => {
    cleanup();
    useReadingStore.getState().clear();
  });

  it("returns null when no active section", () => {
    const { container } = render(
      <ReadingOverlay
        currentUserRole={null}
        isHost={false}
        onAdvance={() => {}}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the overlay with the current line when playing", () => {
    useReadingStore.getState().startSection("sec-1", linesGm);

    render(
      <ReadingOverlay currentUserRole={null} isHost onAdvance={() => {}} />
    );

    expect(screen.getByTestId("reading-overlay")).toBeTruthy();
    expect(screen.getByText("Narrator")).toBeTruthy();
  });

  it("shows the paused banner when status is paused", () => {
    useReadingStore.getState().startSection("sec-1", linesGm);
    useReadingStore.getState().pauseSection("player_left");

    render(
      <ReadingOverlay currentUserRole={null} isHost onAdvance={() => {}} />
    );

    expect(screen.getByTestId("reading-paused-banner")).toBeTruthy();
    expect(
      screen.getByText(/플레이어가 이탈했습니다/),
    ).toBeTruthy();
  });

  it("returns null when section completed", () => {
    useReadingStore.getState().startSection("sec-1", linesGm);
    useReadingStore.getState().completeSection();

    const { container } = render(
      <ReadingOverlay currentUserRole={null} isHost onAdvance={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("voice mode: no advance button, shows playing indicator", () => {
    useReadingStore.getState().startSection("sec-1", linesVoice);

    render(
      <ReadingOverlay currentUserRole={null} isHost onAdvance={() => {}} />
    );

    expect(screen.queryByTestId("reading-advance-button")).toBeNull();
    expect(screen.getByTestId("reading-controls-voice")).toBeTruthy();
    expect(screen.getByText(/재생 중/)).toBeTruthy();
  });

  it("gm mode + isHost=true: shows advance button", () => {
    useReadingStore.getState().startSection("sec-1", linesGm);
    const onAdvance = vi.fn();

    render(
      <ReadingOverlay currentUserRole={null} isHost onAdvance={onAdvance} />
    );

    const btn = screen.getByTestId("reading-advance-button");
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it("gm mode + isHost=false: shows waiting hint, no button", () => {
    useReadingStore.getState().startSection("sec-1", linesGm);

    render(
      <ReadingOverlay
        currentUserRole={null}
        isHost={false}
        onAdvance={() => {}}
      />
    );

    expect(screen.queryByTestId("reading-advance-button")).toBeNull();
    expect(screen.getByTestId("reading-controls-waiting-host")).toBeTruthy();
    expect(screen.getByText(/방장이 읽고 있습니다/)).toBeTruthy();
  });

  it("role mode + matching role: shows advance button", () => {
    useReadingStore.getState().startSection("sec-1", linesRole);
    const onAdvance = vi.fn();

    render(
      <ReadingOverlay
        currentUserRole="detective"
        isHost={false}
        onAdvance={onAdvance}
      />
    );

    const btn = screen.getByTestId("reading-advance-button");
    fireEvent.click(btn);
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it("role mode + non-matching role: shows waiting hint", () => {
    useReadingStore.getState().startSection("sec-1", linesRole);

    render(
      <ReadingOverlay
        currentUserRole="suspect"
        isHost={false}
        onAdvance={() => {}}
      />
    );

    expect(screen.queryByTestId("reading-advance-button")).toBeNull();
    expect(screen.getByTestId("reading-controls-waiting-role")).toBeTruthy();
    expect(screen.getByText(/detective이\(가\) 읽고 있습니다/)).toBeTruthy();
  });

  it("paused: hides controls (banner takes precedence)", () => {
    useReadingStore.getState().startSection("sec-1", linesGm);
    useReadingStore.getState().pauseSection("player_left");

    render(
      <ReadingOverlay currentUserRole={null} isHost onAdvance={() => {}} />
    );

    expect(screen.queryByTestId("reading-advance-button")).toBeNull();
  });
});
