import type { FlowNodeData } from "../../flowTypes";

interface PhasePanelAdvanceToggleProps {
  autoAdvance: boolean | undefined;
  onChange: (patch: Partial<FlowNodeData>) => void;
}

export function PhasePanelAdvanceToggle({
  autoAdvance,
  onChange,
}: PhasePanelAdvanceToggleProps) {
  return (
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
  );
}
