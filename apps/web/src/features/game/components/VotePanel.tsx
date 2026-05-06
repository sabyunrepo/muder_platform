import { useState } from 'react';
import { Vote, Lock, Users } from 'lucide-react';
import { WsEventType } from '@mmp/shared';

import { Badge, Card } from '@/shared/components/ui';
import { useGameSessionStore as useGameStore } from '@/stores/gameSessionStore';
import { selectMyPlayerId, selectPlayers } from '@/stores/gameSelectors';
import { useModuleStore } from '@/stores/moduleStoreFactory';
import { VoteOptionList } from './VoteOptionList';
import { VoteResultChart } from './VoteResultChart';
import type { VoteResult } from './VoteResultChart';
import {
  countExcludedDetectives,
  filterVotingCandidates,
  readVotingCandidatePolicy,
} from '../utils/votingCandidates';
import { playerDisplayNameById } from '../utils/resultBreakdownAdapter';

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
  const players = useGameStore(selectPlayers);
  const myPlayerId = useGameStore(selectMyPlayerId);
  const moduleData = useModuleStore(moduleId, (s) => s.data);

  const [votedTargetId, setVotedTargetId] = useState<string | null>(null);

  // 모듈 데이터: results === null → 비밀 투표, Array → 공개 결과
  const results = moduleData.results as VoteResult[] | null | undefined;
  const isSecret = results === null;
  const hasResults = Array.isArray(results) && results.length > 0;
  const displayResults = hasResults
    ? results.map((result) => ({
        ...result,
        nickname: playerDisplayNameById(players, result.playerId, result.nickname),
      }))
    : [];

  const candidatePolicy = readVotingCandidatePolicy(moduleData);
  const candidates = filterVotingCandidates(players, myPlayerId, candidatePolicy);
  const excludedDetectiveCount = countExcludedDetectives(players, myPlayerId, candidatePolicy);
  const emptyMessage =
    excludedDetectiveCount > 0
      ? '탐정 제외 정책 때문에 투표 가능한 플레이어가 없습니다'
      : '투표 가능한 플레이어가 없습니다';

  const handleVote = (targetId: string) => {
    if (votedTargetId) return;
    setVotedTargetId(targetId);
    send(WsEventType.GAME_ACTION, { type: 'vote', targetId });
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
      {hasResults && <VoteResultChart results={displayResults} />}

      {/* 투표 대상 목록 (결과 미수신 & 비밀 투표 아닐 때) */}
      {!hasResults && !isSecret && (
        <div className="space-y-2">
          {excludedDetectiveCount > 0 && (
            <p className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-400">
              탐정 {excludedDetectiveCount}명은 이번 투표 후보에서 제외됩니다.
            </p>
          )}
          <VoteOptionList
            candidates={candidates}
            votedTargetId={votedTargetId}
            onVote={handleVote}
            emptyMessage={emptyMessage}
          />
        </div>
      )}
    </Card>
  );
}
