import { useState, useMemo } from "react";
import { UserPlus, Trash2, Check, X, Search, Users } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Input,
  Modal,
  Badge,
  EmptyState,
  Spinner,
} from "@/shared/components/ui";
import {
  useFriends,
  usePendingRequests,
  useSendFriendRequest,
  useAcceptFriendRequest,
  useRejectFriendRequest,
  useRemoveFriend,
} from "@/features/social/api";
import type { FriendResponse, PendingRequestResponse } from "@/features/social/api";
import { useSocialStore } from "@/stores/socialStore";

// ---------------------------------------------------------------------------
// Nickname color hash (same algorithm as game ChatMessage)
// ---------------------------------------------------------------------------

import { getNicknameColor } from "@/shared/utils/nickname";

// ---------------------------------------------------------------------------
// Tab types
// ---------------------------------------------------------------------------

type Tab = "friends" | "pending";

// ---------------------------------------------------------------------------
// FriendRow
// ---------------------------------------------------------------------------

interface FriendRowProps {
  friend: FriendResponse;
  isOnline: boolean;
  onRemove: (friendshipId: string) => void;
  isRemoving: boolean;
}

function FriendRow({ friend, isOnline, onRemove, isRemoving }: FriendRowProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <>
      <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-slate-300">
            {friend.nickname.charAt(0).toUpperCase()}
          </div>
          {isOnline && (
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-slate-900 bg-emerald-500" />
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`font-medium ${getNicknameColor(friend.nickname)}`}>
              {friend.nickname}
            </span>
            <Badge variant="default" size="sm">
              {friend.role}
            </Badge>
          </div>
        </div>

        {/* Actions */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowConfirm(true)}
          aria-label={`${friend.nickname} 삭제`}
        >
          <Trash2 className="h-4 w-4 text-red-400" />
        </Button>
      </div>

      <Modal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="친구 삭제"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowConfirm(false)} disabled={isRemoving}>
              취소
            </Button>
            <Button
              variant="danger"
              isLoading={isRemoving}
              onClick={() => onRemove(friend.friendship_id)}
            >
              삭제
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">
          <span className="font-semibold text-slate-100">{friend.nickname}</span>
          님을 친구 목록에서 삭제하시겠습니까?
        </p>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// PendingRow
// ---------------------------------------------------------------------------

interface PendingRowProps {
  request: PendingRequestResponse;
  onAccept: (friendshipId: string) => void;
  onReject: (friendshipId: string) => void;
  isAccepting: boolean;
  isRejecting: boolean;
}

function PendingRow({ request, onAccept, onReject, isAccepting, isRejecting }: PendingRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3">
      {/* Avatar */}
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-slate-300">
        {request.nickname.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <span className={`font-medium ${getNicknameColor(request.nickname)}`}>
          {request.nickname}
        </span>
        <p className="text-xs text-slate-500">
          {new Date(request.created_at).toLocaleDateString("ko-KR")}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onAccept(request.friendship_id)}
          disabled={isAccepting || isRejecting}
          aria-label="수락"
        >
          <Check className="h-4 w-4 text-emerald-400" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onReject(request.friendship_id)}
          disabled={isAccepting || isRejecting}
          aria-label="거절"
        >
          <X className="h-4 w-4 text-red-400" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddFriendModal
// ---------------------------------------------------------------------------

interface AddFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function AddFriendModal({ isOpen, onClose }: AddFriendModalProps) {
  const [userId, setUserId] = useState("");
  const sendRequest = useSendFriendRequest();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = userId.trim();
    if (!trimmed) return;

    sendRequest.mutate(
      { addressee_id: trimmed },
      {
        onSuccess: () => {
          toast.success("친구 요청을 보냈습니다");
          setUserId("");
          onClose();
        },
        onError: (err) => {
          toast.error(err.message || "친구 요청에 실패했습니다");
        },
      },
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="친구 추가">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="사용자 ID"
          placeholder="친구의 사용자 ID를 입력하세요"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          autoFocus
        />
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={sendRequest.isPending}>
            취소
          </Button>
          <Button type="submit" isLoading={sendRequest.isPending} disabled={!userId.trim()}>
            요청 보내기
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// FriendsList
// ---------------------------------------------------------------------------

export function FriendsList() {
  const [activeTab, setActiveTab] = useState<Tab>("friends");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const { data: friends, isLoading: friendsLoading } = useFriends();
  const { data: pending, isLoading: pendingLoading } = usePendingRequests();
  const onlineFriends = useSocialStore((s) => s.onlineFriends);

  const removeFriend = useRemoveFriend();
  const acceptRequest = useAcceptFriendRequest();
  const rejectRequest = useRejectFriendRequest();

  const filteredFriends = useMemo(() => {
    if (!friends) return [];
    if (!searchQuery.trim()) return friends;
    const q = searchQuery.toLowerCase();
    return friends.filter((f) => f.nickname.toLowerCase().includes(q));
  }, [friends, searchQuery]);

  function handleRemove(friendshipId: string) {
    setRemovingId(friendshipId);
    removeFriend.mutate(friendshipId, {
      onSuccess: () => {
        toast.success("친구가 삭제되었습니다");
        setRemovingId(null);
      },
      onError: (err) => {
        toast.error(err.message || "친구 삭제에 실패했습니다");
        setRemovingId(null);
      },
    });
  }

  function handleAccept(friendshipId: string) {
    acceptRequest.mutate(friendshipId, {
      onSuccess: () => toast.success("친구 요청을 수락했습니다"),
      onError: (err) => toast.error(err.message || "수락에 실패했습니다"),
    });
  }

  function handleReject(friendshipId: string) {
    rejectRequest.mutate(friendshipId, {
      onSuccess: () => toast.success("친구 요청을 거절했습니다"),
      onError: (err) => toast.error(err.message || "거절에 실패했습니다"),
    });
  }

  const pendingCount = pending?.length ?? 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
        <h2 className="text-lg font-bold text-slate-100">친구</h2>
        <Button
          size="sm"
          leftIcon={<UserPlus className="h-4 w-4" />}
          onClick={() => setIsAddOpen(true)}
        >
          친구 추가
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        <button
          type="button"
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "friends"
              ? "border-b-2 border-amber-500 text-amber-400"
              : "text-slate-400 hover:text-slate-200"
          }`}
          onClick={() => setActiveTab("friends")}
        >
          친구 목록
        </button>
        <button
          type="button"
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "pending"
              ? "border-b-2 border-amber-500 text-amber-400"
              : "text-slate-400 hover:text-slate-200"
          }`}
          onClick={() => setActiveTab("pending")}
        >
          <span className="inline-flex items-center gap-1.5">
            대기 중인 요청
            {pendingCount > 0 && (
              <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500 px-1 text-xs font-bold text-slate-950">
                {pendingCount}
              </span>
            )}
          </span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "friends" && (
          <div className="space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-colors focus:border-amber-500"
                placeholder="닉네임으로 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {friendsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : filteredFriends.length === 0 ? (
              <EmptyState
                icon={<Users className="h-10 w-10" />}
                title={searchQuery ? "검색 결과가 없습니다" : "아직 친구가 없습니다"}
                description={
                  searchQuery
                    ? "다른 닉네임으로 검색해 보세요"
                    : "친구를 추가하여 함께 게임을 즐겨보세요"
                }
                action={
                  !searchQuery ? (
                    <Button
                      size="sm"
                      leftIcon={<UserPlus className="h-4 w-4" />}
                      onClick={() => setIsAddOpen(true)}
                    >
                      친구 추가
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="space-y-2">
                {filteredFriends.map((friend) => (
                  <FriendRow
                    key={friend.friendship_id}
                    friend={friend}
                    isOnline={onlineFriends.has(friend.id)}
                    onRemove={handleRemove}
                    isRemoving={removingId === friend.friendship_id && removeFriend.isPending}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "pending" && (
          <div className="space-y-2">
            {pendingLoading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : !pending || pending.length === 0 ? (
              <EmptyState
                icon={<Users className="h-10 w-10" />}
                title="대기 중인 요청이 없습니다"
                description="받은 친구 요청이 여기에 표시됩니다"
              />
            ) : (
              pending.map((req) => (
                <PendingRow
                  key={req.friendship_id}
                  request={req}
                  onAccept={handleAccept}
                  onReject={handleReject}
                  isAccepting={acceptRequest.isPending}
                  isRejecting={rejectRequest.isPending}
                />
              ))
            )}
          </div>
        )}
      </div>

      <AddFriendModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
    </div>
  );
}
