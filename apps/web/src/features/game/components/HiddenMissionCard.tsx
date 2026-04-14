import { CheckCircle2, Circle, Target } from "lucide-react";
import { WsEventType } from "@mmp/shared";

import { Button, Card, Badge } from "@/shared/components/ui";
import { useModuleStore } from "@/stores/moduleStoreFactory";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Mission {
  id: string;
  type: "hold_clue" | "vote_target" | "transfer_clue" | "survive" | "custom";
  description: string;
  points: number;
  verification: "auto" | "self_report" | "gm_verify";
  targetClueId?: string;
  completed: boolean;
}

interface HiddenMissionCardProps {
  send?: (type: WsEventType, payload: unknown) => void;
}

// ---------------------------------------------------------------------------
// 개별 미션 행 컴포넌트
// ---------------------------------------------------------------------------

function MissionRow({
  mission,
  onReport,
}: {
  mission: Mission;
  onReport?: (missionId: string) => void;
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
        mission.completed
          ? "border-emerald-800 bg-emerald-900/20"
          : "border-slate-700 bg-slate-800/50"
      }`}
    >
      {/* 완료 아이콘 */}
      <div className="mt-0.5 shrink-0">
        {mission.completed ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
        ) : (
          <Circle className="h-5 w-5 text-slate-500" />
        )}
      </div>

      {/* 미션 설명 + 점수 */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm ${
            mission.completed ? "text-emerald-300 line-through" : "text-slate-200"
          }`}
        >
          {mission.description}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <Badge variant={mission.completed ? "success" : "default"}>
            {mission.points}점
          </Badge>
          {!mission.completed && (
            <span className="text-xs text-slate-500">진행 중</span>
          )}
        </div>
      </div>

      {/* 자기보고 버튼 */}
      {mission.verification === "self_report" && !mission.completed && onReport && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onReport(mission.id)}
          className="shrink-0"
        >
          완료 보고
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// HiddenMissionCard
// ---------------------------------------------------------------------------

export function HiddenMissionCard({ send }: HiddenMissionCardProps) {
  const moduleData = useModuleStore("hidden_mission", (s) => s.data);

  const missions = (moduleData.missions as Mission[] | undefined) ?? [];
  const totalPoints = missions.reduce(
    (sum, m) => sum + (m.completed ? m.points : 0),
    0,
  );
  const completedCount = missions.filter((m) => m.completed).length;

  /** 자기보고 전송 */
  const handleReport = (missionId: string) => {
    if (!send) return;
    send(WsEventType.GAME_ACTION, { type: "mission:report", missionId });
  };

  return (
    <Card className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-amber-400" />
          <h3 className="text-lg font-semibold text-slate-100">비밀 임무</h3>
        </div>
        {missions.length > 0 && (
          <span className="text-sm text-slate-400">
            {completedCount}/{missions.length} 완료
          </span>
        )}
      </div>

      {/* 획득 점수 */}
      {missions.length > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-slate-800/80 px-3 py-2">
          <span className="text-sm text-slate-400">획득 점수</span>
          <span className="text-sm font-semibold text-amber-400">{totalPoints}점</span>
        </div>
      )}

      {/* 미션 목록 */}
      {missions.length === 0 ? (
        <p className="text-center text-sm text-slate-500 py-4">
          배정된 임무가 없습니다
        </p>
      ) : (
        <div className="space-y-2">
          {missions.map((mission) => (
            <MissionRow
              key={mission.id}
              mission={mission}
              onReport={send ? handleReport : undefined}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
