import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Eye, Gift, Save, Search, X } from 'lucide-react';
import type { ClueResponse } from '@/features/editor/api';
import {
  readClueItemEffect,
  writeClueItemEffect,
  type ClueItemEffectConfig,
  type EditorConfig,
} from '@/features/editor/utils/configShape';

type EffectMode = 'none' | 'reveal' | 'grant';

interface ClueRuntimeEffectCardProps {
  clue: ClueResponse;
  clues: ClueResponse[];
  configJson: EditorConfig | null | undefined;
  onConfigChange?: (nextConfig: EditorConfig) => void;
  isSaving?: boolean;
}

interface DraftState {
  mode: EffectMode;
  revealText: string;
  grantClueIds: string[];
  consume: boolean;
}

function draftFromConfig(config: ClueItemEffectConfig | null): DraftState {
  if (config?.effect === 'reveal') {
    return {
      mode: 'reveal',
      revealText: config.revealText ?? '',
      grantClueIds: [],
      consume: config.consume === true,
    };
  }
  if (config?.effect === 'grant_clue') {
    return {
      mode: 'grant',
      revealText: '',
      grantClueIds: config.grantClueIds ?? [],
      consume: config.consume === true,
    };
  }
  return { mode: 'none', revealText: '', grantClueIds: [], consume: false };
}

function toEffectConfig(draft: DraftState): ClueItemEffectConfig | null {
  if (draft.mode === 'reveal') {
    return {
      effect: 'reveal',
      target: 'self',
      revealText: draft.revealText.trim(),
      consume: draft.consume,
    };
  }
  if (draft.mode === 'grant') {
    return {
      effect: 'grant_clue',
      target: 'self',
      grantClueIds: draft.grantClueIds,
      consume: draft.consume,
    };
  }
  return null;
}

function isDraftValid(draft: DraftState) {
  if (draft.mode === 'reveal') return draft.revealText.trim().length > 0;
  if (draft.mode === 'grant') return draft.grantClueIds.length > 0;
  return true;
}

export function ClueRuntimeEffectCard({
  clue,
  clues,
  configJson,
  onConfigChange,
  isSaving = false,
}: ClueRuntimeEffectCardProps) {
  const savedEffect = useMemo(
    () => readClueItemEffect(configJson, clue.id),
    [configJson, clue.id],
  );
  const [draft, setDraft] = useState<DraftState>(() => draftFromConfig(savedEffect));
  const [query, setQuery] = useState('');

  useEffect(() => {
    setDraft(draftFromConfig(savedEffect));
    setQuery('');
  }, [savedEffect]);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clues
      .filter((item) => item.id !== clue.id)
      .filter((item) => (q ? item.name.toLowerCase().includes(q) : true))
      .slice(0, 8);
  }, [clue.id, clues, query]);

  const selectedClues = useMemo(
    () => clues.filter((item) => draft.grantClueIds.includes(item.id)),
    [clues, draft.grantClueIds],
  );

  const canSave = !!onConfigChange && !isSaving && isDraftValid(draft);

  function updateDraft(patch: Partial<DraftState>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function toggleGrantClue(clueId: string) {
    setDraft((current) => {
      const hasClue = current.grantClueIds.includes(clueId);
      return {
        ...current,
        grantClueIds: hasClue
          ? current.grantClueIds.filter((id) => id !== clueId)
          : [...current.grantClueIds, clueId],
      };
    });
  }

  function handleSave() {
    if (!canSave) return;
    const nextConfig = writeClueItemEffect(configJson, clue.id, toEffectConfig(draft));
    onConfigChange?.(nextConfig);
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-300/70">
            게임 중 사용 효과
          </p>
          <h4 className="mt-1 text-lg font-bold text-slate-100">이 단서를 사용하면</h4>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            플레이어가 이 단서를 눌렀을 때 공개할 정보나 지급할 단서를 설정합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-amber-500/30 px-3 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-600"
        >
          <Save className="h-4 w-4" />
          {isSaving ? '저장 중' : '효과 저장'}
        </button>
      </div>

      <fieldset className="mt-4 grid gap-2 sm:grid-cols-3">
        <EffectChoice mode="none" current={draft.mode} label="효과 없음" onSelect={() => updateDraft({ mode: 'none' })} />
        <EffectChoice mode="reveal" current={draft.mode} label="정보 공개" icon={<Eye className="h-4 w-4" />} onSelect={() => updateDraft({ mode: 'reveal' })} />
        <EffectChoice mode="grant" current={draft.mode} label="새 단서 지급" icon={<Gift className="h-4 w-4" />} onSelect={() => updateDraft({ mode: 'grant' })} />
      </fieldset>

      {draft.mode === 'reveal' && (
        <div className="mt-4 space-y-2">
          <label htmlFor="clue-runtime-reveal" className="text-sm font-semibold text-slate-200">
            공개할 정보
          </label>
          <textarea
            id="clue-runtime-reveal"
            value={draft.revealText}
            onChange={(e) => updateDraft({ revealText: e.target.value })}
            rows={4}
            placeholder="예: 낡은 열쇠 안쪽에 작은 숫자 0427이 새겨져 있다."
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm leading-6 text-slate-100 placeholder:text-slate-600 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
          />
        </div>
      )}

      {draft.mode === 'grant' && (
        <GrantCluePicker
          candidates={candidates}
          selectedClues={selectedClues}
          query={query}
          selectedIds={draft.grantClueIds}
          onQueryChange={setQuery}
          onToggle={toggleGrantClue}
        />
      )}

      {draft.mode !== 'none' && (
        <label className="mt-4 flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={draft.consume}
            onChange={(e) => updateDraft({ consume: e.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          />
          <span>
            <span className="font-semibold text-slate-200">사용하면 내 단서함에서 사라짐</span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">
              일회용 열쇠처럼 효과를 발동한 뒤 보유 단서에서 제거할 때 켭니다.
            </span>
          </span>
        </label>
      )}
    </section>
  );
}

function EffectChoice({
  mode,
  current,
  label,
  icon,
  onSelect,
}: {
  mode: EffectMode;
  current: EffectMode;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
}) {
  const selected = current === mode;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
        selected
          ? 'border-amber-500/70 bg-amber-500/10 text-amber-200'
          : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-700'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function GrantCluePicker({
  candidates,
  selectedClues,
  query,
  selectedIds,
  onQueryChange,
  onToggle,
}: {
  candidates: ClueResponse[];
  selectedClues: ClueResponse[];
  query: string;
  selectedIds: string[];
  onQueryChange: (value: string) => void;
  onToggle: (clueId: string) => void;
}) {
  return (
    <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.8fr)]">
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
        <label htmlFor="clue-grant-search" className="text-sm font-semibold text-slate-200">
          지급할 단서 검색
        </label>
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            id="clue-grant-search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="단서 이름으로 검색"
            className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none"
          />
        </div>
        <div className="mt-3 space-y-2">
          {candidates.map((candidate) => {
            const selected = selectedIds.includes(candidate.id);
            return (
              <button
                key={candidate.id}
                type="button"
                onClick={() => onToggle(candidate.id)}
                aria-pressed={selected}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                  selected
                    ? 'border-amber-500/60 bg-amber-500/10 text-amber-100'
                    : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700'
                }`}
              >
                {candidate.name}
              </button>
            );
          })}
          {candidates.length === 0 && (
            <p className="rounded-lg border border-dashed border-slate-800 px-3 py-6 text-center text-xs text-slate-500">
              검색 결과가 없습니다.
            </p>
          )}
        </div>
      </div>
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
        <p className="text-sm font-semibold text-slate-200">선택된 지급 단서</p>
        {selectedClues.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-slate-800 px-3 py-6 text-center text-xs text-slate-500">
            아직 지급할 단서를 고르지 않았습니다.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {selectedClues.map((selected) => (
              <li key={selected.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-200">
                <span>{selected.name}</span>
                <button
                  type="button"
                  onClick={() => onToggle(selected.id)}
                  aria-label={`${selected.name} 지급 목록에서 제거`}
                  className="rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
