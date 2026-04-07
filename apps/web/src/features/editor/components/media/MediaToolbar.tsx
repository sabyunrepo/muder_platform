import { Upload, Youtube } from "lucide-react";
import type { MediaType } from "@/features/editor/mediaApi";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MediaFilter = MediaType | "all";

export interface MediaToolbarProps {
  filter: MediaFilter;
  onFilterChange: (f: MediaFilter) => void;
  onUploadClick: () => void;
  onYouTubeClick: () => void;
}

const PILLS: Array<{ value: MediaFilter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "BGM", label: "BGM" },
  { value: "SFX", label: "효과음" },
  { value: "VOICE", label: "음성" },
  { value: "VIDEO", label: "비디오" },
];

// ---------------------------------------------------------------------------
// MediaToolbar
// ---------------------------------------------------------------------------

export function MediaToolbar({
  filter,
  onFilterChange,
  onUploadClick,
  onYouTubeClick,
}: MediaToolbarProps) {
  return (
    <div
      className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-slate-800 bg-slate-950 px-4"
      role="toolbar"
      aria-label="미디어 도구 모음"
    >
      {/* Filter pills */}
      <div className="flex items-center gap-1.5" role="group" aria-label="미디어 타입 필터">
        {PILLS.map((pill) => {
          const isActive = filter === pill.value;
          return (
            <button
              key={pill.value}
              type="button"
              onClick={() => onFilterChange(pill.value)}
              aria-pressed={isActive}
              className={`h-7 rounded-sm border px-3 text-xs font-medium transition-colors ${
                isActive
                  ? "border-amber-500 bg-amber-500/10 text-amber-300"
                  : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
              }`}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onUploadClick}
          className="flex h-7 items-center gap-1.5 rounded-sm border border-slate-700 px-3 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100"
        >
          <Upload className="h-3.5 w-3.5" />
          파일 업로드
        </button>
        <button
          type="button"
          onClick={onYouTubeClick}
          className="flex h-7 items-center gap-1.5 rounded-sm border border-slate-700 px-3 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100"
        >
          <Youtube className="h-3.5 w-3.5" />
          YouTube
        </button>
      </div>
    </div>
  );
}
