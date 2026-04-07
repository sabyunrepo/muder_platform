import { useEffect, useMemo, useState } from "react";

import { useAudioStore } from "@/stores/audioStore";
import { createAudioManager, type AudioManager } from "./AudioManager";
import { getAudioContext } from "./audioContext";
import { createAudioGraph, type AudioGraph } from "./audioGraph";
import { createBgmManager, type BgmManager } from "./BgmManager";
import { createVoiceManager, type VoiceManager } from "./VoiceManager";
import {
  createAudioOrchestrator,
  type AudioOrchestrator,
} from "./AudioOrchestrator";
import { AudioOrchestratorContext } from "./audioOrchestratorContext";
import { useGameSound } from "./hooks/useGameSound";
import { useGameMediaEvents } from "./hooks/useGameMediaEvents";

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
// Audio stack — built once on mount, disposed on unmount.
//
// NOTE on AudioManager + AudioGraph integration:
//   The legacy AudioManager (Phase 7.5 SFX) maintains its own private
//   masterGain → AudioContext.destination chain. The Phase 7.7 4-channel
//   AudioGraph adds bgm/voice/sfx channels under a separate masterGain. They
//   coexist in the same AudioContext without conflict but the SFX channel
//   gain on the new graph is currently UNUSED — AudioManager continues to
//   route through its own private chain. Refactoring AudioManager to publish
//   into graph.getGainNode("sfx") is deferred to a follow-up; doing it here
//   would balloon Phase B7's scope.
// ---------------------------------------------------------------------------

interface AudioStack {
  graph: AudioGraph;
  bgmManager: BgmManager;
  voiceManager: VoiceManager;
  audioManager: AudioManager;
  orchestrator: AudioOrchestrator;
}

function buildAudioStack(): AudioStack | null {
  let ctx: AudioContext;
  try {
    ctx = getAudioContext();
  } catch {
    // jsdom / SSR — AudioContext unavailable.
    return null;
  }

  const graph = createAudioGraph(ctx);
  const bgmManager = createBgmManager({ graph });
  const voiceManager = createVoiceManager({ graph });
  const audioManager = createAudioManager();

  const orchestrator = createAudioOrchestrator({
    graph,
    bgmManager,
    voiceManager,
    // AudioManager exposes play(soundId); orchestrator's playMedia path
    // expects playSound(url). We bridge with a thin adapter so the
    // orchestrator's optional SFX path delegates safely. For Phase B7 the
    // adapter is a no-op pass-through stub since SFX-via-orchestrator is
    // not yet exercised by any WS event in the FE.
    audioManager: {
      playSound: async () => {
        // intentional no-op — see header comment about deferred integration
      },
    },
    onBgmMediaIdChange: (id) => {
      useAudioStore.getState().setBgmMediaId(id);
    },
  });

  return { graph, bgmManager, voiceManager, audioManager, orchestrator };
}

// ---------------------------------------------------------------------------
// AudioProvider
// ---------------------------------------------------------------------------

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<AudioStack | null>(null);

  // Build stack ONCE on mount. Rely on normal useEffect cleanup for disposal.
  // StrictMode double-mount is fine: the first mount builds + disposes, then
  // the second mount builds a fresh stack. Subscribers registered in the
  // first mount are torn down before the second mount runs.
  useEffect(() => {
    const built = buildAudioStack();
    if (!built) return;
    setStack(built);

    // Sync initial volumes from store → orchestrator.
    const state = useAudioStore.getState();
    built.orchestrator.setChannelVolume(
      "master",
      state.isMuted ? 0 : state.masterVolume,
    );
    built.orchestrator.setChannelVolume("bgm", state.bgmVolume);
    built.orchestrator.setChannelVolume("voice", state.voiceVolume);
    built.orchestrator.setChannelVolume("sfx", state.sfxVolume);

    // Legacy AudioManager volume sync (kept for backward-compat with
    // useGameSound).
    built.audioManager.setVolume("master", state.isMuted ? 0 : state.masterVolume);
    built.audioManager.setVolume("sfx", state.sfxVolume);

    preloadSounds(built.audioManager);

    return () => {
      built.orchestrator.dispose();
      built.audioManager.dispose();
      try {
        built.graph.dispose();
      } catch {
        // ignore
      }
      setStack(null);
    };
  }, []);

  // ----- Volume → orchestrator subscriptions ------------------------------
  //
  // One effect subscribes to the entire audioStore; subscriber reads fresh
  // state via getState() rather than closure-captured variables. A `cancelled`
  // flag ensures we don't touch a disposed stack if the subscribe callback
  // races with unmount.
  useEffect(() => {
    if (!stack) return;
    let cancelled = false;
    const unsubscribe = useAudioStore.subscribe((state, prev) => {
      if (cancelled) return;
      if (
        state.masterVolume !== prev.masterVolume ||
        state.isMuted !== prev.isMuted
      ) {
        const effective = state.isMuted ? 0 : state.masterVolume;
        stack.orchestrator.setChannelVolume("master", effective);
        stack.audioManager.setVolume("master", effective);
      }
      if (state.bgmVolume !== prev.bgmVolume) {
        stack.orchestrator.setChannelVolume("bgm", state.bgmVolume);
      }
      if (state.voiceVolume !== prev.voiceVolume) {
        stack.orchestrator.setChannelVolume("voice", state.voiceVolume);
      }
      if (state.sfxVolume !== prev.sfxVolume) {
        stack.orchestrator.setChannelVolume("sfx", state.sfxVolume);
        stack.audioManager.setVolume("sfx", state.sfxVolume);
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [stack]);

  // ----- Game WS event subscriptions --------------------------------------

  // Legacy SFX router (sound:play).
  useGameSound(stack?.audioManager ?? null);

  // Wrap children with the orchestrator context BEFORE invoking the media
  // events hook so the hook reads the current orchestrator value.
  const contextValue = useMemo(
    () => ({ orchestrator: stack?.orchestrator ?? null }),
    [stack],
  );

  return (
    <AudioOrchestratorContext.Provider value={contextValue}>
      <AudioMediaEventsBridge />
      {children}
    </AudioOrchestratorContext.Provider>
  );
}

// Internal child component so useGameMediaEvents executes inside the context
// provider scope.
function AudioMediaEventsBridge(): null {
  useGameMediaEvents();
  return null;
}
