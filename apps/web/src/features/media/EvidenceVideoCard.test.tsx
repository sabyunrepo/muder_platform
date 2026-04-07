/**
 * EvidenceVideoCard tests — verify the inline evidence video card lifecycle
 * and the play/pause/replay state machine. The underlying VideoPlayer is
 * mocked so the tests stay focused on the component contract.
 */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EvidenceVideoCard } from "./EvidenceVideoCard";
import type { VideoMedia, VideoPlayer } from "./VideoPlayer";

interface MockVideoPlayer extends VideoPlayer {
  _readyCb: (() => void) | null;
  _endedCb: (() => void) | null;
}

const createMockPlayer = (): MockVideoPlayer => {
  const player: MockVideoPlayer = {
    load: vi.fn().mockResolvedValue(undefined),
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    stop: vi.fn(),
    setVolume: vi.fn(),
    onEnded: vi.fn((cb: () => void) => {
      player._endedCb = cb;
      return () => {
        player._endedCb = null;
      };
    }),
    onReady: vi.fn((cb: () => void) => {
      player._readyCb = cb;
      return () => {
        player._readyCb = null;
      };
    }),
    attachTo: vi.fn(),
    destroy: vi.fn(),
    getCurrentTime: vi.fn().mockReturnValue(0),
    _readyCb: null,
    _endedCb: null,
  };
  return player;
};

let mockPlayer: MockVideoPlayer;

vi.mock("./createVideoPlayer", () => ({
  createVideoPlayer: vi.fn(() => mockPlayer),
}));

const media: VideoMedia = {
  id: "m1",
  sourceType: "YOUTUBE",
  videoId: "abc",
  title: "Test Evidence",
};

const fireReady = () => {
  act(() => {
    mockPlayer._readyCb?.();
  });
};

const fireEnded = () => {
  act(() => {
    mockPlayer._endedCb?.();
  });
};

describe("EvidenceVideoCard", () => {
  beforeEach(() => {
    mockPlayer = createMockPlayer();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders title from media.title when no title prop", () => {
    render(<EvidenceVideoCard media={media} />);
    expect(screen.getByText("Test Evidence")).toBeTruthy();
  });

  it("prefers title prop over media.title", () => {
    render(<EvidenceVideoCard media={media} title="Custom Title" />);
    expect(screen.getByText("Custom Title")).toBeTruthy();
    expect(screen.queryByText("Test Evidence")).not.toBeTruthy();
  });

  it("creates player on mount, attaches to container, loads media", () => {
    render(<EvidenceVideoCard media={media} />);
    expect(mockPlayer.attachTo).toHaveBeenCalledTimes(1);
    expect(mockPlayer.load).toHaveBeenCalledWith(media);
  });

  it("play button is disabled until onReady fires", () => {
    render(<EvidenceVideoCard media={media} />);
    const btn = screen.getByRole("button", { name: /재생/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireReady();
    expect(btn.disabled).toBe(false);
  });

  const clickAndFlush = async (name: RegExp) => {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name }));
    });
  };

  it("play button calls player.play and shows pause button", async () => {
    render(<EvidenceVideoCard media={media} />);
    fireReady();

    await clickAndFlush(/재생/);

    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: /일시정지/ }),
    ).toBeTruthy();
  });

  it("pause button calls player.pause and reverts to play state", async () => {
    render(<EvidenceVideoCard media={media} />);
    fireReady();

    await clickAndFlush(/재생/);
    await clickAndFlush(/일시정지/);

    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /재생/ })).toBeTruthy();
  });

  it("shows replay button when video ends", async () => {
    render(<EvidenceVideoCard media={media} />);
    fireReady();
    await clickAndFlush(/재생/);

    fireEnded();

    expect(
      screen.getByRole("button", { name: /다시 재생/ }),
    ).toBeTruthy();
  });

  it("replay calls stop then play", async () => {
    render(<EvidenceVideoCard media={media} />);
    fireReady();
    await clickAndFlush(/재생/);
    fireEnded();

    await clickAndFlush(/다시 재생/);

    expect(mockPlayer.stop).toHaveBeenCalledTimes(1);
    expect(mockPlayer.play).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole("button", { name: /일시정지/ }),
    ).toBeTruthy();
  });

  it("destroys player on unmount", () => {
    const { unmount } = render(<EvidenceVideoCard media={media} />);
    unmount();
    expect(mockPlayer.destroy).toHaveBeenCalledTimes(1);
  });

  it("supports multiple replays", async () => {
    render(<EvidenceVideoCard media={media} />);
    fireReady();

    await clickAndFlush(/재생/);
    fireEnded();
    await clickAndFlush(/다시 재생/);
    fireEnded();
    await clickAndFlush(/다시 재생/);
    fireEnded();

    expect(mockPlayer.stop).toHaveBeenCalledTimes(2);
    expect(mockPlayer.play).toHaveBeenCalledTimes(3);
    expect(
      screen.getByRole("button", { name: /다시 재생/ }),
    ).toBeTruthy();
  });
});
