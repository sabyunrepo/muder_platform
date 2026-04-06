const NICKNAME_COLORS = [
  "text-amber-400",
  "text-emerald-400",
  "text-sky-400",
  "text-rose-400",
  "text-violet-400",
  "text-teal-400",
  "text-orange-400",
  "text-pink-400",
] as const;

export function hashNickname(nickname: string): number {
  let hash = 0;
  for (let i = 0; i < nickname.length; i++) {
    hash = (hash * 31 + nickname.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getNicknameColor(nickname: string): string {
  return NICKNAME_COLORS[hashNickname(nickname) % NICKNAME_COLORS.length]!;
}
