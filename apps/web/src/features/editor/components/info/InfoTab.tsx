import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Save, Trash2, X } from 'lucide-react';

import {
  useCreateStoryInfo,
  useDeleteStoryInfo,
  useStoryInfos,
  useUpdateStoryInfo,
  type StoryInfoResponse,
} from '@/features/editor/storyInfoApi';
import type { MediaType } from '@/features/editor/mediaApi';
import { normalizeLegacyEscapedMarkdown } from '@/features/editor/components/content/legacyMarkdown';
import { ConfirmDialog, Spinner } from '@/shared/components/ui';
import { InfoDeliverySettingsCard } from './InfoDeliverySettingsCard';
import { InfoBodyPreview } from './InfoBodyPreview';
import { InfoMarkdownEditor } from './InfoMarkdownEditor';
import { useAutosavedDraft } from '@/features/editor/hooks/useAutosavedDraft';

interface InfoTabProps {
  themeId: string;
}

const INFO_EDITOR_ERROR_AUTO_DISMISS_MS = 6000;

export function InfoTab({ themeId }: InfoTabProps) {
  const { data: infos = [], isLoading, isError, refetch } = useStoryInfos(themeId);
  const createInfo = useCreateStoryInfo(themeId);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sortedInfos = useMemo(() => [...infos].sort((a, b) => a.sortOrder - b.sortOrder), [infos]);
  const selected = sortedInfos.find((info) => info.id === selectedId) ?? sortedInfos[0] ?? null;

  async function handleCreate() {
    setCreateError(null);
    try {
      const created = await createInfo.mutateAsync({
        title: '새 스토리 정보',
        body: '',
        imageMediaId: null,
        relatedCharacterIds: [],
        relatedClueIds: [],
        relatedLocationIds: [],
        sortOrder: sortedInfos.length,
      });
      setSelectedId(created.id);
    } catch (err) {
      setCreateError(errorMessage(err, '정보 생성에 실패했습니다'));
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center" role="status">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center">
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded border border-rose-500/40 px-3 py-2 text-sm text-rose-200"
        >
          정보 목록 다시 불러오기
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">정보 관리</h2>
          <p className="mt-1 text-xs text-slate-400">
            장면에서 공개할 정보를 대사와 분리해 카드로 관리합니다.
          </p>
          {createError && (
            <p className="mt-2 text-xs text-rose-300" role="alert">
              {createError}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={createInfo.isPending}
          className="flex items-center gap-2 rounded bg-amber-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500"
        >
          <Plus className="h-4 w-4" />
          정보 추가
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:flex-row lg:overflow-hidden">
        <aside className="w-full shrink-0 space-y-2 lg:w-80 lg:overflow-y-auto">
          {sortedInfos.length === 0 ? (
            <p className="rounded border border-dashed border-slate-700 p-4 text-center text-xs text-slate-500">
              공개 정보가 없습니다
            </p>
          ) : (
            sortedInfos.map((info) => (
              <button
                key={info.id}
                type="button"
                onClick={() => setSelectedId(info.id)}
                aria-pressed={selected?.id === info.id}
                className="w-full rounded border border-slate-800 bg-slate-900 p-3 text-left transition hover:border-slate-600 aria-pressed:border-amber-400"
              >
                <span className="block truncate text-sm font-medium text-slate-100">
                  {info.title}
                </span>
              </button>
            ))
          )}
        </aside>

        <main className="min-h-0 flex-1 overflow-visible lg:overflow-y-auto">
          {selected ? (
            <InfoEditor key={selected.id} themeId={themeId} info={selected} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              정보를 추가하면 여기에 편집 화면이 표시됩니다.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function InfoEditor({ themeId, info }: { themeId: string; info: StoryInfoResponse }) {
  const [embedPickerType, setEmbedPickerType] = useState<MediaType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(() => !hasDisplayableBody(info));
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const exitEditModeAfterSaveRef = useRef(false);
  const updateInfo = useUpdateStoryInfo(themeId);
  const deleteInfo = useDeleteStoryInfo(themeId);
  const toInfoDraft = useCallback((value: StoryInfoResponse) => toEditableInfo(value), []);
  const isSameInfoDraft = useCallback(
    (left: StoryInfoResponse, right: StoryInfoResponse) => !hasEditableChanges(left, right),
    [],
  );
  const saveInfo = useCallback(
    (body: StoryInfoResponse) =>
      updateInfo.mutateAsync({
        id: info.id,
        patch: {
          title: body.title,
          body: body.body,
          imageMediaId: body.imageMediaId ?? null,
          relatedCharacterIds: body.relatedCharacterIds,
          relatedClueIds: body.relatedClueIds,
          relatedLocationIds: body.relatedLocationIds,
          sortOrder: body.sortOrder,
          version: body.version,
        },
      }),
    [info.id, updateInfo],
  );
  const buildInfoSaveBody = useCallback((current: StoryInfoResponse) => current, []);
  const mergeSavedInfoDraft = useCallback(
    ({
      currentDraft,
      savedDraft,
      submittedDraft,
    }: {
      currentDraft: StoryInfoResponse;
      savedDraft: StoryInfoResponse;
      submittedDraft: StoryInfoResponse;
    }) =>
      hasEditableChanges(currentDraft, submittedDraft)
        ? { ...currentDraft, version: savedDraft.version }
        : savedDraft,
    [],
  );
  const {
    draft,
    setDraft,
    baseline,
    isDirty,
    saveNow: saveInfoNow,
  } = useAutosavedDraft<StoryInfoResponse, StoryInfoResponse, StoryInfoResponse>({
    serverValue: info,
    serverKey: info.id,
    debounceMs: 1000,
    toDraft: toInfoDraft,
    isEqual: isSameInfoDraft,
    buildSaveBody: buildInfoSaveBody,
    save: saveInfo,
    mergeSavedDraft: mergeSavedInfoDraft,
    messages: {
      toastId: `story-info-autosave-${info.id}`,
      loading: '정보를 저장 중입니다',
      success: '정보가 저장되었습니다',
      error: '정보 저장에 실패했습니다',
    },
    onSaved: (saved) => {
      const editableSaved = toEditableInfo(saved);
      if (exitEditModeAfterSaveRef.current) {
        setIsEditing(!hasDisplayableBody(editableSaved));
        exitEditModeAfterSaveRef.current = false;
      }
    },
    onError: (err) => {
      exitEditModeAfterSaveRef.current = false;
      setError(errorMessage(err, '저장에 실패했습니다'));
    },
  });

  useEffect(() => {
    if (!error) return undefined;
    const timeout = window.setTimeout(() => setError(null), INFO_EDITOR_ERROR_AUTO_DISMISS_MS);
    return () => window.clearTimeout(timeout);
  }, [error]);

  function updateDraft(patch: Partial<StoryInfoResponse>) {
    setError(null);
    setDraft((current) => ({ ...current, ...patch }));
  }

  async function handleSave() {
    setError(null);
    if (!isDirty) return;
    exitEditModeAfterSaveRef.current = true;
    saveInfoNow();
  }

  async function handleDelete() {
    try {
      await deleteInfo.mutateAsync(info.id);
      setDeleteDialogOpen(false);
    } catch (err) {
      setError(errorMessage(err, '삭제에 실패했습니다'));
      setDeleteDialogOpen(false);
    }
  }

  const deleteDialog = (
    <ConfirmDialog
      isOpen={deleteDialogOpen}
      title="정보를 삭제할까요?"
      description={`"${info.title}" 정보를 삭제합니다.`}
      confirmLabel="정보 삭제"
      isConfirming={deleteInfo.isPending}
      tone="danger"
      onCancel={() => setDeleteDialogOpen(false)}
      onConfirm={() => void handleDelete()}
    />
  );

  if (!isEditing) {
    return (
      <>
        <div className="space-y-4">
          <InfoBodyPreview
            themeId={themeId}
            info={baseline}
            error={error}
            deletePending={deleteInfo.isPending}
            onEdit={() => setIsEditing(true)}
            onDelete={() => setDeleteDialogOpen(true)}
          />
          <InfoDeliverySettingsCard themeId={themeId} storyInfoId={info.id} />
        </div>
        {deleteDialog}
      </>
    );
  }

  return (
    <>
      <section className="min-h-full">
        <div className="space-y-4 rounded border border-slate-800 bg-slate-950 p-4">
          {error && (
            <div
              className="flex items-start justify-between gap-3 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
              role="alert"
            >
              <span>{error}</span>
              <button
                type="button"
                aria-label="오류 메시지 닫기"
                onClick={() => setError(null)}
                className="shrink-0 rounded p-0.5 text-rose-200 hover:bg-rose-500/20"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <label className="block text-xs text-slate-400">
            제목
            <input
              aria-label="정보 제목"
              value={draft.title}
              onChange={(event) => updateDraft({ title: event.target.value })}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
          </label>

          <div className="space-y-1">
            <span className="block text-xs text-slate-400">본문</span>
            <InfoMarkdownEditor
              themeId={themeId}
              markdown={draft.body}
              onChange={(body) => updateDraft({ body })}
              pickerType={embedPickerType}
              onOpenPicker={setEmbedPickerType}
              onClosePicker={() => setEmbedPickerType(null)}
            />
          </div>

          <div className="flex items-center justify-between border-t border-slate-800 pt-3">
            <button
              type="button"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={deleteInfo.isPending}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-rose-400 hover:bg-rose-500/10"
            >
              <Trash2 className="h-3 w-3" />
              정보 삭제
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!isDirty || updateInfo.isPending}
              className="flex items-center gap-1 rounded bg-amber-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500"
            >
              <Save className="h-4 w-4" />
              {updateInfo.isPending ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
        <div className="mt-4">
          <InfoDeliverySettingsCard themeId={themeId} storyInfoId={info.id} />
        </div>
      </section>
      {deleteDialog}
    </>
  );
}

function toEditableInfo(info: StoryInfoResponse) {
  return { ...info, body: normalizeLegacyEscapedMarkdown(info.body) };
}

function hasDisplayableBody(info: StoryInfoResponse) {
  return info.body.trim().length > 0;
}

function hasEditableChanges(current: StoryInfoResponse, baseline: StoryInfoResponse) {
  return (
    current.title !== baseline.title ||
    current.body !== baseline.body ||
    current.sortOrder !== baseline.sortOrder
  );
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback;
}
