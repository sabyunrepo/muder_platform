/**
 * CutsceneModal — fullscreen modal that hosts the VideoOrchestrator's
 * cutscene player.
 *
 * The modal mounts when `activeCutscene` is non-null, delegates playback
 * to the orchestrator, and closes itself (via the `onClose` prop) when the
 * video ends or the host clicks Skip. Skip is only available when the
 * cutscene is `skippable` AND the current user is the host (GM).
 */

import { useEffect, useRef, useState } from "react";
import { SkipForward } from "lucide-react";
import type {
  BgmBehavior,
  VideoOrchestrator,
} from "./VideoOrchestrator";
import type { VideoMedia } from "./VideoPlayer";

export interface ActiveCutscene {
  media: VideoMedia;
  bgmBehavior: BgmBehavior;
  skippable: boolean;
}

export interface CutsceneModalProps {
  orchestrator: VideoOrchestrator;
  activeCutscene: ActiveCutscene | null;
  isHost: boolean;
  onClose: () => void;
}

export function CutsceneModal({
  orchestrator,
  activeCutscene,
  isHost,
  onClose,
}: CutsceneModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!activeCutscene || !containerRef.current) return;

    let cancelled = false;

    orchestrator
      .playCutscene({
        media: activeCutscene.media,
        bgmBehavior: activeCutscene.bgmBehavior,
        skippable: activeCutscene.skippable,
        container: containerRef.current,
        onEnded: () => {
          if (cancelled) return;
          setIsPlaying(false);
          onClose();
        },
      })
      .then(() => {
        if (!cancelled) setIsPlaying(true);
      })
      .catch((err) => {
        console.error("Cutscene playback failed:", err);
        if (!cancelled) onClose();
      });

    return () => {
      cancelled = true;
      // Ensure cleanup if component unmounts mid-playback
      if (orchestrator.isPlaying()) {
        orchestrator.skipCutscene();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCutscene]);

  const handleSkip = () => {
    orchestrator.skipCutscene();
    // onClose is fired via orchestrator's ended callback
  };

  if (!activeCutscene) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Cutscene"
    >
      <div ref={containerRef} className="w-full max-w-4xl aspect-video" />

      {activeCutscene.skippable && isHost && (
        <button
          type="button"
          className="absolute top-4 right-4 px-4 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-100 rounded-md text-sm font-medium flex items-center gap-2"
          onClick={handleSkip}
          aria-label="컷신 건너뛰기"
        >
          <SkipForward className="w-4 h-4" />
          건너뛰기
        </button>
      )}
    </div>
  );
}
