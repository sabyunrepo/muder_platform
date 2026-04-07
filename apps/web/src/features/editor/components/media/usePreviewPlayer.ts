import { useEffect, useRef, useState } from "react";

/**
 * usePreviewPlayer — single shared HTMLAudioElement for in-list preview.
 *
 * Toggling card A while card B is playing stops B. Audio is torn down on
 * unmount.
 */
export function usePreviewPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    const audio = new Audio();
    const handleEnded = () => setPlayingId(null);
    audio.addEventListener("ended", handleEnded);
    audioRef.current = audio;
    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  const toggle = (id: string, url: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playingId === id) {
      audio.pause();
      setPlayingId(null);
      return;
    }
    audio.src = url;
    audio
      .play()
      .then(() => setPlayingId(id))
      .catch(() => setPlayingId(null));
  };

  const stop = () => {
    audioRef.current?.pause();
    setPlayingId(null);
  };

  return { playingId, toggle, stop };
}
