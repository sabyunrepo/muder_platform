import type { FlowNodeData } from "../../flowTypes";

interface PhaseDurationFieldProps {
  duration: number | undefined;
  onChange: (patch: Partial<FlowNodeData>) => void;
  onFlush: () => void;
}

export function PhaseDurationField({
  duration,
  onChange,
  onFlush,
}: PhaseDurationFieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-slate-400">시간 (분)</span>
      <input
        type="number"
        min={0}
        value={duration ?? ""}
        onChange={(event) =>
          onChange({ duration: event.target.value ? Number(event.target.value) : undefined })
        }
        onBlur={onFlush}
        placeholder="0"
        className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
      />
    </label>
  );
}
