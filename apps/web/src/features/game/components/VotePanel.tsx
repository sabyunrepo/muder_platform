import { useState } from "react";
import { Vote, Lock, Users } from "lucide-react";
import { WsEventType } from "@mmp/shared";
import type { Player } from "@mmp/shared";

import { Badge, Card } from "@/shared/components/ui";
import { useGameSessionStore as useGameStore } from "@/stores/gameSessionStore";
import { selectAlivePlayers, selectMyPlayerId } from "@/stores/gameSelectors";
import { useModuleStore } from "@/stores/moduleStoreFactory";
import { VoteOptionList } from "./VoteOptionList";
import { VoteResultChart } from "./VoteResultChart";
import type { VoteResult } from "./VoteResultChart";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VotePanelProps {
  send: (type: WsEventType, payload: unknown) => void;
  moduleId: string;
}

// ---------------------------------------------------------------------------
// 컴포넌트
// ---------------------------------------------------------------------------

export function VotePanel({ send, moduleId }: VotePanelProps) {
  const alivePlayers = useGameStore(selectAlivePlayers);
  const myPlayerId = useGameStore(selectMyPlayerId);
  const moduleData = useModuleStore(moduleId, (s) => s.data);

  const [votedTargetId, setVotedTargetId] = useState<string | null>(null);

  // 모듈 데이터: results === null → 비밀 투표, Array → 공개 결과
  const results = moduleData.results as VoteResult[] | null | undefined;
  const isSecret = results === null;
  const hasResults = Array.isArray(results) && results.length > 0;

  const candidates = alivePlayers.filter((p: Player) => p.id !== myPlayerId);

  const handleVote = (targetId: string) => {
    if (votedTargetId) return;
    setVotedTargetId(targetId);
    send(WsEventType.GAME_ACTION, { type: "vote", targetId });
  };

  return (
    <Card className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <Vote className="h-5 w-5 text-amber-400" />
        <h3 className="text-lg font-semibold text-slate-100">투표</h3>
        <div className="ml-auto flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-400" />
          <span className="text-sm text-slate-400">{candidates.length}명</span>
          {votedTargetId && <Badge variant="success">투표 완료</Badge>}
        </div>
      </div>

      {/* 비밀 투표 안내 */}
      {isSecret && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 p-3">
          <Lock className="h-4 w-4 text-slate-400" />
          <p className="text-sm text-slate-400">비밀 투표 — 결과가 공개되지 않습니다</p>
        </div>
      )}

      {/* 투표 결과 */}
      {hasResults && <VoteResultChart results={results!} />}

      {/* 투표 대상 목록 (결과 미수신 & 비밀 투표 아닐 때) */}
      {!hasResults && !isSecret && (
        <VoteOptionList
          candidates={candidates}
          votedTargetId={votedTargetId}
          onVote={handleVote}
        />
      )}
    </Card>
  );
}
