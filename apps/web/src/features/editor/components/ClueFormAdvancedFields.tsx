import { ChevronDown } from 'lucide-react';

// ---------------------------------------------------------------------------
// ClueFormAdvancedFields
//
// Collapsible block for advanced clue settings: is_common and the item-usage
// block (is_usable + effect/target/consumed). All state is owned by the parent
// ClueForm; this component is a controlled view.
//
// Phase 20 PR-1: the type / level / sort order UI was removed — the type field
// had no game-logic effect, and level/sort order defaults are managed inside
// ClueForm so they no longer need a surface here.
// ---------------------------------------------------------------------------

export interface ClueFormAdvancedFieldsProps {
  showAdvanced: boolean;
  onToggleAdvanced: () => void;

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

  /** Round at which the clue becomes visible (null = from round 1). */
  revealRound: number | null;
  onRevealRoundChange: (value: number | null) => void;

  /** Round at which the clue is hidden (null = stays visible forever). */
  hideRound: number | null;
  onHideRoundChange: (value: number | null) => void;

  /** Optional error banner (e.g. reveal > hide). */
  roundError?: string;
}

function parseRoundInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}

export function ClueFormAdvancedFields({
  showAdvanced,
  onToggleAdvanced,
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
  revealRound,
  onRevealRoundChange,
  hideRound,
  onHideRoundChange,
  roundError,
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

          {/* Round schedule */}
          <div className="space-y-1.5 border-t border-slate-800 pt-3">
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              라운드 스케줄
            </div>
            <div className="flex gap-2">
              <div className="flex flex-1 flex-col gap-1">
                <label
                  htmlFor="clue-reveal-round"
                  className="text-xs text-slate-400"
                >
                  공개 라운드
                </label>
                <input
                  id="clue-reveal-round"
                  type="number"
                  min={1}
                  step={1}
                  placeholder="1부터"
                  value={revealRound ?? ''}
                  onChange={(e) => onRevealRoundChange(parseRoundInput(e.target.value))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900"
                />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <label
                  htmlFor="clue-hide-round"
                  className="text-xs text-slate-400"
                >
                  사라짐 라운드
                </label>
                <input
                  id="clue-hide-round"
                  type="number"
                  min={1}
                  step={1}
                  placeholder="끝까지"
                  value={hideRound ?? ''}
                  onChange={(e) => onHideRoundChange(parseRoundInput(e.target.value))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900"
                />
              </div>
            </div>
            {roundError && (
              <p className="text-xs text-red-400" role="alert">
                {roundError}
              </p>
            )}
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
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900"
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
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900"
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
