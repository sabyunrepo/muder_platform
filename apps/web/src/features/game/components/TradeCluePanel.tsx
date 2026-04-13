import { useState, useEffect } from "react";
import { ArrowLeftRight, Clock, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { WsEventType } from "@mmp/shared";

import { Card, Badge, EmptyState, Button } from "@/shared/components/ui";
import { useModuleStore } from "@/stores/moduleStoreFactory";
import type { Player } from "@packages/shared/src/game/types";
import type { ClueWithItem } from "./CluePanel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TradeRecord {
  tradeId: string;
  status: "pending" | "accepted" | "rejected" | "completed";
  targetPlayerId?: string;
  targetPlayerName?: string;
  clueId?: string;
  clueName?: string;
  receivedClueName?: string;
}

interface TradeCluePanelProps {
  send: (type: WsEventType, payload: unknown) => void;
}

// ---------------------------------------------------------------------------
// 컴포넌트
// ---------------------------------------------------------------------------

export function TradeCluePanel({ send }: TradeCluePanelProps) {
  const tradeData = useModuleStore("trade_clue", (s) => s.data);
  const clueData = useModuleStore("clue_interaction", (s) => s.data);

  const clues = (clueData.clues as ClueWithItem[] | undefined) ?? [];
  const players = (clueData.players as Player[] | undefined) ?? [];

  // 진행 중인 교환 목록 (로컬 추적)
  const [trades, setTrades] = useState<TradeRecord[]>([]);

  // 선택 상태
  const [selectedClueId, setSelectedClueId] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  // WS 이벤트 감지
  useEffect(() => {
    const accepted = tradeData.lastEvent_accepted as { tradeId: string } | undefined;
    if (!accepted) return;
    setTrades((prev) =>
      prev.map((t) =>
        t.tradeId === accepted.tradeId ? { ...t, status: "accepted" } : t,
      ),
    );
    toast.success("교환 요청이 수락되었습니다");
  }, [tradeData.lastEvent_accepted]);

  useEffect(() => {
    const rejected = tradeData.lastEvent_rejected as { tradeId: string } | undefined;
    if (!rejected) return;
    setTrades((prev) =>
      prev.map((t) =>
        t.tradeId === rejected.tradeId ? { ...t, status: "rejected" } : t,
      ),
    );
    toast.error("교환 요청이 거절되었습니다");
  }, [tradeData.lastEvent_rejected]);

  useEffect(() => {
    const completed = tradeData.lastEvent_completed as
      | { tradeId: string; receivedClueId: string; receivedClueName: string }
      | undefined;
    if (!completed) return;
    setTrades((prev) =>
      prev.map((t) =>
        t.tradeId === completed.tradeId
          ? { ...t, status: "completed", receivedClueName: completed.receivedClueName }
          : t,
      ),
    );
    toast.success(`교환 완료! "${completed.receivedClueName}" 단서를 받았습니다`);
  }, [tradeData.lastEvent_completed]);

  function handleRequestTrade() {
    if (!selectedClueId || !selectedPlayerId) return;

    const clue = clues.find((c) => c.id === selectedClueId);
    const player = players.find((p) => p.id === selectedPlayerId);
    if (!clue || !player) return;

    send(WsEventType.GAME_ACTION, {
      type: "trade:request",
      targetPlayerId: selectedPlayerId,
      clueId: selectedClueId,
    });

    // 로컬 pending 기록 (tradeId는 서버에서 부여되므로 임시 ID 사용)
    const tempId = `local-${Date.now()}`;
    setTrades((prev) => [
      ...prev,
      {
        tradeId: tempId,
        status: "pending",
        targetPlayerId: selectedPlayerId,
        targetPlayerName: player.nickname,
        clueId: selectedClueId,
        clueName: clue.title,
      },
    ]);

    setSelectedClueId(null);
    setSelectedPlayerId(null);
    toast.info(`${player.nickname}에게 교환 요청을 보냈습니다`);
  }

  if (clues.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<ArrowLeftRight className="h-10 w-10" />}
          title="교환할 단서가 없습니다"
          description="단서를 발견하면 다른 플레이어와 교환할 수 있습니다"
        />
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-100">단서 교환</h3>

      {/* 단서 선택 */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-400">교환할 단서 선택</p>
        <div className="space-y-1">
          {clues.map((clue) => (
            <button
              key={clue.id}
              type="button"
              onClick={() => setSelectedClueId(clue.id)}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                selectedClueId === clue.id
                  ? "border-amber-500 bg-amber-900/30 text-amber-300"
                  : "border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-600 hover:bg-slate-700"
              }`}
            >
              {clue.title}
            </button>
          ))}
        </div>
      </div>

      {/* 대상 플레이어 선택 */}
      {players.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-400">대상 플레이어 선택</p>
          <div className="flex flex-wrap gap-2">
            {players.map((player) => (
              <button
                key={player.id}
                type="button"
                onClick={() => setSelectedPlayerId(player.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  selectedPlayerId === player.id
                    ? "border-amber-500 bg-amber-900/30 text-amber-300"
                    : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600 hover:bg-slate-700"
                }`}
              >
                {player.nickname}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 교환 요청 버튼 */}
      <Button
        variant="primary"
        onClick={handleRequestTrade}
        disabled={!selectedClueId || !selectedPlayerId}
        className="w-full"
      >
        <ArrowLeftRight className="mr-2 h-4 w-4" />
        교환 요청
      </Button>

      {/* 진행 중인 교환 */}
      {trades.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-400">교환 내역</p>
          <div className="space-y-2">
            {trades.map((trade) => (
              <div
                key={trade.tradeId}
                className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs text-slate-300">
                    {trade.clueName} → {trade.targetPlayerName}
                  </p>
                  {trade.receivedClueName && (
                    <p className="truncate text-xs text-amber-400">
                      받은 단서: {trade.receivedClueName}
                    </p>
                  )}
                </div>
                <TradeStatusBadge status={trade.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 교환 상태 배지
// ---------------------------------------------------------------------------

function TradeStatusBadge({ status }: { status: TradeRecord["status"] }) {
  switch (status) {
    case "pending":
      return (
        <Badge variant="default" className="shrink-0">
          <Clock className="mr-1 h-3 w-3" />
          대기 중
        </Badge>
      );
    case "accepted":
      return (
        <Badge variant="success" className="shrink-0">
          <CheckCircle className="mr-1 h-3 w-3" />
          수락됨
        </Badge>
      );
    case "rejected":
      return (
        <Badge variant="danger" className="shrink-0">
          <XCircle className="mr-1 h-3 w-3" />
          거절됨
        </Badge>
      );
    case "completed":
      return (
        <Badge variant="info" className="shrink-0">
          <CheckCircle className="mr-1 h-3 w-3" />
          완료
        </Badge>
      );
  }
}
