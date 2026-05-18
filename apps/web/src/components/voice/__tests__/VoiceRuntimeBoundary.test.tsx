import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useVoiceStore } from "@/stores/voiceStore";
import { VoiceBottomSheet } from "../VoiceBottomSheet";
import { VoiceOverlay, type VoiceChannel } from "../VoiceOverlay";

const channels: VoiceChannel[] = [
  {
    id: "main",
    name: "전체 채널",
    type: "main",
    participants: [
      {
        identity: "player-1",
        name: "윤서연",
        isSelf: true,
        isMuted: false,
      },
      {
        identity: "player-2",
        name: "한도윤",
        isSelf: false,
        isMuted: true,
      },
    ],
  },
];

beforeEach(() => {
  useVoiceStore.getState().reset();
  useVoiceStore.getState().setConnectionState("connected");
});

afterEach(() => {
  cleanup();
  useVoiceStore.getState().reset();
});

describe("voice runtime token surfaces", () => {
  it("desktop overlay renders inside the runtime boundary and keeps connection state visible", () => {
    render(
      <div className="mmp-runtime-boundary" data-game-runtime-theme="immersive">
        <VoiceOverlay channels={channels} volumes={new Map([["player-1", 0.8]])} speaking={new Set(["player-1"])} />
      </div>,
    );

    expect(screen.getByText("음성 채팅")).toBeDefined();
    expect(screen.getByText("연결됨")).toBeDefined();
    expect(screen.getByRole("button", { name: "마이크 끄기" })).toBeDefined();
    expect(screen.getByText("윤서연")).toBeDefined();
  });

  it("mobile bottom sheet uses semantic runtime tokens for its active controls", () => {
    useVoiceStore.getState().toggleBottomSheet();

    render(
      <div className="mmp-runtime-boundary" data-game-runtime-theme="immersive">
        <VoiceBottomSheet channels={channels} volumes={new Map()} speaking={new Set(["player-2"])} />
      </div>,
    );

    expect(screen.getByRole("dialog", { name: "음성 채팅" })).toBeDefined();
    expect(screen.getByRole("button", { name: "마이크 끄기" })).toBeDefined();
    expect(screen.getByText("한도윤")).toBeDefined();
  });
});
