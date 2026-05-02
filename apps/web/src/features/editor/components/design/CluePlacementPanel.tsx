import { useMemo } from 'react';
import { toast } from 'sonner';
import { Package, MapPin, X } from 'lucide-react';
import { Spinner } from '@/shared/components/ui/Spinner';
import type { EditorThemeResponse } from '@/features/editor/api';
import {
  useEditorClues,
  useEditorLocations,
  useUpdateConfigJson,
} from '@/features/editor/api';
import { readCluePlacement, writeCluePlacement } from '@/features/editor/utils/configShape';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CluePlacementPanelProps {
  themeId: string;
  theme: EditorThemeResponse;
}

// ---------------------------------------------------------------------------
// CluePlacementPanel
// ---------------------------------------------------------------------------

export function CluePlacementPanel({ themeId, theme }: CluePlacementPanelProps) {
  const { data: clues, isLoading: cluesLoading } = useEditorClues(themeId);
  const { data: locations, isLoading: locsLoading } = useEditorLocations(themeId);
  const updateConfig = useUpdateConfigJson(themeId);

  const placement = useMemo(() => readCluePlacement(theme.config_json), [theme.config_json]);

  const unplacedClues = useMemo(
    () => (clues ?? []).filter((c) => !placement[c.id]),
    [clues, placement],
  );

  const placedByLocation = useMemo(() => {
    const map = new Map<string, NonNullable<typeof clues>>([]);
    for (const [clueId, locationId] of Object.entries(placement)) {
      const clue = (clues ?? []).find((c) => c.id === clueId);
      if (!clue) continue;
      if (!map.has(locationId)) map.set(locationId, []);
      map.get(locationId)!.push(clue);
    }
    return map;
  }, [clues, placement]);

  function savePlacement(next: Record<string, string>) {
    updateConfig.mutate(writeCluePlacement(theme.config_json, next), {
      onSuccess: () => toast.success('배치가 저장되었습니다'),
      onError: () => toast.error('배치 저장에 실패했습니다'),
    });
  }

  function handleAssign(clueId: string, locationId: string) {
    if (!locationId) return;
    savePlacement({ ...placement, [clueId]: locationId });
  }

  function handleUnassign(clueId: string) {
    const next = { ...placement };
    delete next[clueId];
    savePlacement(next);
  }

  if (cluesLoading || locsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  const hasClues = (clues ?? []).length > 0;
  const hasLocations = (locations ?? []).length > 0;

  if (!hasClues || !hasLocations) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Package className="mx-auto mb-3 h-8 w-8 text-slate-700" />
          <p className="text-xs font-mono uppercase tracking-widest text-slate-700">
            {!hasClues ? '단서를 먼저 추가하세요' : '장소를 먼저 추가하세요'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-0 overflow-hidden">
      {/* ── Left: Unplaced clues ── */}
      <div className="w-72 shrink-0 overflow-y-auto border-r border-slate-800 bg-slate-950 px-3 py-4">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
          미배치 단서 ({unplacedClues.length})
        </p>

        {unplacedClues.length === 0 ? (
          <div className="rounded-sm border border-dashed border-slate-800 py-8 text-center">
            <Package className="mx-auto mb-2 h-5 w-5 text-slate-800" />
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-700">
              모두 배치됨
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {unplacedClues.map((clue) => (
              <div
                key={clue.id}
                className="rounded-sm border border-slate-800 bg-slate-900 p-2"
              >
                <div className="mb-1.5 flex items-center gap-1.5">
                  <Package className="h-3 w-3 shrink-0 text-slate-600" />
                  <span className="text-xs font-medium text-slate-300 truncate">
                    {clue.name}
                  </span>
                </div>
                <select
                  aria-label={`${clue.name} 장소 선택`}
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) handleAssign(clue.id, e.target.value);
                  }}
                  className="w-full rounded-sm bg-slate-800 px-2 py-1 text-xs text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900"
                >
                  <option value="" disabled>
                    장소 선택…
                  </option>
                  {(locations ?? []).map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Right: Placed clues grouped by location ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
          장소별 단서
        </p>

        <div className="space-y-4">
          {(locations ?? []).map((loc) => {
            const placed = placedByLocation.get(loc.id) ?? [];
            return (
              <div key={loc.id}>
                <div className="mb-2 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-amber-500/70" />
                  <span className="text-xs font-semibold text-slate-400">
                    {loc.name}
                  </span>
                  <span className="ml-1 text-[10px] text-slate-600">
                    ({placed.length})
                  </span>
                </div>

                {placed.length === 0 ? (
                  <div className="rounded-sm border border-dashed border-slate-800 py-3 text-center">
                    <p className="text-[10px] text-slate-700">배치된 단서 없음</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {placed.map((clue) => (
                      <div
                        key={clue.id}
                        className="group flex items-center gap-2 rounded-sm border border-slate-800 bg-slate-900 px-3 py-1.5"
                      >
                        <Package className="h-3 w-3 shrink-0 text-slate-600" />
                        <span className="flex-1 truncate text-xs text-slate-300">
                          {clue.name}
                        </span>
                        <button
                          type="button"
                          aria-label={`${clue.name} 배치 해제`}
                          onClick={() => handleUnassign(clue.id)}
                          className="shrink-0 rounded-sm p-0.5 text-slate-700 opacity-0 transition-all group-hover:opacity-100 hover:text-red-400"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
