import { ChevronLeft, ChevronRight, Trash2, BookOpen, Search, MessageSquare, Vote, Eye, Trophy } from 'lucide-react';
import type { PhaseConfig, PhaseType } from './FlowSubTab';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PHASE_META: Record<PhaseType, { label: string; Icon: React.ElementType }> = {
  intro:         { label: '소개',  Icon: BookOpen },
  investigation: { label: '조사',  Icon: Search },
  discussion:    { label: '토론',  Icon: MessageSquare },
  voting:        { label: '투표',  Icon: Vote },
  reveal:        { label: '공개',  Icon: Eye },
  result:        { label: '결과',  Icon: Trophy },
};

const PHASE_TYPES: PhaseType[] = ['intro', 'investigation', 'discussion', 'voting', 'reveal', 'result'];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PhaseCardProps {
  phase: PhaseConfig;
  index: number;
  total: number;
  onChange: (index: number, updated: PhaseConfig) => void;
  onDelete: (index: number) => void;
  onMove: (index: number, direction: 'left' | 'right') => void;
  fullWidth?: boolean;
}

// ---------------------------------------------------------------------------
// PhaseCard
// ---------------------------------------------------------------------------

export function PhaseCard({ phase, index, total, onChange, onDelete, onMove, fullWidth = false }: PhaseCardProps) {
  const { Icon } = PHASE_META[phase.type] ?? { Icon: BookOpen };

  return (
    <div className={`flex flex-col gap-3 rounded-sm border border-slate-700 bg-slate-900 p-3 ${fullWidth ? 'w-full' : 'w-44 shrink-0'}`}>
      {/* ── Type icon + select ── */}
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-amber-400" />
        <select
          value={phase.type}
          onChange={(e) =>
            onChange(index, {
              ...phase,
              type: e.target.value as PhaseType,
              label: PHASE_META[e.target.value as PhaseType]?.label ?? phase.label,
            })
          }
          className="flex-1 truncate rounded-sm border border-slate-700 bg-slate-800 px-1.5 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
        >
          {PHASE_TYPES.map((t) => (
            <option key={t} value={t}>
              {PHASE_META[t].label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Label ── */}
      <input
        type="text"
        value={phase.label}
        onChange={(e) => onChange(index, { ...phase, label: e.target.value })}
        placeholder="표시 이름"
        className="w-full rounded-sm border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
      />

      {/* ── Duration ── */}
      <div className="flex items-center gap-1.5">
        <span className="w-10 shrink-0 text-[10px] text-slate-500">시간</span>
        <input
          type="number"
          min={1}
          max={999}
          value={phase.duration}
          onChange={(e) => onChange(index, { ...phase, duration: Math.max(1, Number(e.target.value)) })}
          className="w-full rounded-sm border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
        <span className="shrink-0 text-[10px] text-slate-500">분</span>
      </div>

      {/* ── Rounds ── */}
      <div className="flex items-center gap-1.5">
        <span className="w-10 shrink-0 text-[10px] text-slate-500">라운드</span>
        <input
          type="number"
          min={1}
          max={99}
          value={phase.rounds}
          onChange={(e) => onChange(index, { ...phase, rounds: Math.max(1, Number(e.target.value)) })}
          className="w-full rounded-sm border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex gap-1">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMove(index, 'left')}
            aria-label="왼쪽으로 이동"
            className="rounded-sm p-0.5 text-slate-600 transition-colors hover:text-slate-300 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => onMove(index, 'right')}
            aria-label="오른쪽으로 이동"
            className="rounded-sm p-0.5 text-slate-600 transition-colors hover:text-slate-300 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => onDelete(index)}
          aria-label="페이즈 삭제"
          className="rounded-sm p-0.5 text-slate-600 transition-colors hover:text-red-400"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
