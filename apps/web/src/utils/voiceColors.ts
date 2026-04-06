// ---------------------------------------------------------------------------
// Shared voice participant color utilities
// ---------------------------------------------------------------------------

export const AVATAR_COLORS = [
  "#f59e0b", "#34d399", "#60a5fa", "#f87171", "#a78bfa",
  "#fb923c", "#38bdf8", "#4ade80", "#e879f9", "#facc15",
];

export function colorForIdentity(identity: string): string {
  let hash = 0;
  for (let i = 0; i < identity.length; i++) {
    hash = (hash * 31 + identity.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]!;
}
