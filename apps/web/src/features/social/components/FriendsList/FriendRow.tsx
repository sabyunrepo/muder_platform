import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button, Modal, Badge } from "@/shared/components/ui";
import type { FriendResponse } from "@/features/social/api";
import { getNicknameColor } from "@/shared/utils/nickname";

interface FriendRowProps {
  friend: FriendResponse;
  isOnline: boolean;
  onRemove: (friendshipId: string) => void;
  isRemoving: boolean;
}

export function FriendRow({ friend, isOnline, onRemove, isRemoving }: FriendRowProps) {
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
