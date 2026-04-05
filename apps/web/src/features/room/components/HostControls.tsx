import { Play, XCircle } from "lucide-react";
import { Button } from "@/shared/components/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HostControlsProps {
  /** 현재 유저가 호스트인지 */
  isHost: boolean;
  /** 전원 레디 여부 (호스트 제외) */
  allReady: boolean;
  /** 최소 인원 충족 여부 */
  hasMinPlayers: boolean;
  /** 게임 시작 핸들러 */
  onStartGame: () => void;
  /** 방 닫기 핸들러 */
  onCloseRoom: () => void;
  /** 로딩 상태 */
  isStarting?: boolean;
}

// ---------------------------------------------------------------------------
// HostControls
// ---------------------------------------------------------------------------

export function HostControls({
  isHost,
  allReady,
  hasMinPlayers,
  onStartGame,
  onCloseRoom,
  isStarting = false,
}: HostControlsProps) {
  // 호스트가 아니면 렌더링하지 않음
  if (!isHost) return null;

  const canStart = allReady && hasMinPlayers;

  return (
    <div className="flex flex-col gap-2 pt-2">
      <Button
        variant="primary"
        size="lg"
        leftIcon={<Play className="h-5 w-5" />}
        disabled={!canStart}
        isLoading={isStarting}
        onClick={onStartGame}
        className="w-full"
      >
        게임 시작
      </Button>

      {!canStart && (
        <p className="text-center text-xs text-slate-500">
          {!hasMinPlayers
            ? "최소 인원이 충족되지 않았습니다."
            : "모든 참가자가 준비해야 시작할 수 있습니다."}
        </p>
      )}

      <Button
        variant="danger"
        size="sm"
        leftIcon={<XCircle className="h-4 w-4" />}
        onClick={onCloseRoom}
        className="w-full"
      >
        방 닫기
      </Button>
    </div>
  );
}
