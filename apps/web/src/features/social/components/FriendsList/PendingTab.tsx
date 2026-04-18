import { Users } from "lucide-react";
import { EmptyState, Spinner } from "@/shared/components/ui";
import type { PendingRequestResponse } from "@/features/social/api";
import { PendingRow } from "./PendingRow";

interface PendingTabProps {
  pending: PendingRequestResponse[] | undefined;
  pendingLoading: boolean;
  onAccept: (friendshipId: string) => void;
  onReject: (friendshipId: string) => void;
  isAccepting: boolean;
  isRejecting: boolean;
}

export function PendingTab({
  pending,
  pendingLoading,
  onAccept,
  onReject,
  isAccepting,
  isRejecting,
}: PendingTabProps) {
  return (
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
            onAccept={onAccept}
            onReject={onReject}
            isAccepting={isAccepting}
            isRejecting={isRejecting}
          />
        ))
      )}
    </div>
  );
}
