import { Check, X } from "lucide-react";
import { Button } from "@/shared/components/ui";
import type { PendingRequestResponse } from "@/features/social/api";
import { getNicknameColor } from "@/shared/utils/nickname";

interface PendingRowProps {
  request: PendingRequestResponse;
  onAccept: (friendshipId: string) => void;
  onReject: (friendshipId: string) => void;
  isAccepting: boolean;
  isRejecting: boolean;
}

export function PendingRow({
  request,
  onAccept,
  onReject,
  isAccepting,
  isRejecting,
}: PendingRowProps) {
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
