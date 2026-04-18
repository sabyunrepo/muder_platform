import { useState, useMemo } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui";
import {
  useFriends,
  usePendingRequests,
  useAcceptFriendRequest,
  useRejectFriendRequest,
  useRemoveFriend,
} from "@/features/social/api";
import { useSocialStore } from "@/stores/socialStore";
import { FriendsTab } from "./FriendsTab";
import { PendingTab } from "./PendingTab";
import { AddFriendModal } from "./AddFriendModal";
import { TabSwitcher } from "./TabSwitcher";
import type { FriendsListTab } from "./TabSwitcher";

// ---------------------------------------------------------------------------
// FriendsList — 친구 목록/대기 요청 탭을 묶는 컨테이너. 상태·뮤테이션을 소유하고
// 렌더링은 탭별 서브컴포넌트에 위임한다.
// ---------------------------------------------------------------------------

export function FriendsList() {
  const [activeTab, setActiveTab] = useState<FriendsListTab>("friends");
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

      <TabSwitcher activeTab={activeTab} onChange={setActiveTab} pendingCount={pendingCount} />

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "friends" && (
          <FriendsTab
            friends={filteredFriends}
            friendsLoading={friendsLoading}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onlineFriends={onlineFriends}
            onRemove={handleRemove}
            removingId={removingId}
            isRemoving={removeFriend.isPending}
            onOpenAdd={() => setIsAddOpen(true)}
          />
        )}

        {activeTab === "pending" && (
          <PendingTab
            pending={pending}
            pendingLoading={pendingLoading}
            onAccept={handleAccept}
            onReject={handleReject}
            isAccepting={acceptRequest.isPending}
            isRejecting={rejectRequest.isPending}
          />
        )}
      </div>

      <AddFriendModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
    </div>
  );
}
