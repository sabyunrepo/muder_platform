import { useEffect, useState } from "react";
import { Pause, Play, Youtube } from "lucide-react";
import { editorDesignClassNames } from "@/features/editor/design-system/editorDesignTokens";
import { useMediaDownloadUrl, type MediaResponse } from "@/features/editor/mediaApi";
import {
  canPlayInlinePreview,
  getMediaThumbnailUrl,
  getMediaTypeBadgeClass,
  getMediaTypeBadgeLabel,
  MediaTypeIcon,
} from "./mediaVisuals";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MediaCardProps {
  media: MediaResponse;
  selected: boolean;
  onClick: () => void;
  isPreviewPlaying: boolean;
  onPreviewToggle: () => void;
  selectionMode?: boolean;
  checked?: boolean;
  onCheckedChange?: () => void;
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

function getPreviewSurfaceClass(type: MediaResponse["type"]): string {
  switch (type) {
    case "BGM":
      return "border-amber-500/25 bg-amber-500/10 text-amber-200";
    case "SFX":
      return "border-cyan-500/25 bg-cyan-500/10 text-cyan-200";
    case "VOICE":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-200";
    case "VIDEO":
      return "border-rose-500/25 bg-rose-500/10 text-rose-200";
    case "DOCUMENT":
      return "border-violet-500/25 bg-violet-500/10 text-violet-200";
    case "IMAGE":
      return "border-teal-500/25 bg-teal-500/10 text-teal-700";
    default:
      return "border-[var(--mmp-editor-color-hairline-strong)] bg-[var(--mmp-editor-color-surface)] text-[var(--mmp-editor-color-slate)]";
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
  selectionMode = false,
  checked = false,
  onCheckedChange,
}: MediaCardProps) {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const isYouTube = media.source_type === "YOUTUBE";
  const shouldLoadFileImagePreview =
    media.type === "IMAGE" && media.source_type === "FILE" && !media.url;
  const { data: fileImagePreview } = useMediaDownloadUrl(
    shouldLoadFileImagePreview ? media.id : undefined,
  );
  const thumbnailUrl = getMediaThumbnailUrl({
    ...media,
    url: media.url ?? fileImagePreview?.url,
  });
  const shouldRenderImagePreview = media.type === "IMAGE" && thumbnailUrl && !thumbnailFailed;
  const duration = formatDuration(media.duration);
  const badgeClass = getMediaTypeBadgeClass(media.type);
  const badgeLabel = getMediaTypeBadgeLabel(media.type);
  const canPreview = canPlayInlinePreview(media);

  useEffect(() => {
    setThumbnailFailed(false);
  }, [thumbnailUrl]);

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
      aria-pressed={selectionMode ? checked : selected}
      className={`group relative flex cursor-pointer flex-col overflow-hidden text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mmp-editor-color-primary)] ${
        selected
          ? `${editorDesignClassNames.listItem} ${editorDesignClassNames.listItemActive}`
          : editorDesignClassNames.listItem
      }`}
    >
      {selectionMode && (
        <div className="absolute left-2 top-2 z-10 rounded-sm bg-[var(--mmp-editor-color-canvas)] p-1 shadow-[var(--mmp-editor-shadow-card)]">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => {
              event.stopPropagation();
              onCheckedChange?.();
            }}
            onClick={(event) => event.stopPropagation()}
            aria-label={`${media.name} 선택`}
            className="h-4 w-4 rounded-sm border-[var(--mmp-editor-color-hairline-strong)] bg-[var(--mmp-editor-color-canvas)] text-[var(--mmp-editor-color-primary)] focus:ring-[var(--mmp-editor-color-primary)]"
          />
        </div>
      )}

      {/* Thumbnail */}
      <div className="relative mx-auto mt-2 flex aspect-square w-24 items-center justify-center rounded-md bg-[var(--mmp-editor-color-surface-soft)] p-2 sm:w-28">
        {shouldRenderImagePreview ? (
          <img
            src={thumbnailUrl}
            alt=""
            className="h-full w-full object-contain"
            loading="lazy"
            onError={() => setThumbnailFailed(true)}
          />
        ) : (
          <div
            data-testid="media-preview-face"
            className={`flex h-full w-full flex-col items-center justify-center gap-1 rounded-sm border ${getPreviewSurfaceClass(
              media.type,
            )}`}
          >
            <MediaTypeIcon type={media.type} />
            <span className="text-[10px] font-semibold">{badgeLabel}</span>
          </div>
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
            className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--mmp-editor-color-charcoal)] text-white transition-colors hover:bg-[var(--mmp-editor-color-ink)]"
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
            <span className="text-[10px] font-mono text-[var(--mmp-editor-color-steel)]">{duration}</span>
          )}
        </div>
        <p className="line-clamp-2 min-h-[2rem] text-xs font-medium leading-4 text-[var(--mmp-editor-color-charcoal)]">
          {media.name}
        </p>
        {media.tags.length > 0 && (
          <p className="truncate text-[10px] text-[var(--mmp-editor-color-slate)]">{media.tags.slice(0, 3).join(", ")}</p>
        )}
      </div>
    </div>
  );
}
