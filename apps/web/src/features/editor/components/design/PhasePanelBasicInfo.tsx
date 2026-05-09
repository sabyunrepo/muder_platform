import type { FlowNodeData } from "../../flowTypes";
import { PHASE_TYPE_OPTIONS, normalizePhaseType } from "./phaseTypeOptions";

interface PhasePanelBasicInfoProps {
  label: string | undefined;
  phaseType: string | undefined;
  onChange: (patch: Partial<FlowNodeData>) => void;
  onFlush: () => void;
}

export function PhasePanelBasicInfo({
  label,
  phaseType,
  onChange,
  onFlush,
}: PhasePanelBasicInfoProps) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <label htmlFor="phase-panel-label" className="text-[11px] text-slate-400">
          라벨
        </label>
        <input
          id="phase-panel-label"
          type="text"
          value={label ?? ""}
          onChange={(e) => onChange({ label: e.target.value })}
          onBlur={onFlush}
          placeholder="장면 이름"
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="phase-panel-type" className="text-[11px] text-slate-400">
          타입
        </label>
        <select
          id="phase-panel-type"
          value={normalizePhaseType(phaseType)}
          onChange={(e) => onChange({ phase_type: e.target.value })}
          onBlur={onFlush}
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
        >
          {PHASE_TYPE_OPTIONS.map((pt) => (
            <option key={pt.value} value={pt.value}>
              {pt.label}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
