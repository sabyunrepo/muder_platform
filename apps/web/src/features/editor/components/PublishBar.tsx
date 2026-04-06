import { toast } from "sonner";
import { Send, EyeOff } from "lucide-react";
import { Button } from "@/shared/components/ui";
import { usePublishTheme, useUnpublishTheme } from "@/features/editor/api";
import type { EditorThemeResponse } from "@/features/editor/api";
import { STATUS_LABEL, STATUS_COLOR } from "@/features/editor/constants";

interface PublishBarProps {
  theme: EditorThemeResponse;
}

export function PublishBar({ theme }: PublishBarProps) {
  const publish = usePublishTheme(theme.id);
  const unpublish = useUnpublishTheme(theme.id);

  function handlePublish() {
    publish.mutate(undefined, {
      onSuccess: () => toast.success("테마가 출판되었습니다"),
      onError: (err) => toast.error(err.message || "출판에 실패했습니다"),
    });
  }

  function handleUnpublish() {
    unpublish.mutate(undefined, {
      onSuccess: () => toast.success("테마가 비공개로 전환되었습니다"),
      onError: (err) => toast.error(err.message || "비공개 전환에 실패했습니다"),
    });
  }

  return (
    <div className="mb-6 flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900 px-5 py-3">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-slate-100">{theme.title}</h2>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[theme.status]}`}>
          {STATUS_LABEL[theme.status]}
        </span>
        <span className="text-xs text-slate-500">v{theme.version}</span>
      </div>

      <div className="flex items-center gap-2">
        {theme.status === "DRAFT" && (
          <Button
            size="sm"
            leftIcon={<Send className="h-3.5 w-3.5" />}
            isLoading={publish.isPending}
            onClick={handlePublish}
          >
            출판하기
          </Button>
        )}
        {theme.status === "PUBLISHED" && (
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<EyeOff className="h-3.5 w-3.5" />}
            isLoading={unpublish.isPending}
            onClick={handleUnpublish}
          >
            비공개로 전환
          </Button>
        )}
      </div>
    </div>
  );
}
