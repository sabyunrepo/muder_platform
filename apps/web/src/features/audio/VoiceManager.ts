import type { AudioGraph } from "./audioGraph";

// ---------------------------------------------------------------------------
// VoiceManager — sequential voice clip player
//
//   audio: HTMLAudioElement → MediaElementSource → graph.voice
//
// Plays short voice clips one after another from a FIFO queue. When a clip
// finishes (natural end OR error), all onEnded subscribers are notified with
// the completed clip's id, and the next queued clip starts automatically.
//
// A single HTMLAudioElement is reused for all clips (only its `src` is
// reassigned between plays) — MediaElementSource cannot be re-bound to a
// different element after creation.
// ---------------------------------------------------------------------------

export interface VoiceClip {
  id: string;
  url: string;
}

export interface VoiceManagerOptions {
  graph: AudioGraph;
}

export interface VoiceManager {
  enqueue(clip: VoiceClip): void;
  stopAll(): void;
  onEnded(cb: (voiceId: string) => void): () => void;
  getCurrentVoiceId(): string | null;
  dispose(): void;
}

export function createVoiceManager(opts: VoiceManagerOptions): VoiceManager {
  const { graph } = opts;
  const ctx = graph.ctx;
  const voiceChannel = graph.getGainNode("voice");

  const audio = new Audio();
  audio.crossOrigin = "anonymous";
  audio.preload = "auto";

  const source = ctx.createMediaElementSource(audio);
  source.connect(voiceChannel);

  const queue: VoiceClip[] = [];
  const subscribers = new Set<(voiceId: string) => void>();
  let currentVoiceId: string | null = null;
  let disposed = false;

  function notifyEnded(voiceId: string): void {
    // Snapshot to avoid mutation-during-iteration if a callback unsubscribes.
    for (const cb of [...subscribers]) {
      try {
        cb(voiceId);
      } catch (err) {
        if (import.meta.env?.DEV) {
          console.warn("[VoiceManager] onEnded subscriber threw:", err);
        }
      }
    }
  }

  function startClip(clip: VoiceClip): void {
    currentVoiceId = clip.id;
    audio.src = clip.url;
    audio.currentTime = 0;
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    void audio.play().catch((err) => {
      if (import.meta.env?.DEV) {
        console.warn(`[VoiceManager] Failed to play "${clip.id}":`, err);
      }
      // play() rejection — treat the same as an error event so we don't stall.
      handleClipFinished(clip.id, /*advance*/ true);
    });
  }

  function handleClipFinished(voiceId: string, advance: boolean): void {
    if (disposed) return;
    // Guard against stale events firing after stopAll() reset state.
    if (currentVoiceId !== voiceId) return;

    notifyEnded(voiceId);
    currentVoiceId = null;

    if (!advance) return;
    const next = queue.shift();
    if (next) {
      startClip(next);
    }
  }

  function onEndedEvent(): void {
    const id = currentVoiceId;
    if (id === null) return;
    handleClipFinished(id, true);
  }

  function onErrorEvent(): void {
    const id = currentVoiceId;
    if (id === null) return;
    handleClipFinished(id, true);
  }

  audio.addEventListener("ended", onEndedEvent);
  audio.addEventListener("error", onErrorEvent);

  function enqueue(clip: VoiceClip): void {
    if (disposed) return;
    if (currentVoiceId === null) {
      startClip(clip);
    } else {
      queue.push(clip);
    }
  }

  function stopAll(): void {
    if (disposed) return;
    queue.length = 0;
    if (currentVoiceId !== null) {
      try {
        audio.pause();
      } catch {
        // ignore
      }
      audio.src = "";
      currentVoiceId = null;
    }
  }

  function onEnded(cb: (voiceId: string) => void): () => void {
    subscribers.add(cb);
    return () => {
      subscribers.delete(cb);
    };
  }

  function getCurrentVoiceId(): string | null {
    return currentVoiceId;
  }

  function dispose(): void {
    if (disposed) return;
    stopAll();
    disposed = true;
    audio.removeEventListener("ended", onEndedEvent);
    audio.removeEventListener("error", onErrorEvent);
    try {
      source.disconnect();
    } catch {
      // ignore
    }
    subscribers.clear();
  }

  return { enqueue, stopAll, onEnded, getCurrentVoiceId, dispose };
}
