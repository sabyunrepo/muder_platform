import type { FlowNodeData } from "../../flowTypes";

interface PhasePanelAdvanceToggleProps {
  autoAdvance: boolean | undefined;
  warningAt: number | undefined;
  onChange: (patch: Partial<FlowNodeData>) => void;
  onFlush: () => void;
}

export function PhasePanelAdvanceToggle({
  autoAdvance,
  warningAt,
  onChange,
  onFlush,
}: PhasePanelAdvanceToggleProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <label className="text-[11px] text-slate-400">자동 진행</label>
        <button
          type="button"
          role="switch"
          aria-checked={autoAdvance ?? false}
          onClick={() => onChange({ autoAdvance: !autoAdvance })}
          className={`relative h-5 w-9 rounded-full transition-colors ${
            autoAdvance ? "bg-amber-600" : "bg-slate-700"
          }`}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
              autoAdvance ? "translate-x-4" : ""
            }`}
          />
        </button>
      </div>

      {autoAdvance && (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-slate-400">경고 타이머 (초)</label>
          <input
            type="number"
            min={0}
            value={warningAt ?? ""}
            onChange={(e) =>
              onChange({ warningAt: e.target.value ? Number(e.target.value) : undefined })
            }
            onBlur={onFlush}
            placeholder="30"
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
          />
        </div>
      )}
    </>
  );
}
