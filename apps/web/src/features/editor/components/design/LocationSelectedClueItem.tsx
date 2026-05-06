import { X } from 'lucide-react';
import type { ClueResponse } from '@/features/editor/api';
import type { LocationDiscoveryConfig } from '@/features/editor/editorTypes';
import type {
  InvestigationCostDraft,
  InvestigationTokenDraft,
} from '@/features/editor/entities/deckInvestigation/locationClueInvestigationCost';
import { InvestigationCostSelector } from './InvestigationCostSelector';

interface LocationSelectedClueItemProps {
  clue: ClueResponse;
  discovery?: LocationDiscoveryConfig;
  availableClues: ClueResponse[];
  clueById: Map<string, ClueResponse>;
  tokens: InvestigationTokenDraft[];
  cost: InvestigationCostDraft;
  disabled: boolean;
  manageHref: string;
  onRemove: (id: string) => void;
  onToggleRequired: (clueId: string, requiredClueId: string) => void;
  onCostChange: (clue: ClueResponse, cost: InvestigationCostDraft) => void;
}

function clueMeta(clue: ClueResponse) {
  return [clue.location_id ? '장소 단서' : '미배치', clue.is_common ? '공용' : null]
    .filter(Boolean)
    .join(' · ');
}

function roundLabel(clue: ClueResponse) {
  return typeof clue.reveal_round === 'number' ? `R${clue.reveal_round}` : 'CL';
}

export function LocationSelectedClueItem({
  clue,
  discovery,
  availableClues,
  clueById,
  tokens,
  cost,
  disabled,
  manageHref,
  onRemove,
  onToggleRequired,
  onCostChange,
}: LocationSelectedClueItemProps) {
  const requiredIds = discovery?.requiredClueIds ?? [];
  const requiredSet = new Set(requiredIds);
  const selectedRequiredNames = requiredIds
    .map((id) => clueById.get(id)?.name)
    .filter(Boolean)
    .join(', ');

  return (
    <div className="rounded-lg border border-amber-500/20 bg-slate-950/80 px-2.5 py-2">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-[9px] font-semibold text-amber-300">
          {roundLabel(clue)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-slate-200">{clue.name}</span>
          <span className="block truncate text-[10px] text-slate-600">{clueMeta(clue)}</span>
        </span>
        <span className="shrink-0 rounded-full border border-slate-800 px-2 py-0.5 text-[10px] text-slate-500">
          1회 발견
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onRemove(clue.id)}
          aria-label={`${clue.name} 제거`}
          className="rounded-full p-1 text-slate-600 hover:bg-red-950/40 hover:text-red-300 disabled:opacity-50"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="mt-2 rounded-md border border-slate-800 bg-slate-950/80 p-2">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          필요 단서
        </p>
        {availableClues.length === 0 ? (
          <p className="text-[10px] text-slate-600">조건으로 사용할 다른 단서가 없습니다.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {availableClues.map((candidate) => {
              const selected = requiredSet.has(candidate.id);
              return (
                <button
                  key={candidate.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onToggleRequired(clue.id, candidate.id)}
                  aria-pressed={selected}
                  aria-label={`${clue.name} 발견 조건 ${candidate.name} ${selected ? '해제' : '필요'}`}
                  className={`rounded-full border px-2 py-1 text-[10px] transition disabled:opacity-50 ${
                    selected
                      ? 'border-amber-400/50 bg-amber-500/10 text-amber-200'
                      : 'border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300'
                  }`}
                >
                  {candidate.name}
                </button>
              );
            })}
          </div>
        )}
        <p className="mt-1.5 text-[10px] text-slate-600">
          {selectedRequiredNames ? `${selectedRequiredNames} 보유 시 발견` : '조건 없음'}
        </p>
      </div>
      <InvestigationCostSelector
        clueName={clue.name}
        cost={cost}
        tokens={tokens}
        disabled={disabled}
        manageHref={manageHref}
        onChange={(nextCost) => onCostChange(clue, nextCost)}
      />
    </div>
  );
}
