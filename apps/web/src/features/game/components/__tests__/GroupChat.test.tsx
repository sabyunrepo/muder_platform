import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { WsEventType } from "@mmp/shared";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockModuleData, mockPlayers, mockMyPlayerId } = vi.hoisted(() => ({
  mockModuleData: { groups: [] as unknown[] } as Record<string, unknown>,
  mockPlayers: [] as { id: string; nickname: string }[],
  mockMyPlayerId: "player-1",
}));

// ---------------------------------------------------------------------------
// Mock: moduleStoreFactory
// ---------------------------------------------------------------------------

vi.mock("@/stores/moduleStoreFactory", () => ({
  useModuleStore: (
    _moduleId: string,
    selector?: (s: { data: Record<string, unknown> }) => unknown,
  ) => {
    const state = { data: mockModuleData };
    return selector ? selector(state) : state;
  },
}));

// ---------------------------------------------------------------------------
// Mock: gameStore
// ---------------------------------------------------------------------------

vi.mock("@/stores/gameStore", () => ({
  useGameStore: (selector: (s: unknown) => unknown) => {
    const fakeState = {
      players: mockPlayers,
      myPlayerId: mockMyPlayerId,
    };
    return selector(fakeState);
  },
}));

// ---------------------------------------------------------------------------
// Mock: useWsEvent (no-op)
// ---------------------------------------------------------------------------

vi.mock("@/hooks/useWsEvent", () => ({
  useWsEvent: () => {},
}));

// ---------------------------------------------------------------------------
// 테스트 대상
// ---------------------------------------------------------------------------

import { GameChat } from "../GameChat";

afterEach(() => {
  cleanup();
  mockModuleData.groups = [];
  mockPlayers.length = 0;
});

// ---------------------------------------------------------------------------
// 그룹 탭 렌더링
// ---------------------------------------------------------------------------

describe("GameChat — 그룹 탭", () => {
  it("'그룹' 탭 버튼을 렌더링한다", () => {
    render(<GameChat send={vi.fn()} />);
    expect(screen.getByText("그룹")).toBeDefined();
  });

  it("그룹 탭 클릭 시 그룹 목록 영역이 표시된다", () => {
    render(<GameChat send={vi.fn()} />);
    fireEvent.click(screen.getByText("그룹"));
    expect(screen.getByText("그룹 목록")).toBeDefined();
  });

  it("그룹이 없으면 '생성된 그룹이 없습니다' 메시지를 표시한다", () => {
    render(<GameChat send={vi.fn()} />);
    fireEvent.click(screen.getByText("그룹"));
    expect(screen.getByText("생성된 그룹이 없습니다.")).toBeDefined();
  });

  it("그룹이 있으면 그룹 이름과 멤버 수를 표시한다", () => {
    mockModuleData.groups = [
      { id: "g1", name: "비밀 팀", members: ["player-1", "player-2"] },
    ];
    render(<GameChat send={vi.fn()} />);
    fireEvent.click(screen.getByText("그룹"));
    expect(screen.getByText("비밀 팀")).toBeDefined();
    expect(screen.getByText("2명")).toBeDefined();
  });

  it("그룹 선택 전에는 '그룹을 선택하거나 만들어보세요.' 안내를 표시한다", () => {
    render(<GameChat send={vi.fn()} />);
    fireEvent.click(screen.getByText("그룹"));
    expect(screen.getByText("그룹을 선택하거나 만들어보세요.")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 그룹 메시지 전송
// ---------------------------------------------------------------------------

describe("GameChat — 그룹 메시지 전송", () => {
  beforeEach(() => {
    mockModuleData.groups = [
      { id: "g1", name: "탐정단", members: ["player-1", "player-2"] },
    ];
  });

  it("그룹 선택 후 메시지 입력 시 GAME_ACTION으로 send를 호출한다", () => {
    const send = vi.fn();
    render(<GameChat send={send} />);

    fireEvent.click(screen.getByText("그룹"));
    fireEvent.click(screen.getByText("탐정단"));

    const input = screen.getByPlaceholderText("그룹 메시지를 입력하세요...");
    fireEvent.change(input, { target: { value: "안녕하세요" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(send).toHaveBeenCalledWith(WsEventType.GAME_ACTION, {
      type: "chat:group_message",
      groupId: "g1",
      text: "안녕하세요",
    });
  });

  it("그룹 미선택 시 전송 버튼이 비활성화된다", () => {
    const send = vi.fn();
    render(<GameChat send={send} />);

    fireEvent.click(screen.getByText("그룹"));

    const input = screen.getByPlaceholderText("그룹 메시지를 입력하세요...");
    fireEvent.change(input, { target: { value: "메시지" } });

    const sendBtn = screen.getByRole("button", { name: "메시지 전송" });
    expect(sendBtn).toHaveProperty("disabled", true);
  });
});

// ---------------------------------------------------------------------------
// 그룹 생성 플로우
// ---------------------------------------------------------------------------

describe("GameChat — 그룹 생성", () => {
  beforeEach(() => {
    mockPlayers.push(
      { id: "player-1", nickname: "나" },
      { id: "player-2", nickname: "탐정A" },
      { id: "player-3", nickname: "탐정B" },
    );
    Object.assign(mockMyPlayerId, {}); // myPlayerId는 player-1 고정
  });

  it("'그룹 만들기' 버튼 클릭 시 멤버 선택 UI가 표시된다", () => {
    render(<GameChat send={vi.fn()} />);
    fireEvent.click(screen.getByText("그룹"));
    fireEvent.click(screen.getByText("그룹 만들기"));
    expect(screen.getByText("멤버 선택")).toBeDefined();
  });

  it("멤버를 선택하고 '그룹 만들기' 버튼 클릭 시 GAME_ACTION으로 send를 호출한다", () => {
    const send = vi.fn();
    render(<GameChat send={send} />);

    fireEvent.click(screen.getByText("그룹"));
    fireEvent.click(screen.getByText("그룹 만들기"));

    // 탐정A 선택
    fireEvent.click(screen.getByText("탐정A"));

    // "그룹 만들기 (1명)" 버튼 클릭
    fireEvent.click(screen.getByText("그룹 만들기 (1명)"));

    expect(send).toHaveBeenCalledWith(WsEventType.GAME_ACTION, {
      type: "chat:group_create",
      memberIds: ["player-2"],
    });
  });

  it("멤버 미선택 시 '그룹 만들기' 생성 버튼이 비활성화된다", () => {
    render(<GameChat send={vi.fn()} />);
    fireEvent.click(screen.getByText("그룹"));
    fireEvent.click(screen.getByText("그룹 만들기"));

    const createBtn = screen.getByText("그룹 만들기 (0명)");
    expect(createBtn).toHaveProperty("disabled", true);
  });

  it("취소 버튼 클릭 시 멤버 선택 UI가 닫힌다", () => {
    render(<GameChat send={vi.fn()} />);
    fireEvent.click(screen.getByText("그룹"));
    fireEvent.click(screen.getByText("그룹 만들기"));

    expect(screen.getByText("멤버 선택")).toBeDefined();

    fireEvent.click(screen.getByLabelText("취소"));

    expect(screen.queryByText("멤버 선택")).toBeNull();
    expect(screen.getByText("그룹 목록")).toBeDefined();
  });
});
