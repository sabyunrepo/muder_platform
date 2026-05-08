import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Eye, FileText, Gift, Save, Search, Shuffle, TriangleAlert, X } from 'lucide-react';
import type { ClueResponse } from '@/features/editor/api';
import {
  readClueItemEffect,
  writeClueItemEffect,
  type ClueItemEffectConfig,
  type EditorConfig,
} from '@/features/editor/utils/configShape';

type EffectMode = 'description' | 'reveal' | 'grant' | 'peek' | 'steal' | 'kill';

interface ClueRuntimeEffectCardProps {
  clue: ClueResponse;
  clues: ClueResponse[];
  configJson: EditorConfig | null | undefined;
  onConfigChange?: (nextConfig: EditorConfig) => void;
  isSaving?: boolean;
}

interface DraftState {
  mode: EffectMode;
  password: string;
  descriptionText: string;
  revealText: string;
  grantClueIds: string[];
  consume: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readPassword(config: ClueItemEffectConfig | null): string {
  const condition = config?.condition;
  if (isRecord(condition) && condition.kind === 'password' && typeof condition.value === 'string') {
    return condition.value;
  }
  return typeof config?.password === 'string' ? config.password : '';
}

function draftFromConfig(config: ClueItemEffectConfig | null): DraftState {
  const password = readPassword(config);
  const base = { password, consume: config?.consume === true };

  if (config?.effect === 'description_change') {
    return {
      mode: 'description',
      ...base,
      descriptionText: config.descriptionText ?? '',
      revealText: '',
      grantClueIds: [],
    };
  }

  if (config?.effect === 'reveal') {
    return {
      mode: 'reveal',
      ...base,
      descriptionText: '',
      revealText: config.revealText ?? '',
      grantClueIds: [],
    };
  }
  if (config?.effect === 'grant_clue') {
    return {
      mode: 'grant',
      ...base,
      descriptionText: '',
      revealText: '',
      grantClueIds: config.grantClueIds ?? [],
    };
  }
  if (config?.effect === 'peek') {
    return { mode: 'peek', ...base, descriptionText: '', revealText: '', grantClueIds: [] };
  }
  if (config?.effect === 'steal') {
    return { mode: 'steal', ...base, descriptionText: '', revealText: '', grantClueIds: [] };
  }
  if (config?.effect === 'kill') {
    return { mode: 'kill', ...base, descriptionText: '', revealText: '', grantClueIds: [] };
  }
  return {
    mode: 'description',
    password: '',
    descriptionText: '',
    revealText: '',
    grantClueIds: [],
    consume: false,
  };
}

function passwordCondition(draft: DraftState): EditorConfig & {
  condition?: { kind: 'password'; value: string };
} {
  const password = draft.password.trim();
  return {
    condition: { kind: 'password' as const, value: password },
  };
}

function toEffectConfig(draft: DraftState): ClueItemEffectConfig | null {
  if (draft.mode === 'description') {
    return {
      effect: 'description_change',
      target: 'self',
      ...passwordCondition(draft),
      descriptionText: draft.descriptionText.trim(),
      consume: draft.consume,
    };
  }
  if (draft.mode === 'reveal') {
    return {
      effect: 'reveal',
      target: 'self',
      ...passwordCondition(draft),
      revealText: draft.revealText.trim(),
      consume: draft.consume,
    };
  }
  if (draft.mode === 'grant') {
    return {
      effect: 'grant_clue',
      target: 'self',
      ...passwordCondition(draft),
      grantClueIds: draft.grantClueIds,
      consume: draft.consume,
    };
  }
  if (draft.mode === 'peek') {
    return {
      effect: 'peek',
      target: 'player',
      ...passwordCondition(draft),
      consume: draft.consume,
    };
  }
  if (draft.mode === 'kill') {
    return {
      effect: 'kill',
      target: 'player',
      ...passwordCondition(draft),
      consume: draft.consume,
    };
  }
  return {
    effect: 'steal',
    target: 'player',
    ...passwordCondition(draft),
    consume: draft.consume,
  };
}

function isDraftValid(draft: DraftState) {
  if (draft.password.trim().length === 0) return false;
  if (draft.mode === 'description') return draft.descriptionText.trim().length > 0;
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
            단서 공개 조건
          </p>
          <h4 className="mt-1 text-lg font-bold text-slate-100">암호로 열람하고, 사용하면 효과를 실행합니다</h4>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            공개 조건은 암호 입력으로 고정하고, 아이템 사용 효과는 아래에서 따로 고릅니다.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-amber-500/30 px-3 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-600"
        >
          <Save className="h-4 w-4" />
          {isSaving ? '저장 중' : '공개 조건 저장'}
        </button>
      </div>

      <label className="mt-4 block text-sm font-medium text-slate-300">
        암호 입력 후 공개
        <input
          value={draft.password}
          onChange={(e) => updateDraft({ password: e.target.value })}
          placeholder="플레이어가 입력해야 하는 암호"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
        />
        {draft.password.trim().length === 0 && (
          <span className="mt-1 block text-xs text-red-400">암호를 입력해야 저장할 수 있습니다.</span>
        )}
      </label>

      <fieldset className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <legend className="mb-2 text-sm font-semibold text-slate-200">아이템 사용 시</legend>
        <EffectChoice mode="description" current={draft.mode} label="설명 변경" icon={<FileText className="h-4 w-4" />} onSelect={() => updateDraft({ mode: 'description' })} />
        <EffectChoice mode="reveal" current={draft.mode} label="정보 공개" icon={<Eye className="h-4 w-4" />} onSelect={() => updateDraft({ mode: 'reveal' })} />
        <EffectChoice mode="grant" current={draft.mode} label="새 단서 지급" icon={<Gift className="h-4 w-4" />} onSelect={() => updateDraft({ mode: 'grant' })} />
        <EffectChoice mode="peek" current={draft.mode} label="단서 훔쳐보기" icon={<Search className="h-4 w-4" />} onSelect={() => updateDraft({ mode: 'peek' })} />
        <EffectChoice mode="steal" current={draft.mode} label="단서 가져오기" icon={<Shuffle className="h-4 w-4" />} onSelect={() => updateDraft({ mode: 'steal' })} />
        <EffectChoice mode="kill" current={draft.mode} label="살해 요청" icon={<TriangleAlert className="h-4 w-4" />} onSelect={() => updateDraft({ mode: 'kill' })} />
      </fieldset>

      {draft.mode === 'description' && (
        <div className="mt-4 space-y-2">
          <label htmlFor="clue-runtime-description" className="text-sm font-semibold text-slate-200">
            사용 후 바뀔 설명
          </label>
          <textarea
            id="clue-runtime-description"
            value={draft.descriptionText}
            onChange={(e) => updateDraft({ descriptionText: e.target.value })}
            rows={4}
            placeholder="예: 열쇠를 돌리자 손잡이 안쪽의 새 문장이 드러난다."
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm leading-6 text-slate-100 placeholder:text-slate-600 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
          />
        </div>
      )}

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

      {draft.mode === 'kill' && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm leading-6 text-red-100">
          대상 플레이어의 생존 상태를 런타임에서 사망으로 변경합니다.
        </div>
      )}

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
