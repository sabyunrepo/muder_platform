import { X } from 'lucide-react';
import { editorDesignClassNames } from '@/features/editor/design-system/editorDesignTokens';
import type { ClueResponse } from '@/features/editor/api';
import type { LocationDiscoveryConfig } from '@/features/editor/editorTypes';
import type {
  InvestigationCostDraft,
  InvestigationTokenDraft,
} from '@/features/editor/entities/deckInvestigation/locationClueInvestigationCost';
import { ClueSearchMultiSelect, type ClueSearchSelectItem } from './ClueSearchMultiSelect';
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

function toClueSearchItem(clue: ClueResponse): ClueSearchSelectItem {
  return {
    id: clue.id,
    name: clue.name,
    meta: clueMeta(clue),
    badge: roundLabel(clue),
  };
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
  const availableItems = availableClues.map(toClueSearchItem);
  const selectedRequiredNames = requiredIds
    .map((id) => clueById.get(id)?.name)
    .filter(Boolean)
    .join(', ');

  return (
    <div className={`px-2.5 py-2 ${editorDesignClassNames.listItem}`}>
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--mmp-editor-color-tint-yellow)] text-[9px] font-semibold text-[var(--mmp-editor-color-warning)]">
          {roundLabel(clue)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-[var(--mmp-editor-color-charcoal)]">{clue.name}</span>
          <span className="block truncate text-[10px] text-[var(--mmp-editor-color-slate)]">{clueMeta(clue)}</span>
        </span>
        <span className="shrink-0 rounded-full border border-[var(--mmp-editor-color-hairline)] px-2 py-0.5 text-[10px] text-[var(--mmp-editor-color-steel)]">
          1회 발견
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onRemove(clue.id)}
          aria-label={`${clue.name} 제거`}
          className={`p-1 hover:text-[var(--mmp-editor-color-error)] disabled:opacity-50 ${editorDesignClassNames.iconButton}`}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className={`mt-2 p-2 ${editorDesignClassNames.subtlePanel}`}>
        {availableClues.length === 0 ? (
          <p className="text-[10px] text-[var(--mmp-editor-color-slate)]">조건으로 사용할 다른 단서가 없습니다.</p>
        ) : (
          <ClueSearchMultiSelect
            title="필요 단서"
            items={availableItems}
            selectedIds={requiredIds}
            disabled={disabled}
            searchLabel={`${clue.name} 필요 단서 검색`}
            searchPlaceholder="먼저 보유해야 할 단서 검색"
            emptySelectedText="조건 없음"
            idleSearchText="필요 단서를 검색해 추가하세요."
            getAddAriaLabel={(item) => `${clue.name} 발견 조건 ${item.name} 필요`}
            getRemoveAriaLabel={(item) => `${clue.name} 발견 조건 ${item.name} 해제`}
            onAdd={(requiredClueId) => onToggleRequired(clue.id, requiredClueId)}
            onRemove={(requiredClueId) => onToggleRequired(clue.id, requiredClueId)}
          />
        )}
        <p className="mt-1.5 text-[10px] text-[var(--mmp-editor-color-slate)]">
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
