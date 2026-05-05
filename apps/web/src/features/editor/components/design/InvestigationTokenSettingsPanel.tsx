import { Plus, Trash2 } from 'lucide-react';
import type {
  DeckInvestigationConfigDraft,
  InvestigationTokenDraft,
} from '@/features/editor/entities/deckInvestigation/deckInvestigationAdapter';

interface InvestigationTokenSettingsPanelProps {
  draft: DeckInvestigationConfigDraft;
  isSaving: boolean;
  onChange: (draft: DeckInvestigationConfigDraft) => void;
}

const inputCls =
  'w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60';

function generateTokenId(tokens: InvestigationTokenDraft[]): string {
  const usedIds = new Set(tokens.map((token) => token.id));
  let index = tokens.length + 1;
  let candidate = `investigation-token-${index}`;
  while (usedIds.has(candidate)) {
    index += 1;
    candidate = `investigation-token-${index}`;
  }
  return candidate;
}

function normalizeAmount(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

export function InvestigationTokenSettingsPanel({
  draft,
  isSaving,
  onChange,
}: InvestigationTokenSettingsPanelProps) {
  const tokens = draft.tokens.length > 0 ? draft.tokens : [
    { id: 'investigation-token', name: '조사권', iconLabel: '권', defaultAmount: 0 },
  ];

  function updateToken(tokenId: string, patch: Partial<InvestigationTokenDraft>) {
    onChange({
      ...draft,
      tokens: tokens.map((token) => (token.id === tokenId ? { ...token, ...patch } : token)),
    });
  }

  function addToken() {
    const nextIndex = tokens.length + 1;
    onChange({
      ...draft,
      tokens: [
        ...tokens,
        {
          id: generateTokenId(tokens),
          name: `조사권 ${nextIndex}`,
          iconLabel: '권',
          defaultAmount: 0,
        },
      ],
    });
  }

  function removeToken(tokenId: string) {
    if (tokens.length <= 1) return;
    const nextTokens = tokens.filter((token) => token.id !== tokenId);
    const fallbackTokenId = nextTokens[0]?.id ?? tokens[0].id;
    onChange({
      ...draft,
      tokens: nextTokens,
      decks: draft.decks.map((deck) =>
        deck.tokenId === tokenId ? { ...deck, tokenId: fallbackTokenId } : deck,
      ),
    });
  }

  return (
    <div className="border-t border-slate-700 px-3 py-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-semibold text-slate-200">조사권 설정</h4>
          <p className="mt-0.5 text-[10px] text-slate-500">
            단서 조사에 소비할 권한 이름과 시작 수량을 정합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={addToken}
          disabled={isSaving}
          className="inline-flex shrink-0 items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[11px] font-medium text-slate-300 transition hover:border-amber-500/60 hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus className="h-3 w-3" />
          조사권 추가
        </button>
      </div>

      <div className="space-y-2">
        {tokens.map((token) => (
          <div
            key={token.id}
            className="grid gap-2 rounded-md border border-slate-700 bg-slate-900/60 p-2 md:grid-cols-[minmax(0,1fr)_5rem_7rem_2rem]"
          >
            <label className="min-w-0">
              <span className="mb-1 block text-[10px] font-medium text-slate-500">
                이름
              </span>
              <input
                className={inputCls}
                value={token.name}
                onChange={(event) => updateToken(token.id, { name: event.target.value })}
                disabled={isSaving}
                aria-label={`${token.name} 조사권 이름`}
                placeholder="조사권"
              />
            </label>

            <label>
              <span className="mb-1 block text-[10px] font-medium text-slate-500">
                라벨
              </span>
              <input
                className={inputCls}
                value={token.iconLabel}
                onChange={(event) => updateToken(token.id, { iconLabel: event.target.value })}
                disabled={isSaving}
                aria-label={`${token.name} 표시 라벨`}
                placeholder="권"
              />
            </label>

            <label>
              <span className="mb-1 block text-[10px] font-medium text-slate-500">
                시작 수량
              </span>
              <input
                className={inputCls}
                type="number"
                min={0}
                step={1}
                value={token.defaultAmount}
                onChange={(event) =>
                  updateToken(token.id, { defaultAmount: normalizeAmount(event.target.value) })
                }
                disabled={isSaving}
                aria-label={`${token.name} 초기 배포량`}
              />
            </label>

            <button
              type="button"
              onClick={() => removeToken(token.id)}
              disabled={isSaving || tokens.length <= 1}
              aria-label={`${token.name} 조사권 삭제`}
              className="self-end rounded p-2 text-slate-500 transition hover:bg-red-950/40 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
