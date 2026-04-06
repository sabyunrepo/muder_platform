import { useState } from "react";
import { MessageSquarePlus, Users } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Input,
  Modal,
  EmptyState,
  Spinner,
} from "@/shared/components/ui";
import {
  useChatRooms,
  useFriends,
  useCreateDMRoom,
  useCreateGroupRoom,
} from "@/features/social/api";
import type { ChatRoomSummary, FriendResponse } from "@/features/social/api";
import { useSocialStore } from "@/stores/socialStore";

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

function formatTimeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "방금";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// ChatRoomRow
// ---------------------------------------------------------------------------

interface ChatRoomRowProps {
  room: ChatRoomSummary;
  isSelected: boolean;
  onClick: () => void;
}

function ChatRoomRow({ room, isSelected, onClick }: ChatRoomRowProps) {
  const unreadCounts = useSocialStore((s) => s.unreadCounts);
  const unread = unreadCounts.get(room.id) ?? room.unread_count;

  return (
    <button
      type="button"
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
        isSelected
          ? "border border-amber-500/50 bg-amber-500/10"
          : "border border-transparent hover:bg-slate-800"
      }`}
      onClick={onClick}
    >
      {/* Avatar placeholder */}
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-slate-300">
        {room.type === "GROUP" ? (
          <Users className="h-5 w-5" />
        ) : (
          (room.name ?? "?").charAt(0).toUpperCase()
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="truncate text-sm font-medium text-slate-100">
            {room.name ?? "채팅방"}
          </span>
          {room.last_message_at && (
            <span className="flex-shrink-0 text-[10px] text-slate-500">
              {formatTimeAgo(room.last_message_at)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <p className="truncate text-xs text-slate-400">
            {room.last_message ?? "메시지가 없습니다"}
          </p>
          {unread > 0 && (
            <span className="ml-2 inline-flex min-w-[1.25rem] flex-shrink-0 items-center justify-center rounded-full bg-amber-500 px-1 text-xs font-bold text-slate-950">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// NewChatModal
// ---------------------------------------------------------------------------

type NewChatTab = "dm" | "group";

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoomCreated: (roomId: string) => void;
}

function NewChatModal({ isOpen, onClose, onRoomCreated }: NewChatModalProps) {
  const [tab, setTab] = useState<NewChatTab>("dm");
  const [groupName, setGroupName] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());

  const { data: friends, isLoading: friendsLoading } = useFriends();
  const createDM = useCreateDMRoom();
  const createGroup = useCreateGroupRoom();

  function handleSelectFriend(friendId: string) {
    if (tab === "dm") {
      // DM: single select, create immediately
      createDM.mutate(
        { user_id: friendId },
        {
          onSuccess: (room) => {
            toast.success("채팅방이 생성되었습니다");
            resetAndClose();
            onRoomCreated(room.id);
          },
          onError: (err) => {
            toast.error(err.message || "채팅방 생성에 실패했습니다");
          },
        },
      );
      return;
    }

    // Group: toggle selection
    setSelectedFriends((prev) => {
      const next = new Set(prev);
      if (next.has(friendId)) {
        next.delete(friendId);
      } else {
        next.add(friendId);
      }
      return next;
    });
  }

  function handleCreateGroup() {
    if (!groupName.trim() || selectedFriends.size === 0) return;
    createGroup.mutate(
      { name: groupName.trim(), member_ids: Array.from(selectedFriends) },
      {
        onSuccess: (room) => {
          toast.success("그룹 채팅방이 생성되었습니다");
          resetAndClose();
          onRoomCreated(room.id);
        },
        onError: (err) => {
          toast.error(err.message || "그룹 생성에 실패했습니다");
        },
      },
    );
  }

  function resetAndClose() {
    setTab("dm");
    setGroupName("");
    setSelectedFriends(new Set());
    onClose();
  }

  const isPending = createDM.isPending || createGroup.isPending;

  return (
    <Modal isOpen={isOpen} onClose={resetAndClose} title="새 채팅">
      <div className="flex flex-col gap-4">
        {/* Tab selector */}
        <div className="flex border-b border-slate-700">
          <button
            type="button"
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              tab === "dm"
                ? "border-b-2 border-amber-500 text-amber-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
            onClick={() => { setTab("dm"); setSelectedFriends(new Set()); }}
          >
            1:1 대화
          </button>
          <button
            type="button"
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              tab === "group"
                ? "border-b-2 border-amber-500 text-amber-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
            onClick={() => setTab("group")}
          >
            그룹 채팅
          </button>
        </div>

        {/* Group name input */}
        {tab === "group" && (
          <Input
            label="그룹 이름"
            placeholder="그룹 채팅방 이름"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
        )}

        {/* Friend list */}
        <div className="max-h-60 overflow-y-auto">
          <p className="mb-2 text-xs font-medium text-slate-400">
            {tab === "dm" ? "대화할 친구를 선택하세요" : "멤버를 선택하세요"}
          </p>
          {friendsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : !friends || friends.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">
              친구가 없습니다. 먼저 친구를 추가해주세요.
            </p>
          ) : (
            <div className="space-y-1">
              {friends.map((friend: FriendResponse) => (
                <button
                  key={friend.id}
                  type="button"
                  disabled={isPending}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                    selectedFriends.has(friend.id)
                      ? "bg-amber-500/10 ring-1 ring-amber-500/50"
                      : "hover:bg-slate-800"
                  }`}
                  onClick={() => handleSelectFriend(friend.id)}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-slate-300">
                    {friend.nickname.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-slate-100">{friend.nickname}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Group create button */}
        {tab === "group" && (
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleCreateGroup}
              isLoading={createGroup.isPending}
              disabled={!groupName.trim() || selectedFriends.size === 0}
            >
              그룹 만들기 ({selectedFriends.size}명)
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// ChatList
// ---------------------------------------------------------------------------

interface ChatListProps {
  onSelectRoom: (roomId: string) => void;
  selectedRoomId?: string;
}

export function ChatList({ onSelectRoom, selectedRoomId }: ChatListProps) {
  const { data: rooms, isLoading } = useChatRooms();
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);

  function handleRoomCreated(roomId: string) {
    onSelectRoom(roomId);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700 px-4 py-4">
        <h2 className="text-lg font-bold text-slate-100">채팅</h2>
        <Button
          size="sm"
          leftIcon={<MessageSquarePlus className="h-4 w-4" />}
          onClick={() => setIsNewChatOpen(true)}
        >
          새 채팅
        </Button>
      </div>

      {/* Room list */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : !rooms || rooms.length === 0 ? (
          <EmptyState
            icon={<MessageSquarePlus className="h-10 w-10" />}
            title="채팅방이 없습니다"
            description="친구와 대화를 시작해보세요"
            action={
              <Button
                size="sm"
                leftIcon={<MessageSquarePlus className="h-4 w-4" />}
                onClick={() => setIsNewChatOpen(true)}
              >
                새 채팅
              </Button>
            }
          />
        ) : (
          <div className="space-y-1">
            {rooms.map((room) => (
              <ChatRoomRow
                key={room.id}
                room={room}
                isSelected={selectedRoomId === room.id}
                onClick={() => onSelectRoom(room.id)}
              />
            ))}
          </div>
        )}
      </div>

      <NewChatModal
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
        onRoomCreated={handleRoomCreated}
      />
    </div>
  );
}
