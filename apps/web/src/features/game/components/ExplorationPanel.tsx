import { useState, useEffect, useCallback } from "react";
import { MapPin, Compass, CheckCircle } from "lucide-react";
import { WsEventType } from "@mmp/shared";

import { Button, Badge, Card, EmptyState } from "@/shared/components/ui";
import { useModuleStore } from "@/stores/moduleStoreFactory";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Location {
  id: string;
  name: string;
  description: string;
  isExplored: boolean;
  isAvailable: boolean;
}

interface ExplorationPanelProps {
  send: (type: WsEventType, payload: unknown) => void;
  moduleId: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 탐색 진행 시간 (ms) */
const EXPLORE_DURATION = 3000;

// ---------------------------------------------------------------------------
// 컴포넌트
// ---------------------------------------------------------------------------

export function ExplorationPanel({ send, moduleId }: ExplorationPanelProps) {
  const moduleData = useModuleStore(moduleId, (s) => s.data);
  const locations = (moduleData.locations as Location[] | undefined) ?? [];

  // 탐색 중인 장소 ID
  const [exploringId, setExploringId] = useState<string | null>(null);

  // 탐색 중 3초 후 자동 해제
  useEffect(() => {
    if (!exploringId) return;

    const timer = setTimeout(() => {
      setExploringId(null);
    }, EXPLORE_DURATION);

    return () => clearTimeout(timer);
  }, [exploringId]);

  /** 장소 탐색 전송 */
  const handleExplore = useCallback(
    (locationId: string) => {
      if (exploringId) return; // 다른 장소 탐색 중
      setExploringId(locationId);
      send(WsEventType.GAME_ACTION, { type: "explore", locationId });
    },
    [exploringId, send],
  );

  if (locations.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Compass className="h-10 w-10" />}
          title="탐색 가능한 장소가 없습니다"
        />
      </Card>
    );
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <Compass className="h-5 w-5 text-amber-400" />
        <h3 className="text-lg font-semibold text-slate-100">장소 탐색</h3>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {locations.map((location) => {
          const isExploring = exploringId === location.id;
          const isDisabled =
            location.isExplored || !location.isAvailable || (!!exploringId && !isExploring);

          return (
            <Card
              key={location.id}
              className={`space-y-2 !p-3 ${
                isExploring ? "border-amber-500/50" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="truncate text-sm font-medium text-slate-200">
                    {location.name}
                  </span>
                </div>
                {location.isExplored && (
                  <Badge variant="success">
                    <CheckCircle className="mr-1 h-3 w-3" />
                    탐색 완료
                  </Badge>
                )}
              </div>

              <p className="text-xs text-slate-400 line-clamp-2">
                {location.description}
              </p>

              {!location.isExplored && (
                <Button
                  size="sm"
                  variant={isExploring ? "ghost" : "secondary"}
                  disabled={isDisabled}
                  isLoading={isExploring}
                  onClick={() => handleExplore(location.id)}
                  className="w-full"
                >
                  {isExploring ? "탐색 중..." : "탐색"}
                </Button>
              )}
            </Card>
          );
        })}
      </div>
    </Card>
  );
}
