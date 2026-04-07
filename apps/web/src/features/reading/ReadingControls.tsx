import { AudioLines, ChevronRight } from "lucide-react";
import type { ReadingLineWire, ReadingStatus } from "@/stores/readingStore";

export interface ReadingControlsProps {
  line: ReadingLineWire;
  /**
   * The current user's role **id** (NOT display name). This is the stable
   * character identifier the engine's advance permission resolver returns,
   * and matches the role token stored inside `advanceBy: "role:<id>"`. The
   * editor writes role:id, the server compares role:id, so the client must
   * also pass role:id here — do not pass the character display name.
   */
  currentUserRole: string | null;
  isHost: boolean;
  status: ReadingStatus;
  onAdvance: () => void;
}

/**
 * Renders the next-line control or status hint based on the current line's
 * advanceBy directive and the current user's role / host status.
 */
export function ReadingControls({
  line,
  currentUserRole,
  isHost,
  status,
  onAdvance,
}: ReadingControlsProps) {
  if (status === "paused") return null;

  const { advanceBy } = line;

  // ── Voice auto mode ─────────────────────────────────────────────────────
  if (advanceBy === "voice") {
    return (
      <div
        className="max-w-3xl mx-auto mt-3 flex items-center gap-2 text-xs text-slate-400"
        data-testid="reading-controls-voice"
      >
        <AudioLines className="w-3 h-3 animate-pulse" />
        재생 중...
      </div>
    );
  }

  // ── GM (host) mode ──────────────────────────────────────────────────────
  if (advanceBy === "gm") {
    if (isHost) {
      return (
        <div className="max-w-3xl mx-auto mt-3 flex justify-end">
          <button
            type="button"
            onClick={onAdvance}
            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded text-sm font-medium flex items-center gap-1"
            data-testid="reading-advance-button"
          >
            다음 <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      );
    }
    return (
      <div
        className="max-w-3xl mx-auto mt-3 text-xs text-slate-400 text-center"
        data-testid="reading-controls-waiting-host"
      >
        방장이 읽고 있습니다...
      </div>
    );
  }

  // ── Role mode ───────────────────────────────────────────────────────────
  if (advanceBy?.startsWith("role:")) {
    const requiredRole = advanceBy.slice(5);
    if (currentUserRole === requiredRole) {
      return (
        <div className="max-w-3xl mx-auto mt-3 flex justify-end">
          <button
            type="button"
            onClick={onAdvance}
            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded text-sm font-medium flex items-center gap-1"
            data-testid="reading-advance-button"
          >
            다음 <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      );
    }
    return (
      <div
        className="max-w-3xl mx-auto mt-3 text-xs text-slate-400 text-center"
        data-testid="reading-controls-waiting-role"
      >
        {requiredRole}이(가) 읽고 있습니다...
      </div>
    );
  }

  return null;
}
