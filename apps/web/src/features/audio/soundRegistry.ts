// ---------------------------------------------------------------------------
// Sound ID → asset URL mapping
// ---------------------------------------------------------------------------

export const SOUND_MAP = {
  phase_change: "/assets/sounds/phase-change.mp3",
  vote_result: "/assets/sounds/vote-result.mp3",
  timer_warning: "/assets/sounds/timer-warning.mp3",
  reveal_start: "/assets/sounds/reveal-start.mp3",
  reveal_result: "/assets/sounds/reveal-result.mp3",
  player_join: "/assets/sounds/player-join.mp3",
  player_leave: "/assets/sounds/player-leave.mp3",
} as const;

export type SoundId = keyof typeof SOUND_MAP;

/** Resolve a soundId string to its asset URL. Returns null for unknown IDs. */
export function resolveSoundUrl(id: string): string | null {
  return (SOUND_MAP as Record<string, string>)[id] ?? null;
}
