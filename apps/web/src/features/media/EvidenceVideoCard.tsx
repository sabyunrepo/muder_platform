/**
 * EvidenceVideoCard — inline video card for evidence panels.
 *
 * Hosts an independent VideoPlayer instance per card. Unlike CutsceneModal,
 * this component:
 *  - Does NOT use VideoOrchestrator (independent of the cutscene lifecycle)
 *  - Does NOT touch BGM (no handleCutsceneStart wiring)
 *  - Does NOT block UI — renders inline as a card inside the evidence panel
 *  - Supports repeat playback via an explicit "다시 재생" button
 *  - Mounts/unmounts freely as evidence panels render
 */

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { createVideoPlayer } from "./createVideoPlayer";
import type { VideoMedia, VideoPlayer } from "./VideoPlayer";

export interface EvidenceVideoCardProps {
  media: VideoMedia;
  title?: string;
  className?: string;
}

export function EvidenceVideoCard({
  media,
  title,
  className,
}: EvidenceVideoCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<VideoPlayer | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const player = createVideoPlayer(media.sourceType);
    playerRef.current = player;
    player.attachTo(containerRef.current);

    const unsubReady = player.onReady(() => setIsReady(true));
    const unsubEnded = player.onEnded(() => {
      setIsPlaying(false);
      setHasEnded(true);
    });

    let cancelled = false;
    player.load(media).catch((err) => {
      console.error("Evidence video load failed:", err);
      if (!cancelled) setIsReady(false);
    });

    return () => {
      cancelled = true;
      unsubReady();
      unsubEnded();
      player.destroy();
      playerRef.current = null;
      setIsReady(false);
      setIsPlaying(false);
      setHasEnded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.id, media.sourceType, media.videoId, media.url]);

  const handlePlay = async () => {
    if (!playerRef.current) return;
    setHasEnded(false);
    try {
      await playerRef.current.play();
      setIsPlaying(true);
    } catch (err) {
      console.error("Evidence video play failed:", err);
    }
  };

  const handlePause = () => {
    playerRef.current?.pause();
    setIsPlaying(false);
  };

  const handleReplay = async () => {
    if (!playerRef.current) return;
    playerRef.current.stop();
    await handlePlay();
  };

  const displayTitle = title || media.title;

  return (
    <div
      className={`bg-slate-800 rounded-lg overflow-hidden border border-slate-700 ${
        className || ""
      }`}
      role="article"
    >
      {displayTitle && (
        <div className="px-3 py-2 border-b border-slate-700 text-sm font-medium text-slate-200">
          {displayTitle}
        </div>
      )}
      <div ref={containerRef} className="aspect-video bg-black" />
      <div className="px-3 py-2 flex items-center gap-2">
        {!isPlaying && !hasEnded && (
          <button
            type="button"
            onClick={handlePlay}
            disabled={!isReady}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded text-sm font-medium flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-3 h-3" /> 재생
          </button>
        )}
        {isPlaying && (
          <button
            type="button"
            onClick={handlePause}
            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded text-sm font-medium flex items-center gap-1"
          >
            <Pause className="w-3 h-3" /> 일시정지
          </button>
        )}
        {hasEnded && (
          <button
            type="button"
            onClick={handleReplay}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded text-sm font-medium flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> 다시 재생
          </button>
        )}
      </div>
    </div>
  );
}
