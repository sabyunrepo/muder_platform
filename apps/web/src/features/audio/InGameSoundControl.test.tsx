import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

import { InGameSoundControl } from "./InGameSoundControl";
import { useAudioStore } from "@/stores/audioStore";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetAudioStore() {
  useAudioStore.setState({
    masterVolume: 0.8,
    sfxVolume: 1,
    bgmVolume: 0.5,
    voiceVolume: 1,
    isMuted: false,
    bgmMediaId: null,
  });
}

function openPopover() {
  const button = screen.getByRole("button", { name: /사운드/ });
  fireEvent.click(button);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("InGameSoundControl", () => {
  beforeEach(() => {
    resetAudioStore();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders speaker button", () => {
    render(<InGameSoundControl />);
    expect(screen.getByRole("button", { name: "사운드 설정" })).toBeTruthy();
  });

  it("popover is closed by default", () => {
    render(<InGameSoundControl />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("clicking speaker opens popover", () => {
    render(<InGameSoundControl />);
    openPopover();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("clicking outside closes popover", () => {
    render(
      <div>
        <InGameSoundControl />
        <div data-testid="outside">outside</div>
      </div>,
    );
    openPopover();
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Escape key closes popover", () => {
    render(<InGameSoundControl />);
    openPopover();
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows 4 volume sliders when open", () => {
    render(<InGameSoundControl />);
    openPopover();
    expect(screen.getByRole("slider", { name: "마스터 볼륨" })).toBeTruthy();
    expect(screen.getByRole("slider", { name: "배경음악 볼륨" })).toBeTruthy();
    expect(screen.getByRole("slider", { name: "음성 볼륨" })).toBeTruthy();
    expect(screen.getByRole("slider", { name: "효과음 볼륨" })).toBeTruthy();
  });

  it("master slider change updates audioStore", () => {
    render(<InGameSoundControl />);
    openPopover();
    const slider = screen.getByRole("slider", { name: "마스터 볼륨" });
    fireEvent.change(slider, { target: { value: "30" } });
    expect(useAudioStore.getState().masterVolume).toBeCloseTo(0.3);
  });

  it("bgm slider change updates audioStore", () => {
    render(<InGameSoundControl />);
    openPopover();
    fireEvent.change(screen.getByRole("slider", { name: "배경음악 볼륨" }), {
      target: { value: "20" },
    });
    expect(useAudioStore.getState().bgmVolume).toBeCloseTo(0.2);
  });

  it("voice slider change updates audioStore", () => {
    render(<InGameSoundControl />);
    openPopover();
    fireEvent.change(screen.getByRole("slider", { name: "음성 볼륨" }), {
      target: { value: "70" },
    });
    expect(useAudioStore.getState().voiceVolume).toBeCloseTo(0.7);
  });

  it("sfx slider change updates audioStore", () => {
    render(<InGameSoundControl />);
    openPopover();
    fireEvent.change(screen.getByRole("slider", { name: "효과음 볼륨" }), {
      target: { value: "10" },
    });
    expect(useAudioStore.getState().sfxVolume).toBeCloseTo(0.1);
  });

  it("mute button toggles isMuted", () => {
    render(<InGameSoundControl />);
    openPopover();
    expect(useAudioStore.getState().isMuted).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "음소거" }));
    expect(useAudioStore.getState().isMuted).toBe(true);
  });

  it("muted state shows VolumeX icon and unmute label", () => {
    useAudioStore.setState({ isMuted: true });
    render(<InGameSoundControl />);
    expect(screen.getByRole("button", { name: "사운드 켜기" })).toBeTruthy();

    openPopover();
    expect(screen.getByRole("button", { name: "음소거 해제" })).toBeTruthy();
  });

  it("displays percentage values", () => {
    useAudioStore.setState({
      masterVolume: 0.6,
      bgmVolume: 0.4,
      voiceVolume: 0.9,
      sfxVolume: 0.25,
    });
    render(<InGameSoundControl />);
    openPopover();
    expect(screen.getByText("60%")).toBeTruthy();
    expect(screen.getByText("40%")).toBeTruthy();
    expect(screen.getByText("90%")).toBeTruthy();
    expect(screen.getByText("25%")).toBeTruthy();
  });

  it("sliders are disabled when muted", () => {
    useAudioStore.setState({ isMuted: true });
    render(<InGameSoundControl />);
    openPopover();
    expect(
      (screen.getByRole("slider", { name: "마스터 볼륨" }) as HTMLInputElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("slider", { name: "배경음악 볼륨" }) as HTMLInputElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("slider", { name: "음성 볼륨" }) as HTMLInputElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("slider", { name: "효과음 볼륨" }) as HTMLInputElement)
        .disabled,
    ).toBe(true);
  });

  it("clicking button again closes popover", () => {
    render(<InGameSoundControl />);
    openPopover();
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "사운드 설정" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
