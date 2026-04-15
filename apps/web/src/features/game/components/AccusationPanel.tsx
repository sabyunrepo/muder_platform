import { useState } from "react";
import { Gavel, ShieldAlert } from "lucide-react";
import { WsEventType } from "@mmp/shared";
import type { Player } from "@mmp/shared";

import { Button, Badge, Card, Select } from "@/shared/components/ui";
import { useGameSessionStore as useGameStore } from "@/stores/gameSessionStore";
import { selectAlivePlayers, selectMyPlayerId } from "@/stores/gameSelectors";
import { useModuleStore } from "@/stores/moduleStoreFactory";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DefenseMessage {
  playerId: string;
  nickname: string;
  message: string;
}

interface AccusationResult {
  success: boolean;
  targetNickname: string;
}

interface AccusationPanelProps {
  send: (type: WsEventType, payload: unknown) => void;
  moduleId: string;
}

// ---------------------------------------------------------------------------
// 컴포넌트
// ---------------------------------------------------------------------------

export function AccusationPanel({ send, moduleId }: AccusationPanelProps) {
  const alivePlayers = useGameStore(selectAlivePlayers);
  const myPlayerId = useGameStore(selectMyPlayerId);
  const moduleData = useModuleStore(moduleId, (s) => s.data);

  // 로컬 상태
  const [targetId, setTargetId] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  // 모듈 데이터에서 변호/결과 수신
  const defense = moduleData.defense as DefenseMessage | null | undefined;
  const result = moduleData.result as AccusationResult | null | undefined;

  // 자신 제외 생존 플레이어
  const candidates = alivePlayers.filter((p: Player) => p.id !== myPlayerId);
  const selectOptions = candidates.map((p: Player) => ({
    value: p.id,
    label: p.nickname,
  }));

  /** 고발 전송 */
  const handleAccuse = () => {
    if (!targetId || !reason.trim()) return;
    setIsSubmitted(true);
    send(WsEventType.GAME_ACTION, { type: "accuse", targetId, reason: reason.trim() });
  };

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-2">
        <Gavel className="h-5 w-5 text-amber-400" />
        <h3 className="text-lg font-semibold text-slate-100">고발</h3>
      </div>

      {/* 결과 표시 */}
      {result && (
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 text-center">
          {result.success ? (
            <Badge variant="success" size="md">범인 적중</Badge>
          ) : (
            <Badge variant="danger" size="md">고발 실패</Badge>
          )}
          <p className="mt-2 text-sm text-slate-300">
            대상: {result.targetNickname}
          </p>
        </div>
      )}

      {/* 변호 메시지 표시 */}
      {defense && (
        <Card className="border-slate-600 bg-slate-800/80">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium text-blue-400">변호</span>
          </div>
          <p className="text-sm text-slate-300">
            <span className="font-medium text-slate-200">{defense.nickname}:</span>{" "}
            {defense.message}
          </p>
        </Card>
      )}

      {/* 고발 폼 */}
      {!isSubmitted && !result && (
        <div className="space-y-3">
          <Select
            label="고발 대상"
            options={selectOptions}
            placeholder="플레이어 선택..."
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="accuse-reason" className="text-sm font-medium text-slate-300">
              고발 이유
            </label>
            <textarea
              id="accuse-reason"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-colors focus:border-amber-500 resize-none"
              rows={3}
              placeholder="이 플레이어가 범인이라고 생각하는 이유를 작성하세요..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <Button
            variant="primary"
            onClick={handleAccuse}
            disabled={!targetId || !reason.trim()}
            className="w-full"
          >
            고발
          </Button>
        </div>
      )}

      {/* 제출 완료 (결과 대기) */}
      {isSubmitted && !result && (
        <p className="text-center text-sm text-slate-400">
          고발이 접수되었습니다. 결과를 기다리는 중...
        </p>
      )}
    </Card>
  );
}
