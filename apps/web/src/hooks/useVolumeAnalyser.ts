import { useEffect, useRef, useState } from "react";
import {
  createAudioAnalyser,
  LocalAudioTrack,
  RemoteAudioTrack,
  RemoteParticipant,
  Track,
  LocalParticipant,
} from "livekit-client";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FRAME_INTERVAL_MS = 66; // ~15fps
const SPEAKING_THRESHOLD = 0.05;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VolumeMap {
  volumes: Map<string, number>;
  speaking: Set<string>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapsEqual(a: Map<string, number>, b: Map<string, number>): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) {
    if (b.get(k) !== v) return false;
  }
  return true;
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) {
    if (!b.has(v)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Analyses audio volume for all participants.
 * Returns a Map<participantIdentity, volume 0..1> and a Set of speaking identities.
 */
export function useVolumeAnalyser(
  localParticipant: LocalParticipant | null,
  remoteParticipants: RemoteParticipant[],
): VolumeMap {
  const [result, setResult] = useState<VolumeMap>({
    volumes: new Map(),
    speaking: new Set(),
  });

  // Cleanup registry: identity → cleanup fn
  const cleanupRef = useRef<Map<string, () => void>>(new Map());
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  // calculateVolume functions per participant
  const calculatorsRef = useRef<Map<string, () => number>>(new Map());

  // Previous frame values for change detection
  const prevVolumesRef = useRef<Map<string, number>>(new Map());
  const prevSpeakingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const prevCleanups = cleanupRef.current;
    const newCleanups = new Map<string, () => void>();
    const newCalculators = new Map<string, () => number>();

    const allParticipants: Array<LocalParticipant | RemoteParticipant> = [
      ...(localParticipant ? [localParticipant] : []),
      ...remoteParticipants,
    ];

    for (const participant of allParticipants) {
      const identity = participant.identity;

      const pub = participant.getTrackPublication(Track.Source.Microphone);
      const audioTrack = pub?.audioTrack;

      if (
        audioTrack &&
        (audioTrack instanceof LocalAudioTrack ||
          audioTrack instanceof RemoteAudioTrack)
      ) {
        if (prevCleanups.has(identity)) {
          // Reuse existing analyser if participant already registered
          const existingCalc = calculatorsRef.current.get(identity);
          if (existingCalc) {
            newCalculators.set(identity, existingCalc);
            newCleanups.set(identity, prevCleanups.get(identity)!);
            prevCleanups.delete(identity);
            continue;
          }
        }

        const { calculateVolume, cleanup } = createAudioAnalyser(audioTrack, {
          fftSize: 256,
          smoothingTimeConstant: 0.8,
        });

        newCalculators.set(identity, calculateVolume);
        newCleanups.set(identity, () => void cleanup());
      }
    }

    // Cleanup removed participants
    for (const [, cleanupFn] of prevCleanups) {
      cleanupFn();
    }

    cleanupRef.current = newCleanups;
    calculatorsRef.current = newCalculators;

    // Tick loop
    const tick = (now: number) => {
      rafRef.current = requestAnimationFrame(tick);

      if (now - lastTickRef.current < FRAME_INTERVAL_MS) return;
      lastTickRef.current = now;

      const volumes = new Map<string, number>();
      const speaking = new Set<string>();

      for (const [identity, calc] of calculatorsRef.current) {
        const vol = calc();
        volumes.set(identity, vol);
        if (vol > SPEAKING_THRESHOLD) {
          speaking.add(identity);
        }
      }

      if (
        !mapsEqual(volumes, prevVolumesRef.current) ||
        !setsEqual(speaking, prevSpeakingRef.current)
      ) {
        prevVolumesRef.current = volumes;
        prevSpeakingRef.current = speaking;
        setResult({ volumes, speaking });
      }
    };

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [localParticipant, remoteParticipants]);

  // Final cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      for (const [, cleanupFn] of cleanupRef.current) {
        cleanupFn();
      }
      cleanupRef.current.clear();
      calculatorsRef.current.clear();
    };
  }, []);

  return result;
}
