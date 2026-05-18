import { Coins } from 'lucide-react';
import { editorDesignClassNames } from '@/features/editor/design-system/editorDesignTokens';
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
    <div className={`mt-2 p-2 ${editorDesignClassNames.subtlePanel}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--mmp-editor-color-slate)]">
          <Coins className="h-3 w-3 text-[var(--mmp-editor-color-warning)]" />
          조사 비용
        </p>
        <span className="rounded-full border border-[var(--mmp-editor-color-hairline)] px-2 py-0.5 text-[10px] text-[var(--mmp-editor-color-steel)]">
          {formatInvestigationCostLabel(cost, tokens)}
        </span>
      </div>

      <label className="flex min-h-9 items-center gap-2 rounded-md border border-[var(--mmp-editor-color-hairline)] bg-[var(--mmp-editor-color-canvas)] px-2 py-1.5 text-xs text-[var(--mmp-editor-color-charcoal)]">
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
          className="h-4 w-4 rounded border-[var(--mmp-editor-color-hairline-strong)] bg-[var(--mmp-editor-color-canvas)] text-[var(--mmp-editor-color-success)] focus-visible:ring-2 focus-visible:ring-[var(--mmp-editor-color-success)]"
        />
        <span className="font-medium text-[var(--mmp-editor-color-charcoal)]">무료 조사</span>
        <span className="text-[10px] text-[var(--mmp-editor-color-slate)]">
          체크하면 조사권 없이 바로 조사할 수 있습니다.
        </span>
      </label>

      {cost.mode === 'token' ? (
        <div className="mt-2">
          <label className="block max-w-28">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-[var(--mmp-editor-color-slate)]">
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
              className={`w-full px-2 py-1.5 text-xs disabled:opacity-50 ${editorDesignClassNames.input}`}
            />
          </label>
          <p className="mt-1.5 text-[10px] text-[var(--mmp-editor-color-slate)]">
            모듈 탭의 기본 조사권 설정을 사용합니다.
          </p>
        </div>
      ) : null}
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[var(--mmp-editor-color-slate)]">
        <span>조사권 이름은 모듈 탭에서, 지급 수량은 장면 설정에서 관리합니다.</span>
        <a
          href={manageHref}
          className={`px-2 py-1 text-xs ${editorDesignClassNames.secondaryAction}`}
        >
          조사권 관리
        </a>
      </div>
    </div>
  );
}
