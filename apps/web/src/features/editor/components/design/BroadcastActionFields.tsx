import type { PhaseAction } from "../../flowTypes";

export function BroadcastActionFields({
  action,
  label,
  index,
  onParamsChange,
}: {
  action: PhaseAction;
  label: string;
  index: number;
  onParamsChange: (params: Record<string, unknown>) => void;
}) {
  if (action.type !== "BROADCAST_MESSAGE") return null;

  const params = action.params ?? {};
  const message = typeof params.message === "string" ? params.message : "";

  return (
    <label className="block rounded border border-slate-800 bg-slate-950/80 p-2 text-[11px] font-medium text-slate-400">
      플레이어에게 보여줄 알림 문구
      <textarea
        value={message}
        onChange={(e) => onParamsChange({ ...params, message: e.target.value })}
        aria-label={`${label} ${index + 1} 알림 문구`}
        placeholder="예: 금고가 열리며 오래된 편지가 공개됩니다."
        rows={2}
        className="mt-1 w-full resize-y rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
      />
    </label>
  );
}
