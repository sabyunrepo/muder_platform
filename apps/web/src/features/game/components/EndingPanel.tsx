import { Trophy, Home, RefreshCcw } from "lucide-react";
import { WsEventType } from "@mmp/shared";

import { Button, Card } from "@/shared/components/ui";
import { useGameSessionStore as useGameStore } from "@/stores/gameSessionStore";
import { EndingPlayerCard } from "./EndingPlayerCard";
import { ScoreChart } from "./ScoreChart";
import type { PlayerEndingScore } from "./EndingPlayerCard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GameEndPayload {
  winnerTeam: "detective" | "culprit" | "draw";
  winnerName: string | null;
  scores: PlayerEndingScore[];
}

interface EndingPanelProps {
  send: (type: string, payload: unknown) => void;
  endPayload: GameEndPayload | null;
  onLobby: () => void;
}

// ---------------------------------------------------------------------------
// Winner banner
// ---------------------------------------------------------------------------

function WinnerBanner({ payload }: { payload: GameEndPayload }) {
  const label =
    payload.winnerTeam === "draw"
      ? "무승부"
      : payload.winnerTeam === "detective"
        ? "탐정팀 승리"
        : "범인팀 승리";

  const color =
    payload.winnerTeam === "draw"
      ? "text-slate-300"
      : payload.winnerTeam === "detective"
        ? "text-amber-400"
        : "text-red-400";

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <Trophy className={`h-10 w-10 ${color}`} />
      <h2 className={`text-2xl font-bold ${color}`}>{label}</h2>
      {payload.winnerName && (
        <p className="text-sm text-slate-400">
          MVP: <span className="font-semibold text-slate-200">{payload.winnerName}</span>
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EndingPanel
// ---------------------------------------------------------------------------

export function EndingPanel({ send, endPayload, onLobby }: EndingPanelProps) {
  const sessionId = useGameStore((s) => s.sessionId);

  const handleReplay = () => {
    send(WsEventType.GAME_ACTION, { type: "replay", sessionId });
  };

  if (!endPayload) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-slate-400">게임 결과를 기다리는 중...</p>
      </div>
    );
  }

  const { scores } = endPayload;
  const sorted = [...scores].sort((a, b) => b.score - a.score);

  return (
    <Card className="mx-auto w-full max-w-lg space-y-6">
      {/* Winner banner */}
      <WinnerBanner payload={endPayload} />

      {/* Player score cards */}
      {sorted.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-300">최종 순위</h3>
          <div className="space-y-2">
            {sorted.map((entry, i) => (
              <EndingPlayerCard
                key={entry.playerId}
                entry={entry}
                rank={i + 1}
                staggerIndex={i}
              />
            ))}
          </div>
        </div>
      )}

      {/* Clue contribution chart */}
      <ScoreChart scores={scores} />

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button
          variant="secondary"
          className="flex-1 gap-2"
          onClick={handleReplay}
        >
          <RefreshCcw className="h-4 w-4" />
          다시하기
        </Button>
        <Button
          variant="primary"
          className="flex-1 gap-2"
          onClick={onLobby}
        >
          <Home className="h-4 w-4" />
          로비로
        </Button>
      </div>
    </Card>
  );
}
