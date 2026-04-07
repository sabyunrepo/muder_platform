import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

import { SoundControl } from "./SoundControl";
import { useAudioStore } from "@/stores/audioStore";

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  // Reset store to defaults
  useAudioStore.setState({
    masterVolume: 0.8,
    sfxVolume: 1,
    bgmVolume: 0.5,
    voiceVolume: 1,
    isMuted: false,
    bgmMediaId: null,
  });
});

describe("SoundControl", () => {
  function openPopover() {
    const toggle =
      screen.queryByRole("button", { name: "사운드 설정" }) ??
      screen.getByRole("button", { name: "사운드 켜기" });
    fireEvent.click(toggle);
  }

  it("popover를 열면 음성 슬라이더가 표시된다", () => {
    render(<SoundControl />);
    openPopover();

    const voiceSlider = screen.getByLabelText("음성 볼륨");
    expect(voiceSlider).toBeDefined();
    expect((voiceSlider as HTMLInputElement).value).toBe("100");
  });

  it("음성 슬라이더 변경 시 voiceVolume이 갱신된다", () => {
    render(<SoundControl />);
    openPopover();

    const voiceSlider = screen.getByLabelText("음성 볼륨") as HTMLInputElement;
    fireEvent.change(voiceSlider, { target: { value: "40" } });

    expect(useAudioStore.getState().voiceVolume).toBeCloseTo(0.4);
  });

  it("음소거 시 음성 슬라이더가 disabled 된다", () => {
    useAudioStore.setState({ isMuted: true });
    render(<SoundControl />);
    openPopover();

    const voiceSlider = screen.getByLabelText("음성 볼륨") as HTMLInputElement;
    expect(voiceSlider.disabled).toBe(true);
  });
});
