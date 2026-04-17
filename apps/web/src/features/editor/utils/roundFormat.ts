// ---------------------------------------------------------------------------
// roundFormat — shared helpers for rendering clue/location round schedules.
//
// Rounds are stored as nullable INT columns:
//   - `null` on the lower bound → visible from round 1
//   - `null` on the upper bound → stays visible forever
//
// formatRoundRange returns a short human label. When both bounds are null it
// returns null so callers can skip rendering entirely (no badge).
// ---------------------------------------------------------------------------

export function formatRoundRange(
  from: number | null | undefined,
  to: number | null | undefined,
): string | null {
  const f = from ?? null;
  const t = to ?? null;
  if (f == null && t == null) return null;
  if (f != null && t != null) {
    if (f === t) return `R${f}`;
    return `R${f}~${t}`;
  }
  if (f != null) return `R${f}~`;
  return `~R${t}`;
}
