import { useEffect, useState } from "react";
import {
  FileAudio,
  Film,
  Mic,
  Music,
  Search,
  Sparkles,
  X,
  Youtube,
} from "lucide-react";

import {
  useMediaList,
  type MediaResponse,
  type MediaType,
} from "@/features/editor/mediaApi";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MediaPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (media: MediaResponse) => void;
  themeId: string;
  /** When set, only media of this type are queried/listed. */
  filterType?: MediaType;
  /** Highlight currently selected media id. */
  selectedId?: string | null;
  /** Optional dialog title (defaults to "미디어 선택"). */
  title?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}

function MediaTypeIcon({ type }: { type: MediaType }) {
  switch (type) {
    case "BGM":
      return <Music className="h-5 w-5 text-amber-400" />;
    case "SFX":
      return <Sparkles className="h-5 w-5 text-cyan-400" />;
    case "VOICE":
      return <Mic className="h-5 w-5 text-emerald-400" />;
    case "VIDEO":
      return <Film className="h-5 w-5 text-rose-400" />;
    default:
      return <FileAudio className="h-5 w-5 text-slate-400" />;
  }
}

const TYPE_LABEL: Record<MediaType, string> = {
  BGM: "배경음악",
  SFX: "효과음",
  VOICE: "음성",
  VIDEO: "비디오",
};

// ---------------------------------------------------------------------------
// MediaPicker
// ---------------------------------------------------------------------------

export function MediaPicker({
  open,
  onClose,
  onSelect,
  themeId,
  filterType,
  selectedId,
  title,
}: MediaPickerProps) {
  const { data: media = [], isLoading } = useMediaList(themeId, filterType);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!open) setSearchQuery("");
  }, [open]);

  if (!open) return null;

  const query = searchQuery.trim().toLowerCase();
  const filtered = query
    ? media.filter((m) => m.name.toLowerCase().includes(query))
    : media;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title || "미디어 선택"}
    >
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg bg-slate-800 p-6">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">
            {title || "미디어 선택"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            className="w-full rounded border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-100 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900"
            placeholder="이름으로 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="미디어 이름 검색"
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div
              className="py-8 text-center text-sm text-slate-400"
              role="status"
            >
              불러오는 중...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              {query ? "검색 결과가 없습니다" : "미디어가 없습니다"}
            </div>
          ) : (
            <ul className="space-y-1">
              {filtered.map((m) => {
                const isSelected = selectedId === m.id;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(m);
                        onClose();
                      }}
                      aria-pressed={isSelected}
                      className={`flex w-full items-center gap-3 rounded border p-3 text-left transition-colors ${
                        isSelected
                          ? "border-amber-500/40 bg-amber-500/20"
                          : "border-transparent bg-slate-900 hover:bg-slate-700"
                      }`}
                    >
                      <MediaTypeIcon type={m.type} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-200">
                          {m.name}
                        </p>
                        {m.duration ? (
                          <p className="text-xs text-slate-400">
                            {formatDuration(m.duration)}
                          </p>
                        ) : null}
                      </div>
                      {m.source_type === "YOUTUBE" && (
                        <Youtube
                          className="h-4 w-4 text-rose-500"
                          aria-label="YouTube"
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer hint */}
        {filterType && (
          <p className="mt-3 text-xs text-slate-500">
            {TYPE_LABEL[filterType]} 유형만 표시됩니다
          </p>
        )}
      </div>
    </div>
  );
}
