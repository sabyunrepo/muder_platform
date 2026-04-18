import { UserPlus, Search, Users } from "lucide-react";
import { Button, EmptyState, Spinner } from "@/shared/components/ui";
import type { FriendResponse } from "@/features/social/api";
import { FriendRow } from "./FriendRow";

interface FriendsTabProps {
  friends: FriendResponse[];
  friendsLoading: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onlineFriends: Set<string>;
  onRemove: (friendshipId: string) => void;
  removingId: string | null;
  isRemoving: boolean;
  onOpenAdd: () => void;
}

export function FriendsTab({
  friends,
  friendsLoading,
  searchQuery,
  onSearchChange,
  onlineFriends,
  onRemove,
  removingId,
  isRemoving,
  onOpenAdd,
}: FriendsTabProps) {
  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 transition-colors focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900"
          placeholder="닉네임으로 검색..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {friendsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : friends.length === 0 ? (
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
                onClick={onOpenAdd}
              >
                친구 추가
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          {friends.map((friend) => (
            <FriendRow
              key={friend.friendship_id}
              friend={friend}
              isOnline={onlineFriends.has(friend.id)}
              onRemove={onRemove}
              isRemoving={removingId === friend.friendship_id && isRemoving}
            />
          ))}
        </div>
      )}
    </div>
  );
}
