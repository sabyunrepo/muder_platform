import type { PhaseAction } from "../../flowTypes";
import { isInformationDeliveryAction } from "../../entities/shared/actionAdapter";
import type { ReadingSectionPickerOption } from "../../entities/story/readingSectionAdapter";
import {
  createAllPlayerDeliveryParams,
  readAllPlayerReadingSectionId,
} from "./actionFieldHelpers";

export function InformationActionFields({
  action,
  label,
  index,
  readingOptions,
  onParamsChange,
}: {
  action: PhaseAction;
  label: string;
  index: number;
  readingOptions: ReadingSectionPickerOption[];
  onParamsChange: (params: Record<string, unknown>) => void;
}) {
  if (!isInformationDeliveryAction(action)) return null;

  const selectedId = readAllPlayerReadingSectionId(action.params);

  return (
    <div className="rounded border border-slate-800 bg-slate-950/80 p-2">
      <label className="block text-[11px] font-medium text-slate-400">
        모두에게 공개할 읽기 대사
        <select
          value={selectedId}
          onChange={(e) => onParamsChange(createAllPlayerDeliveryParams(e.target.value))}
          aria-label={`${label} ${index + 1} 공개할 읽기 대사`}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
        >
          <option value="">읽기 대사를 선택하세요</option>
          {readingOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name} · {option.metaLabel}
            </option>
          ))}
        </select>
      </label>
      {readingOptions.length === 0 ? (
        <p className="mt-1 text-[10px] text-slate-600">
          스토리 탭에서 읽기 대사를 먼저 만들어야 선택할 수 있습니다.
        </p>
      ) : null}
    </div>
  );
}
