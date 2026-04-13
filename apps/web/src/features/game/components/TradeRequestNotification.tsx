import { useEffect } from "react";
import { ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { WsEventType } from "@mmp/shared";

import { useModuleStore } from "@/stores/moduleStoreFactory";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IncomingTrade {
  tradeId: string;
  fromPlayerId: string;
  fromPlayerName: string;
  clueId: string;
  clueName: string;
}

interface TradeRequestNotificationProps {
  send: (type: WsEventType, payload: unknown) => void;
}

// ---------------------------------------------------------------------------
// 컴포넌트
// ---------------------------------------------------------------------------

/**
 * trade_clue 모듈의 trade:incoming 이벤트를 감지하여
 * sonner toast로 교환 요청 알림을 표시한다.
 * 렌더링 결과가 없는 순수 효과 컴포넌트.
 */
export function TradeRequestNotification({ send }: TradeRequestNotificationProps) {
  const tradeData = useModuleStore("trade_clue", (s) => s.data);

  useEffect(() => {
    const incoming = tradeData.lastEvent_incoming as IncomingTrade | undefined;
    if (!incoming) return;

    function handleAccept() {
      send(WsEventType.GAME_ACTION, { type: "trade:accept", tradeId: incoming!.tradeId });
      toast.dismiss(`trade-${incoming!.tradeId}`);
    }

    function handleReject() {
      send(WsEventType.GAME_ACTION, { type: "trade:reject", tradeId: incoming!.tradeId });
      toast.dismiss(`trade-${incoming!.tradeId}`);
    }

    toast(
      <TradeRequestToast
        fromPlayerName={incoming.fromPlayerName}
        clueName={incoming.clueName}
        onAccept={handleAccept}
        onReject={handleReject}
      />,
      {
        id: `trade-${incoming.tradeId}`,
        duration: 30000,
        icon: <ArrowLeftRight className="h-4 w-4 text-amber-400" />,
      },
    );
  }, [tradeData.lastEvent_incoming, send]);

  return null;
}

// ---------------------------------------------------------------------------
// Toast 내용 컴포넌트
// ---------------------------------------------------------------------------

interface TradeRequestToastProps {
  fromPlayerName: string;
  clueName: string;
  onAccept: () => void;
  onReject: () => void;
}

function TradeRequestToast({
  fromPlayerName,
  clueName,
  onAccept,
  onReject,
}: TradeRequestToastProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-100">단서 교환 요청</p>
      <p className="text-xs text-slate-400">
        <span className="font-medium text-slate-200">{fromPlayerName}</span>님이{" "}
        <span className="font-medium text-amber-400">{clueName}</span> 단서 교환을 요청했습니다
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onAccept}
          className="flex-1 rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-emerald-500"
        >
          수락
        </button>
        <button
          type="button"
          onClick={onReject}
          className="flex-1 rounded-md bg-red-700 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-red-600"
        >
          거절
        </button>
      </div>
    </div>
  );
}
