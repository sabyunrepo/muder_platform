import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Layers } from 'lucide-react';
import type { EditorThemeResponse } from '@/features/editor/api';
import { useUpdateConfigJson } from '@/features/editor/api';
import { PhaseTimeline } from './PhaseTimeline';
import { FlowCanvas } from './FlowCanvas';

// ---------------------------------------------------------------------------
// Feature flag — set to true in Phase 15.0 PR-7
// ---------------------------------------------------------------------------

export const FLOW_CANVAS_ENABLED = false;

// ---------------------------------------------------------------------------
// Types (exported for reuse in sub-components)
// ---------------------------------------------------------------------------

export type PhaseType = 'intro' | 'investigation' | 'discussion' | 'voting' | 'reveal' | 'result';

export interface PhaseConfig {
  id: string;
  type: PhaseType;
  label: string;
  duration: number;
  rounds: number;
}

// ---------------------------------------------------------------------------
// Preset
// ---------------------------------------------------------------------------

function makePreset(): PhaseConfig[] {
  return [
    { id: crypto.randomUUID(), type: 'intro',         label: '소개', duration: 10, rounds: 1 },
    { id: crypto.randomUUID(), type: 'investigation', label: '조사', duration: 20, rounds: 1 },
    { id: crypto.randomUUID(), type: 'discussion',    label: '토론', duration: 15, rounds: 1 },
    { id: crypto.randomUUID(), type: 'voting',        label: '투표', duration:  5, rounds: 1 },
    { id: crypto.randomUUID(), type: 'reveal',        label: '공개', duration: 10, rounds: 1 },
  ];
}

function makeNewPhase(): PhaseConfig {
  return {
    id: crypto.randomUUID(),
    type: 'investigation',
    label: '조사',
    duration: 10,
    rounds: 1,
  };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FlowSubTabProps {
  themeId: string;
  theme: EditorThemeResponse;
}

// ---------------------------------------------------------------------------
// FlowSubTab
// ---------------------------------------------------------------------------

export function FlowSubTab({ themeId, theme }: FlowSubTabProps) {
  const updateConfig = useUpdateConfigJson(themeId);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const serverPhases = (): PhaseConfig[] => {
    const cfg = theme.config_json ?? {};
    return Array.isArray(cfg.phases) ? (cfg.phases as PhaseConfig[]) : [];
  };

  const [phases, setPhases] = useState<PhaseConfig[]>(serverPhases);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Sync when server data changes
  useEffect(() => {
    setPhases(serverPhases());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(theme.config_json?.phases)]);

  const persist = useCallback(
    (next: PhaseConfig[]) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateConfig.mutate(
          { ...(theme.config_json ?? {}), phases: next },
          {
            onSuccess: () => toast.success('페이즈 설정이 저장되었습니다'),
            onError: () => toast.error('페이즈 설정 저장에 실패했습니다'),
          },
        );
      }, 500);
    },
    [theme.config_json, updateConfig],
  );

  const applyPreset = () => {
    const preset = makePreset();
    setPhases(preset);
    persist(preset);
  };

  const handleAdd = (afterIndex: number) => {
    const next = [...phases];
    next.splice(afterIndex + 1, 0, makeNewPhase());
    setPhases(next);
    persist(next);
  };

  const handleChange = (index: number, updated: PhaseConfig) => {
    const next = phases.map((p, i) => (i === index ? updated : p));
    setPhases(next);
    persist(next);
  };

  const handleDelete = (index: number) => {
    const next = phases.filter((_, i) => i !== index);
    setPhases(next);
    persist(next);
  };

  const handleMove = (index: number, direction: 'left' | 'right') => {
    const next = [...phases];
    const target = direction === 'left' ? index - 1 : index + 1;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setPhases(next);
    persist(next);
  };

  if (FLOW_CANVAS_ENABLED) {
    return <FlowCanvas themeId={themeId} />;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-6 py-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-slate-500" />
          <span className="text-xs font-medium text-slate-400">
            페이즈 타임라인
          </span>
          <span className="rounded-sm bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
            {phases.length}개
          </span>
        </div>
        <button
          type="button"
          onClick={applyPreset}
          className="rounded-sm border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-amber-500 hover:text-amber-400"
        >
          표준 머더미스터리 프리셋 적용
        </button>
      </div>

      {/* ── Timeline ── */}
      <div className="flex-1 overflow-auto px-6 py-6">
        <PhaseTimeline
          phases={phases}
          onAdd={handleAdd}
          onChange={handleChange}
          onDelete={handleDelete}
          onMove={handleMove}
        />
      </div>
    </div>
  );
}
