import { User, CheckCircle } from 'lucide-react';
import type { Player } from '@mmp/shared';
import { playerDisplayName } from '../utils/resultBreakdownAdapter';

import { Button, Badge } from '@/shared/components/ui';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VoteOptionListProps {
  candidates: Player[];
  votedTargetId: string | null;
  onVote: (targetId: string) => void;
  emptyMessage?: string;
}

// ---------------------------------------------------------------------------
// 컴포넌트
// ---------------------------------------------------------------------------

export function VoteOptionList({
  candidates,
  votedTargetId,
  onVote,
  emptyMessage = '투표 가능한 플레이어가 없습니다',
}: VoteOptionListProps) {
  if (candidates.length === 0) {
    return <p className="text-sm text-slate-400">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-2">
      {candidates.map((player) => {
        const isSelected = votedTargetId === player.id;
        return (
          <div
            key={player.id}
            className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
              isSelected
                ? 'border-amber-500 ring-2 ring-amber-500 bg-amber-500/10'
                : 'border-slate-700 bg-slate-800/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700">
                <User className="h-4 w-4 text-slate-300" />
              </div>
              <span className="text-sm font-medium text-slate-200">
                {playerDisplayName(player)}
              </span>
            </div>
            {isSelected ? (
              <Badge variant="success">
                <CheckCircle className="h-3 w-3 mr-1 inline" />
                선택됨
              </Badge>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                disabled={!!votedTargetId}
                onClick={() => onVote(player.id)}
              >
                투표
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
