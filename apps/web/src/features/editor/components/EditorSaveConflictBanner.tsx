import { ClipboardCopy, RefreshCcw, X } from "lucide-react";

interface EditorSaveConflictBannerProps {
  scopeLabel: string;
  onReload: () => void;
  onPreserve: () => void;
  onDismiss: () => void;
}

export function EditorSaveConflictBanner({
  scopeLabel,
  onReload,
  onPreserve,
  onDismiss,
}: EditorSaveConflictBannerProps) {
  return (
    <section
      role="alert"
      aria-label={`${scopeLabel} 저장 충돌`}
      className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-50"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="font-semibold">{scopeLabel} 저장 충돌이 발생했습니다</p>
          <p className="text-xs leading-5 text-amber-100/80">
            다른 탭이나 사용자가 더 최신 내용을 저장했습니다. 내 변경을 복사해 둔 뒤 최신 상태를
            불러오면 덮어쓰기 위험을 줄일 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          aria-label="충돌 안내 닫기"
          onClick={onDismiss}
          className="self-start rounded-lg p-1.5 text-amber-100/80 transition hover:bg-amber-500/20 hover:text-amber-50"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onReload}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-amber-200 px-3 text-xs font-semibold text-slate-950 transition hover:bg-amber-100"
        >
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          최신 상태 다시 불러오기
        </button>
        <button
          type="button"
          onClick={onPreserve}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-amber-300/50 px-3 text-xs font-semibold text-amber-50 transition hover:bg-amber-500/20"
        >
          <ClipboardCopy className="h-4 w-4" aria-hidden="true" />
          내 변경 복사
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex min-h-10 items-center rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
        >
          취소
        </button>
      </div>
    </section>
  );
}
