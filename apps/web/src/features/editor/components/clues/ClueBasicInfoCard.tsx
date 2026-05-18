import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { ClueResponse, UpdateClueRequest } from '@/features/editor/api';
import { ImageMediaReferenceField } from '@/features/editor/components/media/ImageMediaReferenceField';
import {
  buildClueUsePayload,
  formatClueConsumeLabel,
  toClueEditorViewModel,
} from '@/features/editor/entities/clue/clueEntityAdapter';
import {
  readCluePolicy,
  readClueItemEffect,
  writeCluePolicy,
  type EditorConfig,
} from '@/features/editor/utils/configShape';
import {
  readDeckInvestigationConfig,
  writeDeckInvestigationConfig,
  type InvestigationTokenDraft,
} from '@/features/editor/entities/deckInvestigation/deckInvestigationAdapter';
import {
  writeLocationClueInvestigationCost,
  type InvestigationCostDraft,
} from '@/features/editor/entities/deckInvestigation/locationClueInvestigationCost';
import type {
  ProgressNodeRevealOption,
} from '@/features/editor/entities/reveal/revealTimingOptions';
import { SceneSelectField } from '@/features/editor/components/SceneSelectField';
import { InvestigationCostSelector } from '@/features/editor/components/design/InvestigationCostSelector';

export interface ClueInvestigationCostSettings {
  enabled: boolean;
  tokens: InvestigationTokenDraft[];
  cost: InvestigationCostDraft | null;
  locationId: string | null;
  locationName: string | null;
  requiredClueIds: string[];
}

interface ClueBasicInfoCardProps {
  themeId: string;
  clue: ClueResponse;
  configJson: EditorConfig | null | undefined;
  isSaving?: boolean;
  isConfigSaving?: boolean;
  sceneOptions?: ProgressNodeRevealOption[];
  investigationSettings?: ClueInvestigationCostSettings;
  onDelete: (clue: ClueResponse) => void;
  onDraftStateChange?: (state: ClueBasicInfoDraftState) => void;
  onAutoSaveFlush?: () => void;
}

interface DraftState {
  name: string;
  description: string;
  imageUrl: string;
  imageMediaId: string | null;
  isCommon: boolean;
  isRevealable: boolean;
  isProtected: boolean;
  revealSceneId: string | null;
  hideSceneId: string | null;
  investigationCost: InvestigationCostDraft | null;
}

export interface ClueBasicInfoDraftState {
  dirty: boolean;
  valid: boolean;
}

export interface ClueBasicInfoSaveRequest {
  valid: boolean;
  dirty: boolean;
  rowDirty: boolean;
  configDirty: boolean;
  body: UpdateClueRequest | null;
  writeConfig: (baseConfig: EditorConfig | null | undefined) => EditorConfig;
}

export interface ClueBasicInfoCardHandle {
  getSaveRequest: () => ClueBasicInfoSaveRequest;
}

function toDraft(
  clue: ClueResponse,
  configJson: EditorConfig | null | undefined,
  investigationSettings?: ClueInvestigationCostSettings,
): DraftState {
  const policy = readCluePolicy(configJson, clue.id);
  return {
    name: clue.name,
    description: clue.description ?? '',
    imageUrl: clue.image_url ?? '',
    imageMediaId: clue.image_media_id ?? null,
    isCommon: clue.is_common,
    isRevealable: clue.is_common ? true : policy.revealable,
    isProtected: policy.protected,
    revealSceneId: clue.reveal_scene_id ?? null,
    hideSceneId: clue.hide_scene_id ?? null,
    investigationCost: investigationSettings?.cost ?? null,
  };
}

function isDirty(
  draft: DraftState,
  clue: ClueResponse,
  configJson: EditorConfig | null | undefined,
  investigationSettings?: ClueInvestigationCostSettings,
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
    draft.revealSceneId !== (clue.reveal_scene_id ?? null) ||
    draft.hideSceneId !== (clue.hide_scene_id ?? null) ||
    isInvestigationCostDirty(draft, investigationSettings)
  );
}

function validate(draft: DraftState): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = draft.name.trim();
  if (!name) errors.name = '이름은 필수입니다';
  if (name.length > 100) errors.name = '이름은 100자 이하여야 합니다';
  if (draft.description.length > 2000) errors.description = '설명은 2000자 이하여야 합니다';
  return errors;
}

function buildUpdateBody(clue: ClueResponse, draft: DraftState): UpdateClueRequest {
  const imageMediaChanged = draft.imageMediaId !== (clue.image_media_id ?? null);
  const imageUrl = draft.imageMediaId
    ? imageMediaChanged
      ? ''
      : (clue.image_url ?? undefined)
    : clue.image_url && draft.imageUrl === ''
      ? ''
      : draft.imageUrl || undefined;

  return buildClueUsePayload({
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
    reveal_round: null,
    hide_round: null,
    reveal_scene_id: draft.revealSceneId,
    hide_scene_id: draft.hideSceneId,
  });
}

function isRowDirty(draft: DraftState, clue: ClueResponse): boolean {
  return (
    draft.name !== clue.name ||
    draft.description !== (clue.description ?? '') ||
    draft.imageUrl !== (clue.image_url ?? '') ||
    draft.imageMediaId !== (clue.image_media_id ?? null) ||
    draft.isCommon !== clue.is_common ||
    draft.revealSceneId !== (clue.reveal_scene_id ?? null) ||
    draft.hideSceneId !== (clue.hide_scene_id ?? null)
  );
}

function isPolicyDirty(
  draft: DraftState,
  clue: ClueResponse,
  configJson: EditorConfig | null | undefined
): boolean {
  const policy = readCluePolicy(configJson, clue.id);
  return (
    (!draft.isCommon && draft.isRevealable !== policy.revealable) ||
    draft.isProtected !== policy.protected
  );
}

function isInvestigationCostDirty(
  draft: DraftState,
  investigationSettings?: ClueInvestigationCostSettings,
): boolean {
  if (!investigationSettings?.enabled || !investigationSettings.locationId) return false;
  return JSON.stringify(draft.investigationCost) !== JSON.stringify(investigationSettings.cost);
}

function parseInvestigationCostKey(value: string): InvestigationCostDraft | null {
  if (value === 'null') return null;
  return JSON.parse(value) as InvestigationCostDraft;
}

export const ClueBasicInfoCard = forwardRef<ClueBasicInfoCardHandle, ClueBasicInfoCardProps>(function ClueBasicInfoCard({
  themeId,
  clue,
  configJson,
  isSaving = false,
  isConfigSaving = false,
  sceneOptions = [],
  investigationSettings,
  onDelete,
  onDraftStateChange,
  onAutoSaveFlush,
}, ref) {
  const [draft, setDraft] = useState<DraftState>(() => toDraft(clue, configJson, investigationSettings));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const view = toClueEditorViewModel(clue);
  const policy = readCluePolicy(configJson, clue.id);
  const runtimeEffect = readClueItemEffect(configJson, clue.id);
  const dirty = isDirty(draft, clue, configJson, investigationSettings);
  const saving = isSaving || isConfigSaving;
  const selectedRevealSceneLabel =
    sceneOptions.find((option) => option.value === draft.revealSceneId)?.label ?? '처음부터';
  const selectedHideSceneLabel =
    sceneOptions.find((option) => option.value === draft.hideSceneId)?.label ?? '계속 획득 가능';
  const investigationCostKey = JSON.stringify(investigationSettings?.cost ?? null);

  useEffect(() => {
    setDraft({
      name: clue.name,
      description: clue.description ?? '',
      imageUrl: clue.image_url ?? '',
      imageMediaId: clue.image_media_id ?? null,
      isCommon: clue.is_common,
      isRevealable: clue.is_common ? true : policy.revealable,
      isProtected: policy.protected,
      revealSceneId: clue.reveal_scene_id ?? null,
      hideSceneId: clue.hide_scene_id ?? null,
      investigationCost: parseInvestigationCostKey(investigationCostKey),
    });
    setErrors({});
  }, [
    clue.id,
    clue.name,
    clue.description,
    clue.image_url,
    clue.image_media_id,
    clue.is_common,
    clue.reveal_scene_id,
    clue.hide_scene_id,
    policy.revealable,
    policy.protected,
    investigationCostKey,
    investigationSettings?.enabled,
    investigationSettings?.locationId,
  ]);

  function patch(next: Partial<DraftState>) {
    setDraft((current) => {
      const patched = { ...current, ...next };
      if (next.isCommon === true) patched.isRevealable = true;
      return patched;
    });
  }

  function buildSaveRequest(): ClueBasicInfoSaveRequest {
    const nextErrors = validate(draft);
    setErrors(nextErrors);
    const rowDirty = isRowDirty(draft, clue);
    const policyDirty = isPolicyDirty(draft, clue, configJson);
    const investigationCostDirty = isInvestigationCostDirty(draft, investigationSettings);
    const configDirty = policyDirty || investigationCostDirty;
    return {
      valid: Object.keys(nextErrors).length === 0,
      dirty: rowDirty || configDirty,
      rowDirty,
      configDirty,
      body: rowDirty ? buildUpdateBody(clue, draft) : null,
      writeConfig: (baseConfig) => {
        let next = policyDirty
          ? writeCluePolicy(baseConfig, clue.id, {
              revealable: draft.isCommon ? true : draft.isRevealable,
              protected: draft.isProtected,
            })
          : (baseConfig ?? {});
        if (
          investigationSettings?.enabled &&
          investigationSettings.locationId &&
          draft.investigationCost
        ) {
          next = writeDeckInvestigationConfig(
            next,
            writeLocationClueInvestigationCost(readDeckInvestigationConfig(next), {
              locationId: investigationSettings.locationId,
              locationName: investigationSettings.locationName ?? '배치된 장소',
              clueId: clue.id,
              clueName: draft.name.trim() || clue.name,
              requiredClueIds: investigationSettings.requiredClueIds,
              cost: draft.investigationCost,
            }),
          );
        }
        return next;
      },
    };
  }

  useImperativeHandle(ref, () => ({
    getSaveRequest: buildSaveRequest,
  }));

  useEffect(() => {
    onDraftStateChange?.({
      dirty: dirty,
      valid: Object.keys(validate(draft)).length === 0,
    });
  }, [dirty, draft, onDraftStateChange]);

  return (
    <article
      className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"
      onBlurCapture={onAutoSaveFlush}
    >
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
          <SceneSelectField
            label="공개 시점"
            selectedId={draft.revealSceneId}
            options={sceneOptions}
            emptyLabel="처음부터"
            disabled={saving}
            onChange={(sceneId) => patch({ revealSceneId: sceneId })}
          />
          <SceneSelectField
            label="획득 가능 종료"
            selectedId={draft.hideSceneId}
            options={sceneOptions}
            emptyLabel="계속 획득 가능"
            disabled={saving}
            onChange={(sceneId) => patch({ hideSceneId: sceneId })}
          />
        </div>
        <p className="-mt-2 text-xs leading-5 text-slate-500">
          획득 가능 종료는 새로 얻을 수 있는 기간의 끝을 표시합니다. 이미 플레이어가 가진
          단서를 단서함에서 회수하지는 않습니다.
        </p>

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

        {investigationSettings?.enabled ? (
          <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-slate-200">조사권 소비</p>
              <p className="text-xs leading-5 text-slate-500">
                이 단서를 조사할 때 필요한 조사권 수량입니다.
              </p>
            </div>
            {investigationSettings.locationId && draft.investigationCost ? (
              <div className="mt-3">
                <p className="text-xs text-slate-500">
                  배치 장소: <span className="text-slate-300">{investigationSettings.locationName ?? '배치된 장소'}</span>
                </p>
                <InvestigationCostSelector
                  clueName={draft.name.trim() || clue.name}
                  cost={draft.investigationCost}
                  tokens={investigationSettings.tokens}
                  disabled={saving}
                  manageHref={`/editor/${themeId}/design/modules`}
                  onChange={(cost) => patch({ investigationCost: cost })}
                />
              </div>
            ) : (
              <p className="mt-3 rounded-lg border border-dashed border-slate-800 px-3 py-4 text-xs leading-5 text-slate-500">
                장소에 배치된 단서만 조사권 소비량을 설정할 수 있습니다.
              </p>
            )}
          </section>
        ) : null}

      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <InfoBlock title="공개 범위" value={view.publicScopeLabel} />
        <InfoBlock title="공개 시점" value={selectedRevealSceneLabel} />
        <InfoBlock title="획득 가능 종료" value={selectedHideSceneLabel} />
        <InfoBlock title="사용 후 처리" value={formatClueConsumeLabel(clue, runtimeEffect)} />
      </div>
    </article>
  );
});

function InfoBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
      <p className="text-xs font-semibold text-slate-500">{title}</p>
      <p className="mt-1 text-sm text-slate-200">{value}</p>
    </div>
  );
}
