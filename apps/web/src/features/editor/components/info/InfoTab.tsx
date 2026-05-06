import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";

import {
  useEditorCharacters,
  useEditorClues,
  useEditorLocations,
} from "@/features/editor/api";
import {
  useCreateStoryInfo,
  useDeleteStoryInfo,
  useStoryInfos,
  useUpdateStoryInfo,
  type StoryInfoResponse,
} from "@/features/editor/storyInfoApi";
import type { MediaResponse } from "@/features/editor/mediaApi";
import { Spinner } from "@/shared/components/ui";
import { InfoImageField } from "./InfoImageField";
import { ReferencePicker } from "./ReferencePicker";

interface InfoTabProps {
  themeId: string;
}

type RefKind = "character" | "clue" | "location";

export function InfoTab({ themeId }: InfoTabProps) {
  const { data: infos = [], isLoading, isError, refetch } = useStoryInfos(themeId);
  const createInfo = useCreateStoryInfo(themeId);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sortedInfos = useMemo(
    () => [...infos].sort((a, b) => a.sortOrder - b.sortOrder),
    [infos],
  );
  const selected = sortedInfos.find((info) => info.id === selectedId) ?? sortedInfos[0] ?? null;

  async function handleCreate() {
    setCreateError(null);
    try {
      const created = await createInfo.mutateAsync({
        title: "새 스토리 정보",
        body: "",
        imageMediaId: null,
        relatedCharacterIds: [],
        relatedClueIds: [],
        relatedLocationIds: [],
        sortOrder: sortedInfos.length,
      });
      setSelectedId(created.id);
    } catch (err) {
      setCreateError(errorMessage(err, "정보 생성에 실패했습니다"));
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
                <span className="mt-1 block line-clamp-2 text-xs text-slate-500">
                  {info.body || "본문 없음"}
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
  const [draft, setDraft] = useState(() => ({ ...info }));
  const [baseline, setBaseline] = useState(() => ({ ...info }));
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const updateInfo = useUpdateStoryInfo(themeId);
  const deleteInfo = useDeleteStoryInfo(themeId);
  const { data: characters = [] } = useEditorCharacters(themeId);
  const { data: clues = [] } = useEditorClues(themeId);
  const { data: locations = [] } = useEditorLocations(themeId);

  useEffect(() => {
    setDraft({ ...info });
    setBaseline({ ...info });
  }, [info]);

  const isDirty = hasEditableChanges(draft, baseline);

  function patchRefs(kind: RefKind, id: string, checked: boolean) {
    const key =
      kind === "character"
        ? "relatedCharacterIds"
        : kind === "clue"
          ? "relatedClueIds"
          : "relatedLocationIds";
    setDraft((current) => {
      const currentIds = current[key];
      const nextIds = checked
        ? Array.from(new Set([...currentIds, id]))
        : currentIds.filter((item) => item !== id);
      return { ...current, [key]: nextIds };
    });
  }

  async function handleSave() {
    setError(null);
    try {
      const saved = await updateInfo.mutateAsync({
        id: info.id,
        patch: {
          title: draft.title,
          body: draft.body,
          imageMediaId: draft.imageMediaId ?? null,
          relatedCharacterIds: draft.relatedCharacterIds,
          relatedClueIds: draft.relatedClueIds,
          relatedLocationIds: draft.relatedLocationIds,
          sortOrder: draft.sortOrder,
          version: draft.version,
        },
      });
      setDraft({ ...saved });
      setBaseline({ ...saved });
    } catch (err) {
      setError(errorMessage(err, "저장에 실패했습니다"));
    }
  }

  async function handleDelete() {
    if (!window.confirm(`"${info.title}" 정보를 삭제하시겠습니까?`)) return;
    try {
      await deleteInfo.mutateAsync(info.id);
    } catch (err) {
      setError(errorMessage(err, "삭제에 실패했습니다"));
    }
  }

  function handleImageSelect(media: MediaResponse) {
    setDraft((current) => ({ ...current, imageMediaId: media.id }));
  }

  return (
    <section className="space-y-4 rounded border border-slate-800 bg-slate-950 p-4">
      {error && (
        <div className="rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </div>
      )}

      <label className="block text-xs text-slate-400">
        제목
        <input
          aria-label="정보 제목"
          value={draft.title}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
        />
      </label>

      <label className="block text-xs text-slate-400">
        본문
        <textarea
          aria-label="정보 본문"
          value={draft.body}
          onChange={(event) => setDraft({ ...draft, body: event.target.value })}
          rows={8}
          className="mt-1 w-full resize-y rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
        />
      </label>

      <InfoImageField
        themeId={themeId}
        imageMediaId={draft.imageMediaId}
        pickerOpen={imagePickerOpen}
        onOpenPicker={() => setImagePickerOpen(true)}
        onClosePicker={() => setImagePickerOpen(false)}
        onSelect={handleImageSelect}
        onClear={() => setDraft({ ...draft, imageMediaId: null })}
      />

      <ReferencePicker
        title="관련 등장인물"
        items={characters.map((character) => ({ id: character.id, name: character.name }))}
        selectedIds={draft.relatedCharacterIds}
        onToggle={(id, checked) => patchRefs("character", id, checked)}
      />
      <ReferencePicker
        title="관련 단서"
        items={clues.map((clue) => ({ id: clue.id, name: clue.name }))}
        selectedIds={draft.relatedClueIds}
        onToggle={(id, checked) => patchRefs("clue", id, checked)}
      />
      <ReferencePicker
        title="관련 장소"
        items={locations.map((location) => ({ id: location.id, name: location.name }))}
        selectedIds={draft.relatedLocationIds}
        onToggle={(id, checked) => patchRefs("location", id, checked)}
      />

      <div className="flex items-center justify-between border-t border-slate-800 pt-3">
        <button
          type="button"
          onClick={() => void handleDelete()}
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
          {updateInfo.isPending ? "저장 중..." : "저장"}
        </button>
      </div>
    </section>
  );
}

function sameIds(a: string[], b: string[]) {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

function hasEditableChanges(current: StoryInfoResponse, baseline: StoryInfoResponse) {
  return (
    current.title !== baseline.title ||
    current.body !== baseline.body ||
    (current.imageMediaId ?? null) !== (baseline.imageMediaId ?? null) ||
    !sameIds(current.relatedCharacterIds, baseline.relatedCharacterIds) ||
    !sameIds(current.relatedClueIds, baseline.relatedClueIds) ||
    !sameIds(current.relatedLocationIds, baseline.relatedLocationIds) ||
    current.sortOrder !== baseline.sortOrder
  );
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback;
}
