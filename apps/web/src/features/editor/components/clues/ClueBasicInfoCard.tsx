import { useEffect, useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
import type { ClueResponse, UpdateClueRequest } from '@/features/editor/api';
import { ImageMediaReferenceField } from '@/features/editor/components/media/ImageMediaReferenceField';
import { buildClueUsePayload, toClueEditorViewModel } from '@/features/editor/entities/clue/clueEntityAdapter';
import {
  readCluePolicy,
  writeCluePolicy,
  type EditorConfig,
} from '@/features/editor/utils/configShape';
import type { RoundRevealOption } from '@/features/editor/entities/reveal/revealTimingOptions';

interface ClueBasicInfoCardProps {
  themeId: string;
  clue: ClueResponse;
  configJson: EditorConfig | null | undefined;
  isSaving?: boolean;
  isConfigSaving?: boolean;
  roundOptions?: RoundRevealOption[];
  onSave: (clueId: string, body: UpdateClueRequest) => void;
  onConfigChange: (nextConfig: EditorConfig) => void;
  onDelete: (clue: ClueResponse) => void;
}

interface DraftState {
  name: string;
  description: string;
  imageUrl: string;
  imageMediaId: string | null;
  isCommon: boolean;
  isRevealable: boolean;
  isProtected: boolean;
  revealRound: number | null;
  hideRound: number | null;
}

function toDraft(clue: ClueResponse, configJson: EditorConfig | null | undefined): DraftState {
  const policy = readCluePolicy(configJson, clue.id);
  return {
    name: clue.name,
    description: clue.description ?? '',
    imageUrl: clue.image_url ?? '',
    imageMediaId: clue.image_media_id ?? null,
    isCommon: clue.is_common,
    isRevealable: clue.is_common ? true : policy.revealable,
    isProtected: policy.protected,
    revealRound: clue.reveal_round ?? null,
    hideRound: clue.hide_round ?? null,
  };
}

function parseRoundInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}

function isDirty(
  draft: DraftState,
  clue: ClueResponse,
  configJson: EditorConfig | null | undefined
): boolean {
  const policy = readCluePolicy(configJson, clue.id);
  return (
    draft.name !== clue.name ||
    draft.description !== (clue.description ?? '') ||
    draft.imageUrl !== (clue.image_url ?? '') ||
    draft.imageMediaId !== (clue.image_media_id ?? null) ||
    draft.isCommon !== clue.is_common ||
    (!draft.isCommon && draft.isRevealable !== policy.revealable) ||
    draft.isProtected !== policy.protected ||
    draft.revealRound !== (clue.reveal_round ?? null) ||
    draft.hideRound !== (clue.hide_round ?? null)
  );
}

function validate(draft: DraftState): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = draft.name.trim();
  if (!name) errors.name = '이름은 필수입니다';
  if (name.length > 100) errors.name = '이름은 100자 이하여야 합니다';
  if (draft.description.length > 2000) errors.description = '설명은 2000자 이하여야 합니다';
  if (draft.revealRound != null && draft.hideRound != null && draft.revealRound > draft.hideRound) {
    errors.round = '공개 라운드는 사라짐 라운드보다 클 수 없습니다';
  }
  return errors;
}

export function ClueBasicInfoCard({
  themeId,
  clue,
  configJson,
  isSaving = false,
  isConfigSaving = false,
  roundOptions = DEFAULT_CLUE_ROUND_OPTIONS,
  onSave,
  onConfigChange,
  onDelete,
}: ClueBasicInfoCardProps) {
  const [draft, setDraft] = useState<DraftState>(() => toDraft(clue, configJson));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const view = toClueEditorViewModel(clue);
  const policy = readCluePolicy(configJson, clue.id);
  const dirty = isDirty(draft, clue, configJson);
  const saving = isSaving || isConfigSaving;

  useEffect(() => {
    setDraft({
      name: clue.name,
      description: clue.description ?? '',
      imageUrl: clue.image_url ?? '',
      imageMediaId: clue.image_media_id ?? null,
      isCommon: clue.is_common,
      isRevealable: clue.is_common ? true : policy.revealable,
      isProtected: policy.protected,
      revealRound: clue.reveal_round ?? null,
      hideRound: clue.hide_round ?? null,
    });
    setErrors({});
  }, [
    clue.id,
    clue.name,
    clue.description,
    clue.image_url,
    clue.image_media_id,
    clue.is_common,
    clue.reveal_round,
    clue.hide_round,
    policy.revealable,
    policy.protected,
  ]);

  function patch(next: Partial<DraftState>) {
    setDraft((current) => {
      const patched = { ...current, ...next };
      if (next.isCommon === true) patched.isRevealable = true;
      return patched;
    });
  }

  function handleSave() {
    const nextErrors = validate(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const imageUrl = draft.imageMediaId
      ? ''
      : clue.image_url && draft.imageUrl === ''
        ? ''
        : draft.imageUrl || undefined;

    onSave(
      clue.id,
      buildClueUsePayload({
        name: draft.name.trim(),
        description: draft.description || undefined,
        image_url: imageUrl,
        image_media_id: draft.imageMediaId,
        level: clue.level,
        sort_order: clue.sort_order,
        is_common: draft.isCommon,
        is_usable: clue.is_usable,
        use_effect: clue.use_effect ?? undefined,
        use_target: clue.use_target ?? undefined,
        use_consumed: clue.use_consumed,
        reveal_round: draft.revealRound,
        hide_round: draft.hideRound,
      })
    );
    onConfigChange(
      writeCluePolicy(configJson, clue.id, {
        revealable: draft.isCommon ? true : draft.isRevealable,
        protected: draft.isProtected,
      })
    );
  }

  return (
    <article className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-300/70">
            단서 기본 정보
          </p>
          <h3 className="mt-1 text-xl font-bold text-slate-100">{clue.name}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            선택한 단서를 이 화면에서 바로 수정합니다.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-amber-500/30 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-600"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? '저장 중' : '기본 정보 저장'}
          </button>
          <button
            type="button"
            onClick={() => onDelete(clue)}
            aria-label={`${clue.name} 삭제`}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-red-500/20 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            삭제
          </button>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <ImageMediaReferenceField
          themeId={themeId}
          label="단서 이미지"
          imageMediaId={draft.imageMediaId}
          legacyImageUrl={draft.imageUrl || null}
          pickerTitle="단서 이미지 선택"
          emptyLabel="단서 이미지 선택"
          compact
          disabled={isSaving}
          onSelect={(media) => patch({ imageMediaId: media.id, imageUrl: '' })}
          onClear={() => patch({ imageMediaId: null, imageUrl: '' })}
        />

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem]">
          <label className="min-w-0 text-sm font-medium text-slate-300">
            이름
            <input
              value={draft.name}
              onChange={(event) => patch({ name: event.target.value })}
              maxLength={100}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
            />
            {errors.name && <span className="mt-1 block text-xs text-red-400">{errors.name}</span>}
          </label>

          <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={draft.isCommon}
              onChange={(event) => patch({ isCommon: event.target.checked })}
              className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            />
            전체 공개
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className={`flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm ${draft.isCommon ? 'text-slate-500' : 'text-slate-300'}`}>
            <input
              type="checkbox"
              checked={draft.isRevealable}
              disabled={draft.isCommon}
              onChange={(event) => patch({ isRevealable: event.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-800 text-amber-500 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            />
            <span>
              <span className="font-semibold text-slate-200">공개 가능</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                전체 공개가 아닌 단서를 장면, 라운드, 암호, 아이템 효과로 나중에 공개할 수 있게 둡니다.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={draft.isProtected}
              onChange={(event) => patch({ isProtected: event.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            />
            <span>
              <span className="font-semibold text-slate-200">단서 보호</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                보호된 단서는 훔쳐보기와 가져오기 효과의 대상에서 제외됩니다.
              </span>
            </span>
          </label>
        </div>

        <label className="block text-sm font-medium text-slate-300">
          설명
          <textarea
            value={draft.description}
            onChange={(event) => patch({ description: event.target.value })}
            maxLength={2000}
            rows={4}
            placeholder="플레이어에게 보일 단서 설명"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm leading-6 text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
          />
          {errors.description && (
            <span className="mt-1 block text-xs text-red-400">{errors.description}</span>
          )}
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-300">
            공개 시점
            <select
              value={roundSelectValue(draft.revealRound, 'start')}
              onChange={(event) => patch({ revealRound: parseRoundSelect(event.target.value) })}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
            >
              <option value="start">처음부터</option>
              {roundOptions.map((option) => (
                <option key={option.value} value={`round:${option.value}`}>
                  {option.label} 시작
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-300">
            숨김 시점
            <select
              value={roundSelectValue(draft.hideRound, 'end')}
              onChange={(event) => patch({ hideRound: parseRoundSelect(event.target.value) })}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
            >
              <option value="end">끝까지</option>
              {roundOptions.map((option) => (
                <option key={option.value} value={`round:${option.value}`}>
                  {option.label} 종료
                </option>
              ))}
            </select>
          </label>
        </div>
        {errors.round && <p className="text-xs text-red-400">{errors.round}</p>}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <InfoBlock title="공개 범위" value={view.publicScopeLabel} />
        <InfoBlock title="등장 라운드" value={view.roundLabel} />
        <InfoBlock title="사용 후 처리" value={view.consumeLabel} />
      </div>
    </article>
  );
}

function roundSelectValue(value: number | null, emptyValue: 'start' | 'end'): string {
  return value == null ? emptyValue : `round:${value}`;
}

function parseRoundSelect(value: string): number | null {
  if (value === 'start' || value === 'end') return null;
  if (!value.startsWith('round:')) return null;
  return parseRoundInput(value.slice('round:'.length));
}

function InfoBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
      <p className="text-xs font-semibold text-slate-500">{title}</p>
      <p className="mt-1 text-sm text-slate-200">{value}</p>
    </div>
  );
}

const DEFAULT_CLUE_ROUND_OPTIONS = Array.from({ length: 5 }, (_, index) => {
  const round = index + 1;
  return { value: round, label: `${round}라운드` };
});
