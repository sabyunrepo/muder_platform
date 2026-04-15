import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { WsEventType } from "@mmp/shared";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockPlayers, mockMyPlayerId, mockMessages, mockWhisperMessages } = vi.hoisted(() => ({
  mockPlayers: [] as { id: string; nickname: string; role?: string }[],
  mockMyPlayerId: "player-1",
  mockMessages: [] as unknown[],
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

const mockAddMessage = vi.fn();
const mockAddWhisperMessage = vi.fn();

vi.mock("@/stores/gameChatStore", () => ({
  useGameChatStore: (selector: (s: unknown) => unknown) => {
    return selector({
      messages: mockMessages,
      whisperMessages: mockWhisperMessages,
      addMessage: mockAddMessage,
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

import { GameChatPanel } from "../GameChatPanel";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  mockPlayers.length = 0;
  mockMessages.length = 0;
  mockWhisperMessages.length = 0;
  mockAddMessage.mockClear();
  mockAddWhisperMessage.mockClear();
});

// ---------------------------------------------------------------------------
// Tests — rendering
// ---------------------------------------------------------------------------

describe("GameChatPanel — 렌더링", () => {
  it("'전체' 탭과 '귓속말' 탭을 렌더링한다", () => {
    render(<GameChatPanel send={vi.fn()} />);
    expect(screen.getByText("전체")).toBeDefined();
    expect(screen.getByText("귓속말")).toBeDefined();
  });

  it("기본 탭은 '전체'이고 입력 플레이스홀더가 맞다", () => {
    render(<GameChatPanel send={vi.fn()} />);
    expect(screen.getByPlaceholderText("메시지를 입력하세요...")).toBeDefined();
  });

  it("빈 메시지 목록에 안내 텍스트를 표시한다", () => {
    render(<GameChatPanel send={vi.fn()} />);
    expect(screen.getByText("아직 메시지가 없습니다.")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Tests — 전체 채팅 전송
// ---------------------------------------------------------------------------

describe("GameChatPanel — 전체 채팅 전송", () => {
  it("메시지 입력 후 Enter로 CHAT_MESSAGE를 전송한다", () => {
    const send = vi.fn();
    render(<GameChatPanel send={send} />);

    const input = screen.getByPlaceholderText("메시지를 입력하세요...");
    fireEvent.change(input, { target: { value: "안녕하세요" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(send).toHaveBeenCalledWith(WsEventType.CHAT_MESSAGE, { text: "안녕하세요" });
  });

  it("전송 후 입력창이 비워진다", () => {
    const send = vi.fn();
    render(<GameChatPanel send={send} />);

    const input = screen.getByPlaceholderText("메시지를 입력하세요...") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "테스트" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(input.value).toBe("");
  });

  it("빈 메시지는 전송하지 않는다", () => {
    const send = vi.fn();
    render(<GameChatPanel send={send} />);

    const input = screen.getByPlaceholderText("메시지를 입력하세요...");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(send).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests — 귓속말 탭
// ---------------------------------------------------------------------------

describe("GameChatPanel — 귓속말 탭", () => {
  beforeEach(() => {
    mockPlayers.push(
      { id: "player-1", nickname: "나" },
      { id: "player-2", nickname: "탐정A" },
    );
  });

  it("귓속말 탭 클릭 시 대상 선택 드롭다운이 표시된다", () => {
    render(<GameChatPanel send={vi.fn()} />);
    fireEvent.click(screen.getByText("귓속말"));
    expect(screen.getByLabelText("귓속말 대상 선택")).toBeDefined();
  });

  it("귓속말 탭에서 대상 선택 후 메시지 전송 시 CHAT_WHISPER를 사용한다", () => {
    const send = vi.fn();
    render(<GameChatPanel send={send} />);

    fireEvent.click(screen.getByText("귓속말"));

    const select = screen.getByLabelText("귓속말 대상 선택");
    fireEvent.change(select, { target: { value: "player-2" } });

    const input = screen.getByPlaceholderText("귓속말을 입력하세요...");
    fireEvent.change(input, { target: { value: "비밀 메시지" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(send).toHaveBeenCalledWith(WsEventType.CHAT_WHISPER, {
      targetId: "player-2",
      text: "비밀 메시지",
    });
  });

  it("귓속말 대상 미선택 시 전송 버튼이 비활성화된다", () => {
    render(<GameChatPanel send={vi.fn()} />);
    fireEvent.click(screen.getByText("귓속말"));

    const input = screen.getByPlaceholderText("귓속말을 입력하세요...");
    fireEvent.change(input, { target: { value: "메시지" } });

    const sendBtn = screen.getByRole("button", { name: "메시지 전송" });
    expect(sendBtn).toHaveProperty("disabled", true);
  });
});
