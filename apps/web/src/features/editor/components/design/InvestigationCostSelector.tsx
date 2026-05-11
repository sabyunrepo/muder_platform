import { Coins } from 'lucide-react';
import type {
  InvestigationCostDraft,
  InvestigationTokenDraft,
} from '@/features/editor/entities/deckInvestigation/locationClueInvestigationCost';
import { formatInvestigationCostLabel } from '@/features/editor/entities/deckInvestigation/locationClueInvestigationCost';

interface InvestigationCostSelectorProps {
  clueName: string;
  cost: InvestigationCostDraft;
  tokens: InvestigationTokenDraft[];
  disabled: boolean;
  manageHref: string;
  onChange: (cost: InvestigationCostDraft) => void;
}

function normalizeCost(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.floor(parsed));
}

export function InvestigationCostSelector({
  clueName,
  cost,
  tokens,
  disabled,
  manageHref,
  onChange,
}: InvestigationCostSelectorProps) {
  const fallbackTokenId = tokens[0]?.id ?? 'investigation-token';
  const selectedTokenId = cost.mode === 'token' ? cost.tokenId : fallbackTokenId;
  const selectedCost = cost.mode === 'token' ? cost.tokenCost : 1;
  const hasTokens = tokens.length > 0;

  return (
    <div className="mt-2 rounded-md border border-slate-800 bg-slate-950/80 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          <Coins className="h-3 w-3 text-amber-400/70" />
          조사 비용
        </p>
        <span className="rounded-full border border-slate-800 px-2 py-0.5 text-[10px] text-slate-500">
          {formatInvestigationCostLabel(cost, tokens)}
        </span>
      </div>

      <label className="flex min-h-9 items-center gap-2 rounded-md border border-slate-800 bg-slate-900/70 px-2 py-1.5 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={cost.mode === 'free'}
          disabled={disabled}
          aria-label={`${clueName} 무료 조사`}
          onChange={(event) =>
            onChange(
              event.target.checked
                ? { mode: 'free' }
                : { mode: 'token', tokenId: selectedTokenId, tokenCost: selectedCost },
            )
          }
          className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-500/60"
        />
        <span className="font-medium text-slate-200">무료 조사</span>
        <span className="text-[10px] text-slate-600">
          체크하면 조사권 없이 바로 조사할 수 있습니다.
        </span>
      </label>

      {cost.mode === 'token' ? (
        <div className="mt-2">
          <label className="block max-w-28">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              소비량
            </span>
            <input
              type="number"
              min={1}
              value={selectedCost}
              disabled={disabled || !hasTokens}
              aria-label={`${clueName} 조사권 소비량`}
              onChange={(event) =>
                onChange({
                  mode: 'token',
                  tokenId: selectedTokenId,
                  tokenCost: normalizeCost(event.target.value),
                })
              }
              className="w-full rounded-md border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 disabled:opacity-50"
            />
          </label>
          <p className="mt-1.5 text-[10px] text-slate-600">
            모듈 탭의 기본 조사권 설정을 사용합니다.
          </p>
        </div>
      ) : null}
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-600">
        <span>조사권 이름과 시작 수량은 모듈 탭의 조사권 설정에서 관리합니다.</span>
        <a
          href={manageHref}
          className="rounded border border-slate-800 px-2 py-1 text-slate-400 hover:border-amber-500/50 hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
        >
          조사권 관리
        </a>
      </div>
    </div>
  );
}
