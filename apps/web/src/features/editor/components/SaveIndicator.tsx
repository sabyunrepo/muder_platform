import { useEffect, useState } from "react";
import type { SaveStatus } from "@/features/editor/hooks/useAutoSave";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SaveIndicatorProps {
  status: SaveStatus;
  lastSaved?: Date | null;
  onRetry?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(date: Date): string {
  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// SaveIndicator
// ---------------------------------------------------------------------------

export function SaveIndicator({ status, lastSaved, onRetry }: SaveIndicatorProps) {
  const [visible, setVisible] = useState(true);

  // Fade out after 2s when saved
  useEffect(() => {
    if (status === "saved") {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 2000);
      return () => clearTimeout(t);
    } else {
      setVisible(true);
    }
  }, [status]);

  if (status === "idle") return null;
  if (status === "saved" && !visible) return null;

  return (
    <div
      className={`flex items-center gap-1.5 text-xs transition-opacity ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {status === "dirty" && (
        <>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
          <span className="text-amber-400">변경사항 있음</span>
        </>
      )}

      {status === "saving" && (
        <>
          <span className="h-3.5 w-3.5 animate-spin rounded-full border border-slate-400 border-t-transparent" />
          <span className="text-slate-400">저장 중...</span>
        </>
      )}

      {status === "saved" && (
        <>
          <span className="text-emerald-500">✓</span>
          <span className="text-slate-500">
            저장됨{lastSaved ? ` ${formatTime(lastSaved)}` : ""}
          </span>
        </>
      )}

      {status === "error" && (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 transition-colors hover:bg-red-950"
        >
          <span className="text-red-400">✗</span>
          <span className="text-red-400">저장 실패 — 재시도</span>
        </button>
      )}
    </div>
  );
}
