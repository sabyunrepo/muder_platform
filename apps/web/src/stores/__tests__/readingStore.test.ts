import { describe, it, expect, beforeEach } from "vitest";
import {
  useReadingStore,
  type ReadingLineWire,
  type ReadingStateSnapshot,
} from "../readingStore";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const lines: ReadingLineWire[] = [
  { index: 0, text: "Line zero", speaker: "Narrator", advanceBy: "gm" },
  { index: 1, text: "Line one", speaker: "Alice", advanceBy: "voice", voiceMediaId: "media-1" },
  { index: 2, text: "Line two", speaker: "Bob", advanceBy: "role:detective" },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("readingStore", () => {
  beforeEach(() => {
    useReadingStore.getState().clear();
  });

  it("defaults to idle, no section, empty lines", () => {
    const s = useReadingStore.getState();
    expect(s.sectionId).toBeNull();
    expect(s.lines).toEqual([]);
    expect(s.currentIndex).toBe(0);
    expect(s.status).toBe("idle");
    expect(s.pausedReason).toBeNull();
  });

  it("startSection replaces state", () => {
    const { startSection } = useReadingStore.getState();
    startSection("sec-1", lines);
    const s = useReadingStore.getState();
    expect(s.sectionId).toBe("sec-1");
    expect(s.lines).toEqual(lines);
    expect(s.currentIndex).toBe(0);
    expect(s.status).toBe("playing");
    expect(s.pausedReason).toBeNull();
  });

  it("startSection clears prior pausedReason", () => {
    const { startSection, pauseSection } = useReadingStore.getState();
    startSection("sec-1", lines);
    pauseSection("waiting");
    expect(useReadingStore.getState().pausedReason).toBe("waiting");
    startSection("sec-2", lines.slice(0, 2));
    const s = useReadingStore.getState();
    expect(s.sectionId).toBe("sec-2");
    expect(s.pausedReason).toBeNull();
    expect(s.status).toBe("playing");
  });

  it("showLine updates currentIndex", () => {
    const { startSection, showLine } = useReadingStore.getState();
    startSection("sec-1", lines);
    showLine(2);
    expect(useReadingStore.getState().currentIndex).toBe(2);
  });

  it("showLine does not change status", () => {
    const { startSection, pauseSection, showLine } = useReadingStore.getState();
    startSection("sec-1", lines);
    pauseSection("buffering");
    showLine(1);
    const s = useReadingStore.getState();
    expect(s.currentIndex).toBe(1);
    expect(s.status).toBe("paused");
    expect(s.pausedReason).toBe("buffering");
  });

  it("showLine clamps to valid range", () => {
    const { startSection, showLine } = useReadingStore.getState();
    startSection("sec-1", lines);
    showLine(99);
    expect(useReadingStore.getState().currentIndex).toBe(2); // last
    showLine(-5);
    expect(useReadingStore.getState().currentIndex).toBe(0); // first
  });

  it("showLine is no-op on empty lines", () => {
    const { showLine } = useReadingStore.getState();
    showLine(3);
    expect(useReadingStore.getState().currentIndex).toBe(0);
  });

  it("pauseSection sets paused status + reason", () => {
    const { startSection, pauseSection } = useReadingStore.getState();
    startSection("sec-1", lines);
    pauseSection("waiting_voice_ready");
    const s = useReadingStore.getState();
    expect(s.status).toBe("paused");
    expect(s.pausedReason).toBe("waiting_voice_ready");
    expect(s.sectionId).toBe("sec-1");
    expect(s.lines).toEqual(lines);
    expect(s.currentIndex).toBe(0);
  });

  it("resumeSection from paused → playing, clears reason", () => {
    const { startSection, pauseSection, resumeSection } =
      useReadingStore.getState();
    startSection("sec-1", lines);
    pauseSection("buffering");
    resumeSection();
    const s = useReadingStore.getState();
    expect(s.status).toBe("playing");
    expect(s.pausedReason).toBeNull();
  });

  it("resumeSection from playing → no-op", () => {
    const { startSection, resumeSection } = useReadingStore.getState();
    startSection("sec-1", lines);
    resumeSection();
    expect(useReadingStore.getState().status).toBe("playing");
  });

  it("completeSection sets completed status", () => {
    const { startSection, completeSection } = useReadingStore.getState();
    startSection("sec-1", lines);
    completeSection();
    const s = useReadingStore.getState();
    expect(s.status).toBe("completed");
    // Other state preserved
    expect(s.sectionId).toBe("sec-1");
    expect(s.lines).toEqual(lines);
  });

  it("restoreFromSnapshot replaces all state", () => {
    const snapshot: ReadingStateSnapshot = {
      sectionId: "sec-restored",
      lines: lines.slice(0, 2),
      currentIndex: 1,
      bgmMediaId: "bgm-1",
      status: "paused",
      pausedReason: "reconnect",
    };
    useReadingStore.getState().restoreFromSnapshot(snapshot);
    const s = useReadingStore.getState();
    expect(s.sectionId).toBe("sec-restored");
    expect(s.lines).toEqual(snapshot.lines);
    expect(s.currentIndex).toBe(1);
    expect(s.status).toBe("paused");
    expect(s.pausedReason).toBe("reconnect");
  });

  it("restoreFromSnapshot handles missing pausedReason", () => {
    const snapshot: ReadingStateSnapshot = {
      sectionId: "sec-restored",
      lines,
      currentIndex: 0,
      status: "playing",
    };
    useReadingStore.getState().restoreFromSnapshot(snapshot);
    expect(useReadingStore.getState().pausedReason).toBeNull();
  });

  it("clear resets to defaults", () => {
    const { startSection, pauseSection, clear } = useReadingStore.getState();
    startSection("sec-1", lines);
    pauseSection("oops");
    clear();
    const s = useReadingStore.getState();
    expect(s.sectionId).toBeNull();
    expect(s.lines).toEqual([]);
    expect(s.currentIndex).toBe(0);
    expect(s.status).toBe("idle");
    expect(s.pausedReason).toBeNull();
  });

  it("getCurrentLine returns current or null", () => {
    const { getCurrentLine } = useReadingStore.getState();
    expect(getCurrentLine()).toBeNull(); // idle

    useReadingStore.getState().startSection("sec-1", lines);
    expect(useReadingStore.getState().getCurrentLine()).toEqual(lines[0]);

    useReadingStore.getState().showLine(2);
    expect(useReadingStore.getState().getCurrentLine()).toEqual(lines[2]);
  });

  it("getTotalLines returns line count", () => {
    expect(useReadingStore.getState().getTotalLines()).toBe(0);
    useReadingStore.getState().startSection("sec-1", lines);
    expect(useReadingStore.getState().getTotalLines()).toBe(3);
  });

  it("isAtLastLine works correctly", () => {
    expect(useReadingStore.getState().isAtLastLine()).toBe(false); // empty
    useReadingStore.getState().startSection("sec-1", lines);
    expect(useReadingStore.getState().isAtLastLine()).toBe(false);
    useReadingStore.getState().showLine(1);
    expect(useReadingStore.getState().isAtLastLine()).toBe(false);
    useReadingStore.getState().showLine(2);
    expect(useReadingStore.getState().isAtLastLine()).toBe(true);
  });
});
