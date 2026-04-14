import { useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle,
  XCircle,
  Users,
  Clock,
  FileText,
  Inbox,
} from "lucide-react";
import {
  Button,
  Card,
  Modal,
  EmptyState,
  Spinner,
} from "@/shared/components/ui";
import {
  usePendingReviews,
  useApproveTheme,
  useRejectTheme,
} from "@/features/admin/reviewApi";
import type { PendingTheme } from "@/features/admin/reviewApi";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// ThemeReviewCard
// ---------------------------------------------------------------------------

interface ThemeReviewCardProps {
  theme: PendingTheme;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isApproving: boolean;
}

function ThemeReviewCard({
  theme,
  onApprove,
  onReject,
  isApproving,
}: ThemeReviewCardProps) {
  return (
    <Card className="flex flex-col gap-4">
      {/* Cover image */}
      {theme.cover_image ? (
        <img
          src={theme.cover_image}
          alt={theme.title}
          className="h-36 w-full rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-36 w-full items-center justify-center rounded-lg bg-slate-800">
          <FileText className="h-10 w-10 text-slate-600" />
        </div>
      )}

      {/* Info */}
      <div className="flex-1 space-y-2">
        <h3 className="line-clamp-2 text-base font-semibold text-slate-100">
          {theme.title}
        </h3>

        {theme.description && (
          <p className="line-clamp-2 text-sm text-slate-400">
            {theme.description}
          </p>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {theme.min_players}–{theme.max_players}인
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {theme.duration_min}분
          </span>
          <span className="flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" />
            v{theme.version}
          </span>
        </div>

        <div className="text-xs text-slate-500">
          <span className="font-medium text-slate-300">{theme.creator_name}</span>
          {" · "}
          {formatDate(theme.created_at)}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="sm"
          className="flex-1"
          leftIcon={<CheckCircle className="h-4 w-4" />}
          isLoading={isApproving}
          onClick={() => onApprove(theme.id)}
        >
          승인
        </Button>
        <Button
          variant="danger"
          size="sm"
          className="flex-1"
          leftIcon={<XCircle className="h-4 w-4" />}
          onClick={() => onReject(theme.id)}
        >
          반려
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// AdminReviewPage
// ---------------------------------------------------------------------------

export default function AdminReviewPage() {
  const { data: themes, isLoading, isError, refetch } = usePendingReviews();
  const approve = useApproveTheme();
  const reject = useRejectTheme();

  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const closeRejectModal = () => {
    setRejectTarget(null);
    setRejectNote("");
  };

  const handleApprove = (themeId: string) => {
    approve.mutate(
      { themeId },
      {
        onSuccess: () => toast.success("테마가 승인되었습니다."),
        onError: (err) => toast.error(`승인 실패: ${err.message}`),
      },
    );
  };

  const handleReject = () => {
    if (!rejectTarget || !rejectNote.trim()) return;
    reject.mutate(
      { themeId: rejectTarget, note: rejectNote.trim() },
      {
        onSuccess: () => {
          toast.success("테마가 반려되었습니다.");
          closeRejectModal();
        },
        onError: (err) => toast.error(`반려 실패: ${err.message}`),
      },
    );
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">테마 심사</h1>
        <p className="mt-1 text-sm text-slate-400">
          심사 대기 중인 테마를 검토합니다
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <Card className="text-center">
          <p className="text-sm text-red-400">
            심사 목록을 불러오지 못했습니다.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => refetch()}
          >
            재시도
          </Button>
        </Card>
      )}

      {/* Content */}
      {!isLoading && !isError && (
        <>
          {themes && themes.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-12 w-12" />}
              title="심사 대기 중인 테마가 없습니다"
              description="모든 테마 심사가 완료되었습니다."
            />
          ) : (
            <>
              <p className="mb-4 text-sm text-slate-400">
                총{" "}
                <span className="font-medium text-amber-400">
                  {themes?.length ?? 0}
                </span>
                건의 테마가 심사를 기다리고 있습니다.
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {themes?.map((theme) => (
                  <ThemeReviewCard
                    key={theme.id}
                    theme={theme}
                    onApprove={handleApprove}
                    onReject={(id) => setRejectTarget(id)}
                    isApproving={approve.isPending}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Reject Modal */}
      <Modal
        isOpen={!!rejectTarget}
        onClose={closeRejectModal}
        title="테마 반려"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={closeRejectModal}>
              취소
            </Button>
            <Button
              variant="danger"
              onClick={handleReject}
              isLoading={reject.isPending}
              disabled={!rejectNote.trim()}
            >
              반려
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-400">
            반려 사유를 입력해주세요. 제작자에게 전달됩니다.
          </p>
          <textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="반려 사유를 입력하세요..."
            rows={4}
            className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>
      </Modal>
    </div>
  );
}
