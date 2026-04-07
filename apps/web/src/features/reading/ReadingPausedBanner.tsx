import { AlertCircle } from "lucide-react";

export interface ReadingPausedBannerProps {
  reason: string | null;
}

export function ReadingPausedBanner({ reason }: ReadingPausedBannerProps) {
  const message =
    reason === "player_left" ? "플레이어가 이탈했습니다" : "일시 정지됨";
  return (
    <div
      className="pointer-events-auto bg-rose-900/90 backdrop-blur border-t border-rose-700 p-2 text-center text-sm text-rose-100"
      data-testid="reading-paused-banner"
    >
      <AlertCircle className="w-4 h-4 inline mr-1" />
      {message} — 재접속을 기다리는 중...
    </div>
  );
}
