import { useState, useMemo } from "react";
import { User, Vote } from "lucide-react";
import { WsEventType } from "@mmp/shared";
import type { Player } from "@mmp/shared";

import { Button, Badge, Card } from "@/shared/components/ui";
import { useGameStore, selectAlivePlayers, selectMyPlayerId } from "@/stores/gameStore";
import { useModuleStore } from "@/stores/moduleStoreFactory";
import { useCountUp } from "../hooks/useCountUp";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VotingResult {
  playerId: string;
  nickname: string;
  votes: number;
}

interface VotingPanelProps {
  send: (type: WsEventType, payload: unknown) => void;
  moduleId: string;
}

// ---------------------------------------------------------------------------
// 개별 투표 바 (훅은 조건부 호출 불가 → 컴포넌트 분리)
// ---------------------------------------------------------------------------

function VoteBar({
  result,
  maxVotes,
  isTop,
  staggerIndex,
}: {
  result: VotingResult;
  maxVotes: number;
  isTop: boolean;
  staggerIndex: number;
}) {
  const animatedVotes = useCountUp(result.votes);
  const widthPct = maxVotes > 0 ? (animatedVotes / maxVotes) * 100 : 0;
  const barColor = isTop ? "bg-amber-500" : "bg-slate-600";
  const delay = `${staggerIndex * 300}ms`;

  return (
    <div
      className="motion-safe:animate-fade-slide-up space-y-1"
      style={
        {
          "--stagger-index": staggerIndex,
          animationDelay: delay,
          animationFillMode: "backwards",
        } as React.CSSProperties
      }
    >
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-200">{result.nickname}</span>
        <span className="font-medium text-amber-400">{animatedVotes}표</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full ${barColor} transition-all duration-500`}
          style={{ width: `${widthPct}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 컴포넌트
// ---------------------------------------------------------------------------

export function VotingPanel({ send, moduleId }: VotingPanelProps) {
  const alivePlayers = useGameStore(selectAlivePlayers);
  const myPlayerId = useGameStore(selectMyPlayerId);
  const moduleData = useModuleStore(moduleId, (s) => s.data);

  // 투표 대상 로컬 상태
  const [votedTargetId, setVotedTargetId] = useState<string | null>(null);

  // 모듈에서 투표 결과 수신 (null이면 비밀 투표)
  const results = moduleData.results as VotingResult[] | null | undefined;
  const isSecret = results === null;
  const hasResults = Array.isArray(results) && results.length > 0;

  // 자신을 제외한 생존 플레이어 목록
  const candidates = alivePlayers.filter((p: Player) => p.id !== myPlayerId);

  // 최대 득표수 (바 너비 계산용)
  const maxVotes = hasResults
    ? Math.max(...results.map((r) => r.votes), 1)
    : 1;

  // 낮은 득표 → 높은 득표 순 정렬 (stagger: 작은 것부터 공개)
  const sortedResults = useMemo(
    () => (hasResults ? [...results].sort((a, b) => a.votes - b.votes) : []),
    [hasResults, results],
  );

  /** 투표 전송 */
  const handleVote = (targetId: string) => {
    if (votedTargetId) return; // 이미 투표함
    setVotedTargetId(targetId);
    send(WsEventType.GAME_ACTION, { type: "vote", targetId });
  };

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-2">
        <Vote className="h-5 w-5 text-amber-400" />
        <h3 className="text-lg font-semibold text-slate-100">투표</h3>
        {votedTargetId && (
          <Badge variant="success">투표 완료</Badge>
        )}
      </div>

      {/* 비밀 투표 안내 */}
      {isSecret && (
        <p className="text-sm text-slate-400">
          비밀 투표 — 결과가 공개되지 않습니다
        </p>
      )}

      {/* 투표 결과 (결과 수신 시) — 낮은 득표 → 높은 득표 순 stagger */}
      {hasResults && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-300">투표 결과</h4>
          {sortedResults.map((r, i) => (
            <VoteBar
              key={r.playerId}
              result={r}
              maxVotes={maxVotes}
              isTop={r.votes === maxVotes}
              staggerIndex={i}
            />
          ))}
        </div>
      )}

      {/* 플레이어 목록 (결과 미수신 시) */}
      {!hasResults && !isSecret && (
        <div className="space-y-2">
          {candidates.length === 0 ? (
            <p className="text-sm text-slate-400">투표 가능한 플레이어가 없습니다</p>
          ) : (
            candidates.map((player: Player) => {
              const isSelected = votedTargetId === player.id;
              return (
                <div
                  key={player.id}
                  className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                    isSelected
                      ? "border-amber-500 ring-2 ring-amber-500 bg-amber-500/10"
                      : "border-slate-700 bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700">
                      <User className="h-4 w-4 text-slate-300" />
                    </div>
                    <span className="text-sm font-medium text-slate-200">
                      {player.nickname}
                    </span>
                  </div>
                  {isSelected ? (
                    <Badge variant="success">선택됨</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!!votedTargetId}
                      onClick={() => handleVote(player.id)}
                    >
                      투표
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </Card>
  );
}
