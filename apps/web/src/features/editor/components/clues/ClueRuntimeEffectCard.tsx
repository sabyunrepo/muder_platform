import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Eye, FileText, Gift, Search, Shuffle, TriangleAlert } from 'lucide-react';
import type { ClueResponse } from '@/features/editor/api';
import {
  readClueItemEffect,
  writeClueItemEffect,
  type ClueItemEffectConfig,
  type EditorConfig,
} from '@/features/editor/utils/configShape';
import { ClueSearchMultiSelect, type ClueSearchSelectItem } from '@/features/editor/components/design/ClueSearchMultiSelect';

type EffectMode = 'description' | 'reveal' | 'grant' | 'peek' | 'steal' | 'kill';

interface ClueRuntimeEffectCardProps {
  clue: ClueResponse;
  clues: ClueResponse[];
  configJson: EditorConfig | null | undefined;
  isPlayerKillEnabled: boolean;
  onDraftStateChange?: (state: ClueRuntimeEffectDraftState) => void;
  onAutoSaveFlush?: () => void;
}

interface DraftState {
  isUsableItem: boolean;
  usesPassword: boolean;
  mode: EffectMode;
  password: string;
  descriptionText: string;
  revealText: string;
  grantClueIds: string[];
  attackPower: number;
  defensePower: number;
  consume: boolean;
}

export interface ClueRuntimeEffectDraftState {
  dirty: boolean;
  valid: boolean;
}

export interface ClueRuntimeEffectSaveRequest {
  dirty: boolean;
  valid: boolean;
  writeConfig: (baseConfig: EditorConfig | null | undefined) => EditorConfig;
}

export interface ClueRuntimeEffectCardHandle {
  getSaveRequest: () => ClueRuntimeEffectSaveRequest;
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
  const base = {
    isUsableItem: !!config,
    usesPassword: password.trim().length > 0,
    password,
    consume: config?.consume === true,
    attackPower: normalizePower(config?.attackPower ?? 0),
    defensePower: normalizePower(config?.defensePower ?? 0),
  };

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
    isUsableItem: false,
    usesPassword: false,
    mode: 'description',
    password: '',
    descriptionText: '',
    revealText: '',
    grantClueIds: [],
    attackPower: 0,
    defensePower: 0,
    consume: false,
  };
}

function normalizePower(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function passwordCondition(draft: DraftState): EditorConfig & {
  condition?: { kind: 'password'; value: string };
} {
  if (!draft.usesPassword) return {};
  const password = draft.password.trim();
  return {
    condition: { kind: 'password' as const, value: password },
  };
}

function powerConfig(draft: DraftState): Pick<ClueItemEffectConfig, 'attackPower' | 'defensePower'> {
  const attackPower = normalizePower(draft.attackPower);
  const defensePower = normalizePower(draft.defensePower);
  return {
    ...(attackPower > 0 ? { attackPower } : {}),
    ...(defensePower > 0 ? { defensePower } : {}),
  };
}

function toEffectConfig(draft: DraftState): ClueItemEffectConfig | null {
  if (!draft.isUsableItem) return null;
  if (draft.mode === 'description') {
    return {
      effect: 'description_change',
      target: 'self',
      ...passwordCondition(draft),
      ...powerConfig(draft),
      descriptionText: draft.descriptionText.trim(),
      consume: draft.consume,
    };
  }
  if (draft.mode === 'reveal') {
    return {
      effect: 'reveal',
      target: 'self',
      ...passwordCondition(draft),
      ...powerConfig(draft),
      revealText: draft.revealText.trim(),
      consume: draft.consume,
    };
  }
  if (draft.mode === 'grant') {
    return {
      effect: 'grant_clue',
      target: 'self',
      ...passwordCondition(draft),
      ...powerConfig(draft),
      grantClueIds: draft.grantClueIds,
      consume: draft.consume,
    };
  }
  if (draft.mode === 'peek') {
    return {
      effect: 'peek',
      target: 'player',
      ...passwordCondition(draft),
      ...powerConfig(draft),
      consume: draft.consume,
    };
  }
  if (draft.mode === 'kill') {
    return {
      effect: 'kill',
      target: 'player',
      ...passwordCondition(draft),
      ...powerConfig(draft),
      consume: draft.consume,
    };
  }
  return {
    effect: 'steal',
    target: 'player',
    ...passwordCondition(draft),
    ...powerConfig(draft),
    consume: draft.consume,
  };
}

function isDraftValid(draft: DraftState) {
  if (!draft.isUsableItem) return true;
  if (draft.usesPassword && draft.password.trim().length === 0) return false;
  if (draft.mode === 'description') return draft.descriptionText.trim().length > 0;
  if (draft.mode === 'reveal') return draft.revealText.trim().length > 0;
  if (draft.mode === 'grant') return draft.grantClueIds.length > 0;
  return true;
}

function sameEffectConfig(left: ClueItemEffectConfig | null, right: ClueItemEffectConfig | null) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

export const ClueRuntimeEffectCard = forwardRef<ClueRuntimeEffectCardHandle, ClueRuntimeEffectCardProps>(function ClueRuntimeEffectCard({
  clue,
  clues,
  configJson,
  isPlayerKillEnabled,
  onDraftStateChange,
  onAutoSaveFlush,
}, ref) {
  const savedEffect = useMemo(
    () => readClueItemEffect(configJson, clue.id),
    [configJson, clue.id],
  );
  const [draft, setDraft] = useState<DraftState>(() => draftFromConfig(savedEffect));

  useEffect(() => {
    setDraft(draftFromConfig(savedEffect));
  }, [savedEffect]);

  const grantClueItems = useMemo(
    () =>
      clues
        .filter((item) => item.id !== clue.id)
        .map((item): ClueSearchSelectItem => ({
          id: item.id,
          name: item.name,
          meta: item.is_common ? '공용 단서' : item.location_id ? '장소 단서' : '미배치',
          badge: typeof item.reveal_round === 'number' ? `R${item.reveal_round}` : 'CL',
        })),
    [clue.id, clues],
  );

  const draftEffect = useMemo(() => toEffectConfig(draft), [draft]);
  const savedComparableEffect = useMemo(
    () => toEffectConfig(draftFromConfig(savedEffect)),
    [savedEffect],
  );
  const dirty = !sameEffectConfig(draftEffect, savedComparableEffect);
  const valid = isDraftValid(draft);

  function updateDraft(patch: Partial<DraftState>) {
    setDraft((current) => {
      const next = { ...current, ...patch };
      if (patch.isUsableItem === false) {
        next.usesPassword = false;
        next.password = '';
      }
      if (patch.usesPassword === false) {
        next.password = '';
      }
      return next;
    });
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

  useImperativeHandle(ref, () => ({
    getSaveRequest: () => ({
      dirty,
      valid,
      writeConfig: (baseConfig) => writeClueItemEffect(baseConfig, clue.id, draftEffect),
    }),
  }));

  useEffect(() => {
    onDraftStateChange?.({ dirty, valid });
  }, [dirty, draftEffect, onDraftStateChange, valid]);

  return (
    <section
      className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"
      onBlurCapture={onAutoSaveFlush}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-300/70">
            단서 사용 설정
          </p>
          <h4 className="mt-1 text-lg font-bold text-slate-100">사용 가능한 아이템과 실행 조건을 정합니다</h4>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            단서를 읽기만 하게 둘지, 플레이어가 사용해서 효과를 실행하게 할지 선택합니다.
          </p>
        </div>
      </div>

      <label className="mt-4 flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-300">
        <input
          type="checkbox"
          aria-label="사용 가능한 아이템"
          checked={draft.isUsableItem}
          onChange={(e) => updateDraft({ isUsableItem: e.target.checked })}
          className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        />
        <span>
          <span className="font-semibold text-slate-200">사용 가능한 아이템</span>
          <span className="mt-1 block text-xs leading-5 text-slate-500">
            플레이어가 이 단서를 눌러 효과를 실행할 수 있게 합니다.
          </span>
        </span>
      </label>

      {draft.isUsableItem && (
        <div className="mt-4 space-y-4">
          <fieldset className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <legend className="mb-2 text-sm font-semibold text-slate-200">아이템 사용 시</legend>
            <EffectChoice mode="description" current={draft.mode} label="설명 변경" icon={<FileText className="h-4 w-4" />} onSelect={() => updateDraft({ mode: 'description' })} />
            <EffectChoice mode="reveal" current={draft.mode} label="정보 공개" icon={<Eye className="h-4 w-4" />} onSelect={() => updateDraft({ mode: 'reveal' })} />
            <EffectChoice mode="grant" current={draft.mode} label="새 단서 지급" icon={<Gift className="h-4 w-4" />} onSelect={() => updateDraft({ mode: 'grant' })} />
            <EffectChoice mode="peek" current={draft.mode} label="단서 훔쳐보기" icon={<Search className="h-4 w-4" />} onSelect={() => updateDraft({ mode: 'peek' })} />
            <EffectChoice mode="steal" current={draft.mode} label="단서 가져오기" icon={<Shuffle className="h-4 w-4" />} onSelect={() => updateDraft({ mode: 'steal' })} />
            {isPlayerKillEnabled && (
              <EffectChoice mode="kill" current={draft.mode} label="살해 요청" icon={<TriangleAlert className="h-4 w-4" />} onSelect={() => updateDraft({ mode: 'kill' })} />
            )}
          </fieldset>

          <label className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-300">
            <input
              type="checkbox"
              aria-label="암호 사용"
              checked={draft.usesPassword}
              onChange={(e) => updateDraft({ usesPassword: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            />
            <span>
              <span className="font-semibold text-slate-200">암호 사용</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                암호를 맞힌 플레이어만 이 아이템을 사용할 수 있습니다.
              </span>
            </span>
          </label>

          {draft.usesPassword && (
            <label className="block text-sm font-medium text-slate-300">
              사용 암호
              <input
                aria-label="사용 암호"
                value={draft.password}
                onChange={(e) => updateDraft({ password: e.target.value })}
                placeholder="플레이어가 입력해야 하는 암호"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
              />
              {draft.password.trim().length === 0 && (
                <span className="mt-1 block text-xs text-red-400">암호를 입력해야 저장할 수 있습니다.</span>
              )}
            </label>
          )}

          {draft.mode === 'description' && (
            <div className="space-y-2">
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
            <div className="space-y-2">
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
              items={grantClueItems}
              selectedIds={draft.grantClueIds}
              onToggle={toggleGrantClue}
            />
          )}

          {draft.mode === 'kill' && isPlayerKillEnabled && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-3">
              <p className="text-sm leading-6 text-red-100">
                대상 플레이어의 생존 상태를 런타임에서 사망으로 변경합니다.
              </p>
            </div>
          )}

          {isPlayerKillEnabled && (
            <div className="space-y-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-3">
              <p className="text-sm leading-6 text-red-100">
                살해 판정에 사용할 단서 수치입니다. 공격력은 공격자 보유 단서, 방어력은 대상 보유 단서에서 계산됩니다.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <PowerField
                  id="clue-runtime-attack-power"
                  label="공격력"
                  value={draft.attackPower}
                  onChange={(attackPower) => updateDraft({ attackPower })}
                />
                <PowerField
                  id="clue-runtime-defense-power"
                  label="방어력"
                  value={draft.defensePower}
                  onChange={(defensePower) => updateDraft({ defensePower })}
                />
              </div>
            </div>
          )}

          <label className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-300">
            <input
              type="checkbox"
              aria-label="사용하면 내 단서함에서 사라짐"
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
        </div>
      )}
    </section>
  );
});

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

function PowerField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-red-100">
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={0}
        step={1}
        value={value}
        onChange={(e) => onChange(normalizePower(Number(e.target.value)))}
        className="w-full rounded-lg border border-red-500/40 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
      />
    </div>
  );
}

function GrantCluePicker({
  items,
  selectedIds,
  onToggle,
}: {
  items: ClueSearchSelectItem[];
  selectedIds: string[];
  onToggle: (clueId: string) => void;
}) {
  return (
    <div className="mt-4">
      <ClueSearchMultiSelect
        title="지급할 단서"
        items={items}
        selectedIds={selectedIds}
        searchLabel="지급할 단서 검색"
        searchPlaceholder="단서 이름으로 검색"
        emptySelectedText="아직 지급할 단서를 고르지 않았습니다."
        idleSearchText="전체 단서를 펼치지 않고 검색 결과만 보여줍니다. 단서명을 입력하세요."
        resultLimit={8}
        getAddAriaLabel={(item) => `${item.name} 지급 목록에 추가`}
        getRemoveAriaLabel={(item) => `${item.name} 지급 목록에서 제거`}
        onAdd={onToggle}
        onRemove={onToggle}
      />
    </div>
  );
}
