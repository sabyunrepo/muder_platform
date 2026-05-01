import type { FlowNodeData } from "../../flowTypes";

interface PhasePanelTimerSettingsProps {
  duration: number | undefined;
  rounds: number | undefined;
  onChange: (patch: Partial<FlowNodeData>) => void;
  onFlush: () => void;
}

const NUMBER_INPUT_CLASS =
  "rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950";

export function PhasePanelTimerSettings({
  duration,
  rounds,
  onChange,
  onFlush,
}: PhasePanelTimerSettingsProps) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-slate-400">시간 (분)</label>
        <input
          type="number"
          min={0}
          value={duration ?? ""}
          onChange={(e) =>
            onChange({ duration: e.target.value ? Number(e.target.value) : undefined })
          }
          onBlur={onFlush}
          placeholder="0"
          className={NUMBER_INPUT_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-slate-400">라운드 수</label>
        <input
          type="number"
          min={1}
          value={rounds ?? ""}
          onChange={(e) =>
            onChange({ rounds: e.target.value ? Number(e.target.value) : undefined })
          }
          onBlur={onFlush}
          placeholder="1"
          className={NUMBER_INPUT_CLASS}
        />
      </div>
    </>
  );
}
