import type { ReadingLineDTO } from "../../readingApi";

/**
 * Minimal character reference shape needed to map a speaker display name to
 * the stable id the engine's advanceBy permission resolver expects.
 */
export interface CharacterRef {
  id: string;
  name: string;
}

/**
 * computeSmartAdvanceBy returns a sensible default `AdvanceBy` for a reading
 * line based on its current state. Order of preference:
 *
 *   1. Voice clip attached → "voice" (engine advances when audio finishes)
 *   2. Narration speaker   → "gm"    (GM presses next)
 *   3. Character speaker   → "role:<character.id>" (assigned player advances)
 *   4. Unknown speaker     → "gm"    (fall back to GM — role:<name> mismatch
 *                                     would break permission checks, since
 *                                     the engine compares stable IDs)
 *
 * The `characters` argument is the list of all characters defined on the
 * theme; we look up the speaker by display name to find the canonical id.
 * When no characters list is supplied (legacy callers), a role:name string
 * is still returned so that behavior is preserved for tests that don't know
 * about the id mapping — however, production callers MUST pass the list.
 */
export function computeSmartAdvanceBy(
  line: Partial<ReadingLineDTO>,
  isNarration: boolean,
  characters?: readonly CharacterRef[],
): string {
  if (line.VoiceMediaID) return "voice";
  if (isNarration) return "gm";
  const speaker = line.Speaker;
  if (speaker && speaker !== "나레이션") {
    if (characters && characters.length > 0) {
      const match = characters.find((c) => c.name === speaker);
      if (match) return `role:${match.id}`;
      // Unknown speaker: fall back to gm so the line is still advanceable
      // rather than stuck on a role id no player holds.
      return "gm";
    }
    // Legacy no-characters path: preserve old shape for non-migrated
    // callers. New code must pass the characters list.
    return `role:${speaker}`;
  }
  return "gm";
}
