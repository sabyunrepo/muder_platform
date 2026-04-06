import { useEffect, useRef, useState } from "react";

import { useAudioStore } from "@/stores/audioStore";
import { createAudioManager, type AudioManager } from "./AudioManager";
import { useGameSound } from "./hooks/useGameSound";

// ---------------------------------------------------------------------------
// Preload sounds (common SFX)
// ---------------------------------------------------------------------------

const PRELOAD_IDS = ["phase_change", "vote_result", "timer_warning"] as const;

function preloadSounds(manager: AudioManager): void {
  const conn = (navigator as Navigator & { connection?: { effectiveType?: string } })
    .connection;
  if (conn?.effectiveType === "2g" || conn?.effectiveType === "slow-2g") {
    return;
  }

  const idle = typeof requestIdleCallback === "function" ? requestIdleCallback : setTimeout;
  idle(() => {
    for (const id of PRELOAD_IDS) {
      void manager.preload(id);
    }
  });
}

// ---------------------------------------------------------------------------
// AudioProvider
// ---------------------------------------------------------------------------

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const managerRef = useRef<AudioManager | null>(null);
  const [manager, setManager] = useState<AudioManager | null>(null);

  // Create manager on mount
  useEffect(() => {
    const m = createAudioManager();
    managerRef.current = m;
    setManager(m);

    // Sync initial volume from store
    const state = useAudioStore.getState();
    m.setVolume("master", state.masterVolume);
    m.setVolume("sfx", state.sfxVolume);

    preloadSounds(m);

    return () => {
      m.dispose();
      managerRef.current = null;
      setManager(null);
    };
  }, []);

  // Subscribe to audioStore volume changes → sync to manager
  useEffect(() => {
    const unsub = useAudioStore.subscribe((state) => {
      const m = managerRef.current;
      if (!m) return;
      m.setVolume("master", state.isMuted ? 0 : state.masterVolume);
      m.setVolume("sfx", state.sfxVolume);
    });
    return unsub;
  }, []);

  // WS event subscription — manager state triggers re-render so hook gets non-null
  useGameSound(manager);

  return <>{children}</>;
}
