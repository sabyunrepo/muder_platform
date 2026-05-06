import { FileText, Image, Music, Mic, Volume2, Video, Pause, Play, Youtube } from "lucide-react";
import type { MediaResponse, MediaType } from "@/features/editor/mediaApi";
import { extractYouTubeVideoId } from "@/features/audio/YouTubePlayer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MediaCardProps {
  media: MediaResponse;
  selected: boolean;
  onClick: () => void;
  isPreviewPlaying: boolean;
  onPreviewToggle: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds?: number): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.floor(seconds);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}

const TYPE_BADGE: Record<string, string> = {
  BGM: "bg-amber-500/20 text-amber-300",
  SFX: "bg-cyan-500/20 text-cyan-300",
  VOICE: "bg-emerald-500/20 text-emerald-300",
  VIDEO: "bg-rose-500/20 text-rose-300",
  DOCUMENT: "bg-violet-500/20 text-violet-300",
  IMAGE: "bg-teal-500/20 text-teal-300",
};

const TYPE_LABEL: Record<string, string> = {
  BGM: "BGM",
  SFX: "SFX",
  VOICE: "VOICE",
  VIDEO: "VIDEO",
  DOCUMENT: "DOCUMENT",
  IMAGE: "IMAGE",
};

function TypeIcon({ type }: { type: MediaType | "VIDEO" }) {
  switch (type) {
    case "BGM":
      return <Music className="h-6 w-6 text-amber-400" />;
    case "SFX":
      return <Volume2 className="h-6 w-6 text-cyan-400" />;
    case "VOICE":
      return <Mic className="h-6 w-6 text-emerald-400" />;
    case "VIDEO":
      return <Video className="h-6 w-6 text-rose-400" />;
    case "DOCUMENT":
      return <FileText className="h-6 w-6 text-violet-400" />;
    case "IMAGE":
      return <Image className="h-6 w-6 text-teal-400" />;
  }
}

// ---------------------------------------------------------------------------
// MediaCard
// ---------------------------------------------------------------------------

export function MediaCard({
  media,
  selected,
  onClick,
  isPreviewPlaying,
  onPreviewToggle,
}: MediaCardProps) {
  const isYouTube = media.source_type === "YOUTUBE";
  const youtubeId = isYouTube && media.url ? extractYouTubeVideoId(media.url) : null;
  const thumbnailUrl = youtubeId
    ? `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`
    : media.type === "IMAGE" && media.url
      ? media.url
    : null;
  const duration = formatDuration(media.duration);
  const badgeClass = TYPE_BADGE[media.type] ?? "bg-slate-700 text-slate-300";
  const badgeLabel = TYPE_LABEL[media.type] ?? media.type;
  const canPreview = !isYouTube && media.type !== "DOCUMENT" && media.type !== "IMAGE" && !!media.url;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      aria-pressed={selected}
      className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-sm border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950 ${
        selected
          ? "border-amber-500 bg-slate-900"
          : "border-slate-800 bg-slate-900/50 hover:border-slate-600"
      }`}
    >
      {/* Thumbnail */}
      <div className="relative flex aspect-[4/3] min-h-28 items-center justify-center bg-slate-950/60">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <TypeIcon type={media.type} />
        )}

        {/* YouTube overlay */}
        {isYouTube && (
          <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-sm bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
            <Youtube className="h-3 w-3" />
            YT
          </div>
        )}

        {/* Preview play button */}
        {canPreview && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPreviewToggle();
            }}
            aria-label={isPreviewPlaying ? "프리뷰 정지" : "프리뷰 재생"}
            className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white transition-colors hover:bg-black/90"
          >
            {isPreviewPlaying ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col gap-1.5 px-2.5 py-2">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase ${badgeClass}`}
          >
            {badgeLabel}
          </span>
          {duration && (
            <span className="text-[10px] font-mono text-slate-500">{duration}</span>
          )}
        </div>
        <p className="line-clamp-2 min-h-[2rem] text-xs font-medium leading-4 text-slate-200">
          {media.name}
        </p>
        {media.tags.length > 0 && (
          <p className="truncate text-[10px] text-slate-500">{media.tags.slice(0, 3).join(", ")}</p>
        )}
      </div>
    </div>
  );
}
