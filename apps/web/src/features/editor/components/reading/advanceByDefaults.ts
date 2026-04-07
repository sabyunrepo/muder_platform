import type { ReadingLineDTO } from "../../readingApi";

/**
 * computeSmartAdvanceBy returns a sensible default `AdvanceBy` for a reading
 * line based on its current state. Order of preference:
 *
 *   1. Voice clip attached → "voice" (engine advances when audio finishes)
 *   2. Narration speaker   → "gm"    (GM presses next)
 *   3. Character speaker   → "role:<speaker>" (assigned player advances)
 *   4. Empty fallback      → "gm"
 */
export function computeSmartAdvanceBy(
  line: Partial<ReadingLineDTO>,
  isNarration: boolean,
): string {
  if (line.VoiceMediaID) return "voice";
  if (isNarration) return "gm";
  if (line.Speaker && line.Speaker !== "나레이션") {
    return `role:${line.Speaker}`;
  }
  return "gm";
}
