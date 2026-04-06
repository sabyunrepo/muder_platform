import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Hoisted mocks (available inside vi.mock factories)
// ---------------------------------------------------------------------------

const {
  mutateMock,
  markAsReadMutateMock,
  toastSuccess,
  toastError,
  useFriendsMock,
  usePendingRequestsMock,
  useSendFriendRequestMock,
  useAcceptFriendRequestMock,
  useRejectFriendRequestMock,
  useRemoveFriendMock,
  useChatRoomsMock,
  useChatMessagesMock,
  useSendMessageMock,
  useMarkAsReadMock,
  useCreateDMRoomMock,
  useCreateGroupRoomMock,
  useSocialStoreMock,
  useAuthStoreMock,
} = vi.hoisted(() => ({
  mutateMock: vi.fn(),
  markAsReadMutateMock: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  useFriendsMock: vi.fn(),
  usePendingRequestsMock: vi.fn(),
  useSendFriendRequestMock: vi.fn(),
  useAcceptFriendRequestMock: vi.fn(),
  useRejectFriendRequestMock: vi.fn(),
  useRemoveFriendMock: vi.fn(),
  useChatRoomsMock: vi.fn(),
  useChatMessagesMock: vi.fn(),
  useSendMessageMock: vi.fn(),
  useMarkAsReadMock: vi.fn(),
  useCreateDMRoomMock: vi.fn(),
  useCreateGroupRoomMock: vi.fn(),
  useSocialStoreMock: vi.fn(),
  useAuthStoreMock: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock: sonner
// ---------------------------------------------------------------------------

vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
}));

// ---------------------------------------------------------------------------
// Mock: @/features/social/api
// ---------------------------------------------------------------------------

vi.mock("@/features/social/api", () => ({
  useFriends: () => useFriendsMock(),
  usePendingRequests: () => usePendingRequestsMock(),
  useSendFriendRequest: () => useSendFriendRequestMock(),
  useAcceptFriendRequest: () => useAcceptFriendRequestMock(),
  useRejectFriendRequest: () => useRejectFriendRequestMock(),
  useRemoveFriend: () => useRemoveFriendMock(),
  useChatRooms: () => useChatRoomsMock(),
  useChatMessages: () => useChatMessagesMock(),
  useSendMessage: () => useSendMessageMock(),
  useMarkAsRead: () => useMarkAsReadMock(),
  useCreateDMRoom: () => useCreateDMRoomMock(),
  useCreateGroupRoom: () => useCreateGroupRoomMock(),
}));

// ---------------------------------------------------------------------------
// Mock: @/stores/socialStore
// ---------------------------------------------------------------------------

vi.mock("@/stores/socialStore", () => ({
  useSocialStore: (selector: (s: unknown) => unknown) =>
    useSocialStoreMock(selector),
}));

// ---------------------------------------------------------------------------
// Mock: @/stores/authStore
// ---------------------------------------------------------------------------

vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    useAuthStoreMock(selector),
}));

// ---------------------------------------------------------------------------
// Mock: @/features/social/constants
// ---------------------------------------------------------------------------

vi.mock("@/features/social/constants", () => ({
  MAX_MESSAGE_LENGTH: 2000,
  CHAT_MESSAGE_LIMIT: 50,
  FRIEND_LIST_LIMIT: 50,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { FriendsList } from "../FriendsList";
import { ChatList } from "../ChatList";
import { ChatRoom } from "../ChatRoom";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockFriends = [
  {
    id: "u1",
    nickname: "테스트친구",
    avatar_url: null,
    role: "user",
    friendship_id: "f1",
    since: "2026-04-01T00:00:00Z",
  },
  {
    id: "u2",
    nickname: "온라인친구",
    avatar_url: null,
    role: "creator",
    friendship_id: "f2",
    since: "2026-04-02T00:00:00Z",
  },
];

const mockPendingRequests = [
  {
    friendship_id: "p1",
    requester_id: "u3",
    nickname: "대기유저",
    avatar_url: null,
    created_at: "2026-04-05T00:00:00Z",
  },
  {
    friendship_id: "p2",
    requester_id: "u4",
    nickname: "대기유저2",
    avatar_url: null,
    created_at: "2026-04-05T01:00:00Z",
  },
];

const mockChatRooms = [
  {
    id: "r1",
    type: "DM" as const,
    name: "테스트친구",
    unread_count: 3,
    last_message: "안녕하세요",
    last_message_at: "2026-04-05T12:00:00Z",
  },
  {
    id: "r2",
    type: "GROUP" as const,
    name: "스터디 그룹",
    unread_count: 0,
    last_message: null,
    last_message_at: null,
  },
];

const mockMessages = [
  {
    id: 1,
    chat_room_id: "r1",
    sender_id: "u1",
    sender_nickname: "테스트친구",
    sender_avatar: null,
    content: "안녕하세요!",
    message_type: "TEXT",
    created_at: "2026-04-05T12:00:00Z",
  },
  {
    id: 2,
    chat_room_id: "r1",
    sender_id: "me",
    sender_nickname: "나",
    sender_avatar: null,
    content: "반갑습니다",
    message_type: "TEXT",
    created_at: "2026-04-05T12:01:00Z",
  },
  {
    id: 3,
    chat_room_id: "r1",
    sender_id: "system",
    sender_nickname: "시스템",
    sender_avatar: null,
    content: "게임이 시작되었습니다",
    message_type: "SYSTEM",
    created_at: "2026-04-05T12:02:00Z",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultMutationReturn() {
  return { mutate: mutateMock, isPending: false };
}

function defaultSocialStoreSelector(selector: (s: unknown) => unknown) {
  const state = {
    onlineFriends: new Set<string>(),
    unreadCounts: new Map<string, number>(),
    typingUsers: new Map<string, string[]>(),
  };
  return selector(state);
}

function onlineSocialStoreSelector(onlineIds: Set<string>) {
  return (selector: (s: unknown) => unknown) => {
    const state = {
      onlineFriends: onlineIds,
      unreadCounts: new Map<string, number>(),
      typingUsers: new Map<string, string[]>(),
    };
    return selector(state);
  };
}

function unreadSocialStoreSelector(unreadMap: Map<string, number>) {
  return (selector: (s: unknown) => unknown) => {
    const state = {
      onlineFriends: new Set<string>(),
      unreadCounts: unreadMap,
      typingUsers: new Map<string, string[]>(),
    };
    return selector(state);
  };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// =========================================================================
// 1. FriendsList
// =========================================================================

describe("FriendsList", () => {
  beforeEach(() => {
    useSendFriendRequestMock.mockReturnValue(defaultMutationReturn());
    useAcceptFriendRequestMock.mockReturnValue(defaultMutationReturn());
    useRejectFriendRequestMock.mockReturnValue(defaultMutationReturn());
    useRemoveFriendMock.mockReturnValue(defaultMutationReturn());
    usePendingRequestsMock.mockReturnValue({
      data: [],
      isLoading: false,
    });
    useSocialStoreMock.mockImplementation(defaultSocialStoreSelector);
  });

  it("로딩 중일 때 스피너를 표시한다", () => {
    useFriendsMock.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const { container } = render(<FriendsList />);
    const spinner = container.querySelector('[role="status"]');
    expect(spinner).not.toBeNull();
  });

  it("친구가 없을 때 빈 상태를 표시한다", () => {
    useFriendsMock.mockReturnValue({
      data: [],
      isLoading: false,
    });

    render(<FriendsList />);
    expect(screen.getByText("아직 친구가 없습니다")).toBeDefined();
  });

  it("친구 닉네임을 렌더링한다", () => {
    useFriendsMock.mockReturnValue({
      data: mockFriends,
      isLoading: false,
    });

    render(<FriendsList />);
    expect(screen.getByText("테스트친구")).toBeDefined();
    expect(screen.getByText("온라인친구")).toBeDefined();
  });

  it("온라인 친구에 온라인 표시를 보여준다", () => {
    useFriendsMock.mockReturnValue({
      data: mockFriends,
      isLoading: false,
    });
    useSocialStoreMock.mockImplementation(
      onlineSocialStoreSelector(new Set(["u2"])),
    );

    const { container } = render(<FriendsList />);
    // Online indicator: emerald-500 dot adjacent to the avatar of "온라인친구"
    const onlineDots = container.querySelectorAll(".bg-emerald-500");
    expect(onlineDots.length).toBe(1);
  });

  it("대기 중인 요청 수 배지를 표시한다", () => {
    useFriendsMock.mockReturnValue({
      data: mockFriends,
      isLoading: false,
    });
    usePendingRequestsMock.mockReturnValue({
      data: mockPendingRequests,
      isLoading: false,
    });

    render(<FriendsList />);
    // Badge shows count "2" inside the pending tab
    expect(screen.getByText("2")).toBeDefined();
  });

  it("'친구 추가' 버튼이 존재한다", () => {
    useFriendsMock.mockReturnValue({
      data: mockFriends,
      isLoading: false,
    });

    render(<FriendsList />);
    expect(screen.getByText("친구 추가")).toBeDefined();
  });

  it("수락 버튼 클릭 시 mutation을 호출한다", () => {
    useFriendsMock.mockReturnValue({
      data: [],
      isLoading: false,
    });
    usePendingRequestsMock.mockReturnValue({
      data: mockPendingRequests,
      isLoading: false,
    });

    render(<FriendsList />);

    // Switch to pending tab
    const pendingTab = screen.getByText("대기 중인 요청", { exact: false });
    fireEvent.click(pendingTab);

    // Click accept button for first pending request
    const acceptButtons = screen.getAllByLabelText("수락");
    expect(acceptButtons.length).toBeGreaterThan(0);
    fireEvent.click(acceptButtons[0]!);

    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock).toHaveBeenCalledWith("p1", expect.any(Object));
  });

  it("거절 버튼 클릭 시 mutation을 호출한다", () => {
    useFriendsMock.mockReturnValue({
      data: [],
      isLoading: false,
    });
    usePendingRequestsMock.mockReturnValue({
      data: mockPendingRequests,
      isLoading: false,
    });

    render(<FriendsList />);

    // Switch to pending tab
    const pendingTab = screen.getByText("대기 중인 요청", { exact: false });
    fireEvent.click(pendingTab);

    // Click reject button for first pending request
    const rejectButtons = screen.getAllByLabelText("거절");
    expect(rejectButtons.length).toBeGreaterThan(0);
    fireEvent.click(rejectButtons[0]!);

    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock).toHaveBeenCalledWith("p1", expect.any(Object));
  });

  it("검색 입력 시 친구 목록을 필터링한다", () => {
    useFriendsMock.mockReturnValue({
      data: mockFriends,
      isLoading: false,
    });

    render(<FriendsList />);

    const searchInput = screen.getByPlaceholderText("닉네임으로 검색...");
    fireEvent.change(searchInput, { target: { value: "테스트" } });

    expect(screen.getByText("테스트친구")).toBeDefined();
    expect(screen.queryByText("온라인친구")).toBeNull();
  });
});

// =========================================================================
// 2. ChatList
// =========================================================================

describe("ChatList", () => {
  const onSelectRoom = vi.fn();

  beforeEach(() => {
    useCreateDMRoomMock.mockReturnValue(defaultMutationReturn());
    useCreateGroupRoomMock.mockReturnValue(defaultMutationReturn());
    useFriendsMock.mockReturnValue({ data: [], isLoading: false });
    useSocialStoreMock.mockImplementation(defaultSocialStoreSelector);
  });

  it("로딩 중일 때 스피너를 표시한다", () => {
    useChatRoomsMock.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const { container } = render(
      <ChatList onSelectRoom={onSelectRoom} />,
    );
    const spinner = container.querySelector('[role="status"]');
    expect(spinner).not.toBeNull();
  });

  it("채팅방이 없을 때 빈 상태를 표시한다", () => {
    useChatRoomsMock.mockReturnValue({
      data: [],
      isLoading: false,
    });

    render(<ChatList onSelectRoom={onSelectRoom} />);
    expect(screen.getByText("채팅방이 없습니다")).toBeDefined();
  });

  it("채팅방 이름을 렌더링한다", () => {
    useChatRoomsMock.mockReturnValue({
      data: mockChatRooms,
      isLoading: false,
    });

    render(<ChatList onSelectRoom={onSelectRoom} />);
    expect(screen.getByText("테스트친구")).toBeDefined();
    expect(screen.getByText("스터디 그룹")).toBeDefined();
  });

  it("읽지 않은 메시지가 있는 방에 배지를 표시한다", () => {
    useChatRoomsMock.mockReturnValue({
      data: mockChatRooms,
      isLoading: false,
    });
    // unreadCounts map empty → falls back to room.unread_count
    useSocialStoreMock.mockImplementation(
      unreadSocialStoreSelector(new Map()),
    );

    render(<ChatList onSelectRoom={onSelectRoom} />);
    // room r1 has unread_count: 3
    expect(screen.getByText("3")).toBeDefined();
  });

  it("선택된 방이 하이라이트된다", () => {
    useChatRoomsMock.mockReturnValue({
      data: mockChatRooms,
      isLoading: false,
    });

    const { container } = render(
      <ChatList onSelectRoom={onSelectRoom} selectedRoomId="r1" />,
    );
    // Selected room has amber border class
    const selectedRoom = container.querySelector(".border-amber-500\\/50");
    expect(selectedRoom).not.toBeNull();
  });

  it("'새 채팅' 버튼이 존재한다", () => {
    useChatRoomsMock.mockReturnValue({
      data: mockChatRooms,
      isLoading: false,
    });

    render(<ChatList onSelectRoom={onSelectRoom} />);
    // Header has "새 채팅" button
    const buttons = screen.getAllByText("새 채팅");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("채팅방 클릭 시 onSelectRoom을 호출한다", () => {
    useChatRoomsMock.mockReturnValue({
      data: mockChatRooms,
      isLoading: false,
    });

    render(<ChatList onSelectRoom={onSelectRoom} />);
    fireEvent.click(screen.getByText("테스트친구"));
    expect(onSelectRoom).toHaveBeenCalledWith("r1");
  });
});

// =========================================================================
// 3. ChatRoom
// =========================================================================

describe("ChatRoom", () => {
  beforeEach(() => {
    useSendMessageMock.mockReturnValue(defaultMutationReturn());
    useMarkAsReadMock.mockReturnValue({
      mutate: markAsReadMutateMock,
      isPending: false,
    });
    useAuthStoreMock.mockImplementation((selector: (s: unknown) => unknown) =>
      selector({ user: { id: "me", nickname: "나" } }),
    );
  });

  it("로딩 중일 때 스피너를 표시한다", () => {
    useChatMessagesMock.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const { container } = render(<ChatRoom roomId="r1" />);
    const spinner = container.querySelector('[role="status"]');
    expect(spinner).not.toBeNull();
  });

  it("메시지가 없을 때 빈 상태를 표시한다", () => {
    useChatMessagesMock.mockReturnValue({
      data: [],
      isLoading: false,
    });

    render(<ChatRoom roomId="r1" />);
    expect(screen.getByText("메시지가 없습니다")).toBeDefined();
  });

  it("메시지 내용을 렌더링한다", () => {
    useChatMessagesMock.mockReturnValue({
      data: mockMessages,
      isLoading: false,
    });

    render(<ChatRoom roomId="r1" />);
    expect(screen.getByText("안녕하세요!")).toBeDefined();
    expect(screen.getByText("반갑습니다")).toBeDefined();
    expect(screen.getByText("게임이 시작되었습니다")).toBeDefined();
  });

  it("내 메시지는 다른 정렬(amber 스타일)을 가진다", () => {
    useChatMessagesMock.mockReturnValue({
      data: mockMessages,
      isLoading: false,
    });

    const { container } = render(<ChatRoom roomId="r1" />);
    // Own message bubble has amber class
    const amberBubbles = container.querySelectorAll('[class*="bg-amber"]');
    expect(amberBubbles.length).toBeGreaterThanOrEqual(1);

    // The own message "반갑습니다" should be in an amber bubble
    const ownBubble = Array.from(amberBubbles).find((el) =>
      el.textContent?.includes("반갑습니다"),
    );
    expect(ownBubble).toBeDefined();
  });

  it("시스템 메시지는 가운데 정렬된다", () => {
    useChatMessagesMock.mockReturnValue({
      data: mockMessages,
      isLoading: false,
    });

    const { container } = render(<ChatRoom roomId="r1" />);
    // System message has text-center class
    const systemMsg = container.querySelector(".text-center");
    expect(systemMsg).not.toBeNull();
    expect(systemMsg!.textContent).toContain("게임이 시작되었습니다");
  });

  it("보내기 버튼이 존재한다", () => {
    useChatMessagesMock.mockReturnValue({
      data: mockMessages,
      isLoading: false,
    });

    render(<ChatRoom roomId="r1" />);
    expect(screen.getByLabelText("메시지 보내기")).toBeDefined();
  });

  it("마운트 시 markAsRead를 호출한다", () => {
    useChatMessagesMock.mockReturnValue({
      data: mockMessages,
      isLoading: false,
    });

    render(<ChatRoom roomId="r1" />);
    expect(markAsReadMutateMock).toHaveBeenCalledWith(undefined);
  });

  it("다른 사람의 메시지에 발신자 닉네임을 표시한다", () => {
    useChatMessagesMock.mockReturnValue({
      data: mockMessages,
      isLoading: false,
    });

    render(<ChatRoom roomId="r1" />);
    // "테스트친구" sender nickname should be visible for non-own messages
    expect(screen.getByText("테스트친구")).toBeDefined();
  });

  it("빈 텍스트일 때 보내기 버튼이 비활성화된다", () => {
    useChatMessagesMock.mockReturnValue({
      data: mockMessages,
      isLoading: false,
    });

    render(<ChatRoom roomId="r1" />);
    const sendButton = screen.getByLabelText("메시지 보내기");
    expect(sendButton).toHaveProperty("disabled", true);
  });
});
