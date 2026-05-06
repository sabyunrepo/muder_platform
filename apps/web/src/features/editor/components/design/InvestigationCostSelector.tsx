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

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,0.8fr)_5rem]">
        <button
          type="button"
          disabled={disabled}
          aria-pressed={cost.mode === 'free'}
          aria-label={`${clueName} 무료 조사로 설정`}
          onClick={() => onChange({ mode: 'free' })}
          className={`rounded-md border px-2 py-1.5 text-xs transition disabled:opacity-50 ${
            cost.mode === 'free'
              ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-200'
              : 'border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300'
          }`}
        >
          무료
        </button>

        <label className="min-w-0">
          <span className="sr-only">{clueName} 조사권 종류</span>
          <select
            value={selectedTokenId}
            disabled={disabled}
            aria-label={`${clueName} 조사권 종류`}
            onChange={(event) =>
              onChange({ mode: 'token', tokenId: event.target.value, tokenCost: selectedCost })
            }
            className="w-full rounded-md border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 disabled:opacity-50"
          >
            {tokens.map((token) => (
              <option key={token.id} value={token.id}>
                {token.iconLabel} {token.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="sr-only">{clueName} 조사권 소비량</span>
          <input
            type="number"
            min={1}
            value={selectedCost}
            disabled={disabled}
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
      </div>
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
