import { CheckCircle2, XCircle, Trophy, Target } from "lucide-react";

import { Card } from "@/shared/components/ui";
import { useModuleStore } from "@/stores/moduleStoreFactory";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MissionResult {
  id: string;
  description: string;
  points: number;
  completed: boolean;
}

interface ScoreEntry {
  playerId: string;
  nickname: string;
  score: number;
}

// ---------------------------------------------------------------------------
// MissionResultItem — stagger 애니메이션 단위 컴포넌트
// ---------------------------------------------------------------------------

function MissionResultItem({
  mission,
  index,
}: {
  mission: MissionResult;
  index: number;
}) {
  const delay = `${index * 500}ms`;

  return (
    <div
      className="motion-safe:animate-fade-slide-up flex items-start gap-3 rounded-lg border p-3"
      style={{
        animationDelay: delay,
        animationFillMode: "backwards",
        borderColor: mission.completed
          ? "rgb(6 78 59 / 0.8)"
          : "rgb(127 29 29 / 0.8)",
        backgroundColor: mission.completed
          ? "rgb(6 78 59 / 0.15)"
          : "rgb(127 29 29 / 0.15)",
      }}
    >
      {/* 성공/실패 아이콘 */}
      <div className="mt-0.5 shrink-0">
        {mission.completed ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
        ) : (
          <XCircle className="h-5 w-5 text-red-400" />
        )}
      </div>

      {/* 설명 + 점수 */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium ${
            mission.completed ? "text-emerald-300" : "text-red-300"
          }`}
        >
          {mission.description}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          {mission.completed ? `+${mission.points}점` : "0점"}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MissionResultOverlay
// ---------------------------------------------------------------------------

export function MissionResultOverlay() {
  const moduleData = useModuleStore("hidden_mission", (s) => s.data);

  const missions = (moduleData.missions as MissionResult[] | undefined) ?? [];
  const scores = (moduleData.scores as ScoreEntry[] | undefined) ?? [];
  const scoreWinnerTitle = (moduleData.scoreWinnerTitle as string | undefined) ?? "MVP";

  const totalPoints = missions.reduce(
    (sum, m) => sum + (m.completed ? m.points : 0),
    0,
  );

  // 최고 점수 플레이어 (MVP)
  const topScorer =
    scores.length > 0
      ? scores.reduce((prev, cur) => (cur.score > prev.score ? cur : prev))
      : null;

  if (missions.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-lg space-y-6 max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center gap-2 text-center">
          <Target className="h-6 w-6 text-amber-400" />
          <h2 className="text-xl font-bold text-slate-100">비밀 임무 결과</h2>
        </div>

        {/* 미션별 결과 (순차 공개) */}
        <div className="space-y-2">
          {missions.map((mission, i) => (
            <MissionResultItem key={mission.id} mission={mission} index={i} />
          ))}
        </div>

        {/* 총점 */}
        <div className="rounded-lg border border-amber-800/50 bg-amber-900/20 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-amber-300">임무 총점</span>
            <span className="text-lg font-bold text-amber-400">{totalPoints}점</span>
          </div>
        </div>

        {/* MVP */}
        {topScorer && (
          <div
            className="motion-safe:animate-fade-slide-up flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-3"
            style={{
              animationDelay: `${missions.length * 500}ms`,
              animationFillMode: "backwards",
            }}
          >
            <Trophy className="h-6 w-6 text-amber-400 shrink-0" />
            <div>
              <p className="text-xs text-slate-400">{scoreWinnerTitle}</p>
              <p className="text-sm font-semibold text-slate-100">
                {topScorer.nickname}
              </p>
              <p className="text-xs text-amber-400">{topScorer.score}점</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
