import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { WsEventType } from "@mmp/shared";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockPlayers, mockMyPlayerId, mockWhisperMessages } = vi.hoisted(() => ({
  mockPlayers: [] as { id: string; nickname: string; role?: string }[],
  mockMyPlayerId: "player-1",
  mockWhisperMessages: [] as unknown[],
}));

// ---------------------------------------------------------------------------
// Mock: gameSessionStore
// ---------------------------------------------------------------------------

vi.mock("@/stores/gameSessionStore", () => ({
  useGameSessionStore: (selector: (s: unknown) => unknown) => {
    return selector({
      players: mockPlayers,
      myPlayerId: mockMyPlayerId,
    });
  },
}));

// ---------------------------------------------------------------------------
// Mock: gameChatStore
// ---------------------------------------------------------------------------

const mockAddWhisperMessage = vi.fn();

vi.mock("@/stores/gameChatStore", () => ({
  useGameChatStore: (selector: (s: unknown) => unknown) => {
    return selector({
      whisperMessages: mockWhisperMessages,
      addWhisperMessage: mockAddWhisperMessage,
    });
  },
}));

// ---------------------------------------------------------------------------
// Mock: useWsEvent (no-op)
// ---------------------------------------------------------------------------

vi.mock("@/hooks/useWsEvent", () => ({
  useWsEvent: () => {},
}));

// ---------------------------------------------------------------------------
// Component under test
// ---------------------------------------------------------------------------

import { WhisperPanel } from "../WhisperPanel";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  mockPlayers.length = 0;
  mockWhisperMessages.length = 0;
  mockAddWhisperMessage.mockClear();
});

// ---------------------------------------------------------------------------
// Tests — 렌더링
// ---------------------------------------------------------------------------

describe("WhisperPanel — 렌더링", () => {
  it("헤더에 '귓속말' 텍스트를 표시한다", () => {
    render(<WhisperPanel send={vi.fn()} />);
    expect(screen.getByText("귓속말")).toBeDefined();
  });

  it("대상 선택 드롭다운을 렌더링한다", () => {
    render(<WhisperPanel send={vi.fn()} />);
    expect(screen.getByLabelText("귓속말 대상 선택")).toBeDefined();
  });

  it("빈 메시지 목록에 안내 텍스트를 표시한다", () => {
    render(<WhisperPanel send={vi.fn()} />);
    expect(screen.getByText("귓속말이 없습니다.")).toBeDefined();
  });

  it("자신을 제외한 플레이어만 대상 목록에 표시한다", () => {
    mockPlayers.push(
      { id: "player-1", nickname: "나" },
      { id: "player-2", nickname: "탐정A" },
      { id: "player-3", nickname: "탐정B" },
    );
    render(<WhisperPanel send={vi.fn()} />);
    expect(screen.queryByText("나")).toBeNull();
    expect(screen.getByText("탐정A")).toBeDefined();
    expect(screen.getByText("탐정B")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Tests — 전송
// ---------------------------------------------------------------------------

describe("WhisperPanel — 귓속말 전송", () => {
  beforeEach(() => {
    mockPlayers.push(
      { id: "player-1", nickname: "나" },
      { id: "player-2", nickname: "탐정A" },
    );
  });

  it("대상 선택 후 메시지 입력 시 CHAT_WHISPER로 전송한다", () => {
    const send = vi.fn();
    render(<WhisperPanel send={send} />);

    const select = screen.getByLabelText("귓속말 대상 선택");
    fireEvent.change(select, { target: { value: "player-2" } });

    const input = screen.getByPlaceholderText("귓속말을 입력하세요...");
    fireEvent.change(input, { target: { value: "비밀 정보" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(send).toHaveBeenCalledWith(WsEventType.CHAT_WHISPER, {
      targetId: "player-2",
      text: "비밀 정보",
    });
  });

  it("전송 후 입력창이 비워진다", () => {
    const send = vi.fn();
    render(<WhisperPanel send={send} />);

    const select = screen.getByLabelText("귓속말 대상 선택");
    fireEvent.change(select, { target: { value: "player-2" } });

    const input = screen.getByPlaceholderText("귓속말을 입력하세요...") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "테스트" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(input.value).toBe("");
  });

  it("대상 미선택 시 전송 버튼이 비활성화된다", () => {
    render(<WhisperPanel send={vi.fn()} />);

    const input = screen.getByPlaceholderText("귓속말을 입력하세요...");
    fireEvent.change(input, { target: { value: "메시지" } });

    const sendBtn = screen.getByRole("button", { name: "메시지 전송" });
    expect(sendBtn).toHaveProperty("disabled", true);
  });

  it("빈 메시지는 전송하지 않는다", () => {
    const send = vi.fn();
    render(<WhisperPanel send={send} />);

    const select = screen.getByLabelText("귓속말 대상 선택");
    fireEvent.change(select, { target: { value: "player-2" } });

    const input = screen.getByPlaceholderText("귓속말을 입력하세요...");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(send).not.toHaveBeenCalled();
  });
});
