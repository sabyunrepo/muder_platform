import { ChevronDown } from 'lucide-react';
import { Input } from '@/shared/components/ui/Input';

// ---------------------------------------------------------------------------
// ClueFormAdvancedFields
//
// Collapsible block for advanced clue settings: clue type, level, sort order,
// is_common, and the item-usage block (is_usable + effect/target/consumed).
// All state is owned by the parent ClueForm; this component is a controlled
// view.
// ---------------------------------------------------------------------------

const CLUE_TYPES = [
  { value: 'normal', label: '일반' },
  { value: 'physical', label: '물리적 단서' },
  { value: 'document', label: '문서' },
  { value: 'testimony', label: '증언' },
  { value: 'digital', label: '디지털' },
  { value: 'other', label: '기타' },
] as const;

export interface ClueFormAdvancedFieldsProps {
  showAdvanced: boolean;
  onToggleAdvanced: () => void;

  clueType: string;
  onClueTypeChange: (value: string) => void;

  level: number;
  onLevelChange: (value: number) => void;

  sortOrder: number;
  onSortOrderChange: (value: number) => void;

  isCommon: boolean;
  onIsCommonChange: (value: boolean) => void;

  isUsable: boolean;
  onIsUsableChange: (value: boolean) => void;

  useEffect_: string;
  onUseEffectChange: (value: string) => void;

  useTarget: string;
  onUseTargetChange: (value: string) => void;

  useConsumed: boolean;
  onUseConsumedChange: (value: boolean) => void;
}

export function ClueFormAdvancedFields({
  showAdvanced,
  onToggleAdvanced,
  clueType,
  onClueTypeChange,
  level,
  onLevelChange,
  sortOrder,
  onSortOrderChange,
  isCommon,
  onIsCommonChange,
  isUsable,
  onIsUsableChange,
  useEffect_,
  onUseEffectChange,
  useTarget,
  onUseTargetChange,
  useConsumed,
  onUseConsumedChange,
}: ClueFormAdvancedFieldsProps) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onToggleAdvanced}
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-amber-400 transition-colors"
      >
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${
            showAdvanced ? 'rotate-180' : ''
          }`}
        />
        고급 설정
      </button>

      {showAdvanced && (
        <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
          {/* Clue type */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="clue-type"
              className="text-sm font-medium text-slate-300"
            >
              단서 유형
            </label>
            <select
              id="clue-type"
              value={clueType}
              onChange={(e) => onClueTypeChange(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {CLUE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Level + Sort order */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="발견 난이도"
              type="number"
              value={level}
              onChange={(e) => onLevelChange(Number(e.target.value))}
              min={1}
              max={10}
            />
            <Input
              label="정렬 순서"
              type="number"
              value={sortOrder}
              onChange={(e) => onSortOrderChange(Number(e.target.value))}
              min={0}
            />
          </div>

          {/* Is common */}
          <div className="flex items-center gap-2">
            <input
              id="clue-is-common"
              type="checkbox"
              checked={isCommon}
              onChange={(e) => onIsCommonChange(e.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900"
            />
            <label
              htmlFor="clue-is-common"
              className="text-sm font-medium text-slate-300"
            >
              공개 단서 (모든 플레이어 공유)
            </label>
          </div>

          {/* Item usage */}
          <div className="border-t border-slate-800 pt-3 mt-3 space-y-3">
            <div className="flex items-center gap-2">
              <input
                id="clue-is-usable"
                type="checkbox"
                checked={isUsable}
                onChange={(e) => onIsUsableChange(e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900"
              />
              <label
                htmlFor="clue-is-usable"
                className="text-sm font-medium text-slate-300"
              >
                사용 가능 (아이템)
              </label>
            </div>

            {isUsable && (
              <div className="ml-6 space-y-3">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="clue-use-effect"
                    className="text-sm font-medium text-slate-300"
                  >
                    효과
                  </label>
                  <select
                    id="clue-use-effect"
                    value={useEffect_}
                    onChange={(e) => onUseEffectChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="peek">엿보기 (Peek)</option>
                    <option value="steal">강탈 (Steal)</option>
                    <option value="reveal">공개 (Reveal)</option>
                    <option value="block">차단 (Block)</option>
                    <option value="swap">교환 (Swap)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="clue-use-target"
                    className="text-sm font-medium text-slate-300"
                  >
                    대상
                  </label>
                  <select
                    id="clue-use-target"
                    value={useTarget}
                    onChange={(e) => onUseTargetChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="player">플레이어</option>
                    <option value="clue">단서</option>
                    <option value="self">자신</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="clue-use-consumed"
                    type="checkbox"
                    checked={useConsumed}
                    onChange={(e) => onUseConsumedChange(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900"
                  />
                  <label
                    htmlFor="clue-use-consumed"
                    className="text-sm font-medium text-slate-300"
                  >
                    사용 후 소멸
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
