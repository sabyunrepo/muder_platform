import { Send, EyeOff, AlertTriangle, Clock, Ban } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui";
import { useSubmitForReview, useUnpublishTheme } from "@/features/editor/api";
import type { EditorThemeResponse } from "@/features/editor/api";
import { STATUS_LABEL, STATUS_COLOR } from "@/features/editor/constants";

interface PublishBarProps {
  theme: EditorThemeResponse;
}

export function PublishBar({ theme }: PublishBarProps) {
  const submit = useSubmitForReview(theme.id);
  const unpublish = useUnpublishTheme(theme.id);

  function handleSubmit() {
    submit.mutate(undefined, {
      onSuccess: () => toast.success("심사가 요청되었습니다"),
      onError: (err) => toast.error(err.message || "심사 요청에 실패했습니다"),
    });
  }

  function handleUnpublish() {
    unpublish.mutate(undefined, {
      onSuccess: () => toast.success("비공개로 전환되었습니다"),
      onError: (err) => toast.error(err.message || "비공개 전환에 실패했습니다"),
    });
  }

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-900 px-5 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-100">{theme.title}</h2>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[theme.status]}`}
          >
            {STATUS_LABEL[theme.status]}
          </span>
          <span className="text-xs text-slate-500">v{theme.version}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* DRAFT or REJECTED: can submit for review */}
          {(theme.status === "DRAFT" || theme.status === "REJECTED") && (
            <Button
              size="sm"
              leftIcon={<Send className="h-3.5 w-3.5" />}
              onClick={handleSubmit}
              isLoading={submit.isPending}
            >
              심사 요청
            </Button>
          )}

          {/* PENDING_REVIEW: waiting */}
          {theme.status === "PENDING_REVIEW" && (
            <span className="flex items-center gap-1.5 text-xs text-amber-400">
              <Clock className="h-3.5 w-3.5" />
              심사 대기 중
            </span>
          )}

          {/* PUBLISHED: can unpublish */}
          {theme.status === "PUBLISHED" && (
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<EyeOff className="h-3.5 w-3.5" />}
              onClick={handleUnpublish}
              isLoading={unpublish.isPending}
            >
              비공개 전환
            </Button>
          )}

          {/* SUSPENDED: admin suspended */}
          {theme.status === "SUSPENDED" && (
            <span className="flex items-center gap-1.5 text-xs text-red-400">
              <Ban className="h-3.5 w-3.5" />
              관리자에 의해 정지됨
            </span>
          )}
        </div>
      </div>

      {/* REJECTED: show rejection reason */}
      {theme.status === "REJECTED" && theme.review_note && (
        <div className="flex items-start gap-2 rounded-lg border border-red-800 bg-red-950/50 px-3 py-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <div>
            <p className="text-xs font-medium text-red-300">반려 사유</p>
            <p className="text-xs text-red-400">{theme.review_note}</p>
          </div>
        </div>
      )}
    </div>
  );
}
