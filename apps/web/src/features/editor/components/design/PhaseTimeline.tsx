import { Plus } from 'lucide-react';
import type { PhaseConfig, PhaseType } from './FlowSubTab';
import { PhaseCard, PHASE_META } from './PhaseCard';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PhaseTimelineProps {
  phases: PhaseConfig[];
  onAdd: (afterIndex: number) => void;
  onChange: (index: number, updated: PhaseConfig) => void;
  onDelete: (index: number) => void;
  onMove: (index: number, direction: 'left' | 'right') => void;
}

// ---------------------------------------------------------------------------
// PhaseTimeline
// ---------------------------------------------------------------------------

export function PhaseTimeline({ phases, onAdd, onChange, onDelete, onMove }: PhaseTimelineProps) {
  const totalMinutes = phases.reduce((sum, p) => sum + p.duration, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* ── Total duration badge ── */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">전체 소요 시간:</span>
        <span className="rounded-sm bg-slate-800 px-2 py-0.5 font-mono text-xs text-amber-400">
          {totalMinutes}분
        </span>
      </div>

      {/* ── Timeline ── horizontal on md+, vertical on mobile ── */}
      {/* Mobile: vertical stack */}
      <div className="flex flex-col gap-2 md:hidden">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 shrink-0 rounded-full border-2 border-amber-500 bg-transparent" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600">START</span>
        </div>
        {phases.length === 0 ? (
          <div className="flex items-center gap-2 pl-1">
            <div className="h-4 w-px bg-slate-700" />
            <AddButton onClick={() => onAdd(-1)} />
          </div>
        ) : (
          phases.map((phase, i) => (
            <div key={phase.id} className="flex flex-col gap-2">
              <div className="flex items-center gap-2 pl-1">
                <div className="h-4 w-px bg-slate-700" />
                <AddButton onClick={() => onAdd(i - 1)} />
              </div>
              <PhaseCard
                phase={phase}
                index={i}
                total={phases.length}
                onChange={onChange}
                onDelete={onDelete}
                onMove={onMove}
                fullWidth
              />
            </div>
          ))
        )}
        <div className="flex items-center gap-2 pl-1">
          <div className="h-4 w-px bg-slate-700" />
          <AddButton onClick={() => onAdd(phases.length - 1)} />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 shrink-0 rounded-full border-2 border-slate-600 bg-transparent" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600">END</span>
        </div>
      </div>

      {/* Desktop: horizontal scroll */}
      <div className="hidden items-start gap-2 overflow-x-auto pb-2 md:flex">
        {/* Start marker */}
        <div className="flex shrink-0 flex-col items-center gap-1 pt-10">
          <div className="h-3 w-3 rounded-full border-2 border-amber-500 bg-transparent" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600">START</span>
        </div>

        {phases.length === 0 ? (
          /* Empty state: single add button */
          <div className="flex shrink-0 items-center pt-8">
            <AddButton onClick={() => onAdd(-1)} />
          </div>
        ) : (
          phases.map((phase, i) => (
            <div key={phase.id} className="flex shrink-0 items-start gap-2">
              {/* Connector line */}
              <div className="mt-[22px] h-px w-4 shrink-0 bg-slate-700" />

              {/* Card */}
              <PhaseCard
                phase={phase}
                index={i}
                total={phases.length}
                onChange={onChange}
                onDelete={onDelete}
                onMove={onMove}
              />

              {/* Add button after each card */}
              <div className="flex shrink-0 items-center pt-8">
                <AddButton onClick={() => onAdd(i)} />
              </div>
            </div>
          ))
        )}

        {/* End marker */}
        <div className="flex shrink-0 flex-col items-center gap-1 pt-10">
          <div className="mt-px h-px w-4 bg-slate-700" />
          <div className="h-3 w-3 rounded-full border-2 border-slate-600 bg-transparent" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600">END</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddButton
// ---------------------------------------------------------------------------

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="페이즈 추가"
      className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-slate-600 text-slate-600 transition-colors hover:border-amber-500 hover:text-amber-500"
    >
      <Plus className="h-3.5 w-3.5" />
    </button>
  );
}
