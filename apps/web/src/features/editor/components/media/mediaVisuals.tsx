import { FileAudio, FileText, Film, Image, Mic, Music, Sparkles, Volume2 } from "lucide-react";

import { extractYouTubeVideoId } from "@/features/audio/YouTubePlayer";
import type { MediaResponse, MediaType } from "@/features/editor/mediaApi";

const TYPE_BADGE: Record<MediaType, string> = {
  BGM: "bg-amber-500/20 text-amber-300",
  SFX: "bg-cyan-500/20 text-cyan-300",
  VOICE: "bg-emerald-500/20 text-emerald-300",
  VIDEO: "bg-rose-500/20 text-rose-300",
  DOCUMENT: "bg-violet-500/20 text-violet-300",
  IMAGE: "bg-teal-500/20 text-teal-300",
};

const TYPE_LABEL: Record<MediaType, string> = {
  BGM: "배경음악",
  SFX: "효과음",
  VOICE: "음성",
  VIDEO: "영상",
  DOCUMENT: "문서",
  IMAGE: "이미지",
};

export function getMediaTypeBadgeClass(type: MediaType): string {
  return TYPE_BADGE[type] ?? "bg-slate-700 text-slate-300";
}

export function getMediaTypeBadgeLabel(type: MediaType): string {
  return TYPE_LABEL[type] ?? type;
}

export function getMediaThumbnailUrl(media: Pick<MediaResponse, "source_type" | "type" | "url">): string | null {
  if (media.source_type === "YOUTUBE" && media.url) {
    const youtubeId = extractYouTubeVideoId(media.url);
    return youtubeId ? `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg` : null;
  }
  if (media.type === "IMAGE" && media.url) return media.url;
  return null;
}

export function canPlayInlinePreview(media: Pick<MediaResponse, "source_type" | "type" | "url">): boolean {
  return (
    media.source_type === "FILE" &&
    Boolean(media.url) &&
    (media.type === "BGM" || media.type === "SFX" || media.type === "VOICE")
  );
}

export function MediaTypeIcon({ type, size = "md" }: { type: MediaType; size?: "sm" | "md" }) {
  const className = size === "sm" ? "h-5 w-5" : "h-6 w-6";
  switch (type) {
    case "BGM":
      return <Music className={`${className} text-amber-400`} aria-label="배경음악" />;
    case "SFX":
      return <Volume2 className={`${className} text-cyan-400`} aria-label="효과음" />;
    case "VOICE":
      return <Mic className={`${className} text-emerald-400`} aria-label="음성" />;
    case "VIDEO":
      return <Film className={`${className} text-rose-400`} aria-label="영상" />;
    case "DOCUMENT":
      return <FileText className={`${className} text-violet-400`} aria-label="문서" />;
    case "IMAGE":
      return <Image className={`${className} text-teal-400`} aria-label="이미지" />;
    default:
      return <FileAudio className={`${className} text-slate-400`} aria-label="미디어" />;
  }
}
