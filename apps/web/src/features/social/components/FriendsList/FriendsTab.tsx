import { UserPlus, Search, Users } from "lucide-react";
import { Button, EmptyState, Input, Spinner } from "@/shared/components/ui";
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
      <div>
        <Input
          leftIcon={<Search className="h-4 w-4" />}
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
