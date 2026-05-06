import { useEffect, useMemo, useState } from "react";
import { Music, Plus, Save, Trash2, X } from "lucide-react";

import { queryClient } from "@/services/queryClient";
import { isApiHttpError } from "@/lib/api-error";

import {
  readingKeys,
  useDeleteReadingSection,
  useUpdateReadingSection,
  type ReadingLineDTO,
  type ReadingSectionResponse,
  type UpdateReadingSectionRequest,
} from "../../readingApi";
import { MediaPicker } from "../media/MediaPicker";
import type { MediaResponse } from "../../mediaApi";
import { useMediaList } from "../../mediaApi";
import { ReadingLineRow } from "./ReadingLineRow";
import { EditorSaveConflictBanner } from "../EditorSaveConflictBanner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReadingSectionEditorProps {
  themeId: string;
  section: ReadingSectionResponse;
  characters: Array<{ id: string; name: string }>;
  onDeleted?: () => void;
}

interface DraftState {
  name: string;
  bgmMediaId: string | null;
  lines: ReadingLineDTO[];
  sortOrder: number;
}

function toDraft(section: ReadingSectionResponse): DraftState {
  return {
    name: section.name,
    bgmMediaId: section.bgmMediaId ?? null,
    lines: section.lines.map((l) => ({ ...l })),
    sortOrder: section.sortOrder,
  };
}

/**
 * Recognize an optimistic-lock conflict from the API layer. Uses the
 * structured ApiHttpError thrown by the API client (status 409 is the
 * canonical signal) instead of substring-matching error messages, which is
 * brittle against locale-specific text. Falls back to the legacy substring
 * check only for tests that stub with a plain Error("HTTP 409 Conflict").
 */
function isConflictError(err: unknown): boolean {
  if (!err) return false;
  if (isApiHttpError(err) && err.status === 409) return true;
  // Legacy: tests sometimes throw a plain Error whose message contains the
  // HTTP status. Keep substring fallback narrow — only accept "409" after a
  // word boundary to avoid false positives on unrelated numeric strings.
  const msg =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return /\b409\b/.test(msg) || msg.toLowerCase().includes("conflict");
}

// ---------------------------------------------------------------------------
// ReadingSectionEditor
// ---------------------------------------------------------------------------

export function ReadingSectionEditor({
  themeId,
  section,
  characters,
  onDeleted,
}: ReadingSectionEditorProps) {
  const [draft, setDraft] = useState<DraftState>(() => toDraft(section));
  const [bgmPickerOpen, setBgmPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const updateMutation = useUpdateReadingSection(themeId);
  const deleteMutation = useDeleteReadingSection(themeId);

  // Refresh local draft whenever the underlying section changes (e.g. after
  // a successful save returns a new version, or a refetch).
  useEffect(() => {
    setDraft(toDraft(section));
    setConflict(false);
    setSaveError(null);
  }, [section]);

  // BGM list (BGM filter only) — used to display selected BGM name without
  // an extra fetch when picker is closed.
  const { data: bgmList = [] } = useMediaList(themeId, "BGM");
  const { data: imageList = [] } = useMediaList(themeId, "IMAGE");
  const selectedBgm = useMemo(
    () => bgmList.find((m) => m.id === draft.bgmMediaId) ?? null,
    [bgmList, draft.bgmMediaId],
  );
  const imageById = useMemo(
    () => new Map(imageList.map((media) => [media.id, media])),
    [imageList],
  );

  const isDirty = useMemo(() => {
    if (draft.name !== section.name) return true;
    if ((draft.bgmMediaId ?? null) !== (section.bgmMediaId ?? null)) return true;
    if (draft.sortOrder !== section.sortOrder) return true;
    if (draft.lines.length !== section.lines.length) return true;
    for (let i = 0; i < draft.lines.length; i++) {
      const a = draft.lines[i];
      const b = section.lines[i];
      if (
        a.Index !== b.Index ||
        a.Text !== b.Text ||
        (a.Speaker ?? "") !== (b.Speaker ?? "") ||
        (a.VoiceMediaID ?? "") !== (b.VoiceMediaID ?? "") ||
        (a.ImageMediaID ?? "") !== (b.ImageMediaID ?? "") ||
        (a.AdvanceBy ?? "") !== (b.AdvanceBy ?? "")
      ) {
        return true;
      }
    }
    return false;
  }, [draft, section]);

  // -------------------------------------------------------------------------
  // Line operations
  // -------------------------------------------------------------------------

  function handleAddLine() {
    setDraft((d) => ({
      ...d,
      lines: [
        ...d.lines,
        {
          Index: d.lines.length,
          Text: "",
          Speaker: "",
          VoiceMediaID: "",
          ImageMediaID: "",
          AdvanceBy: "gm",
        },
      ],
    }));
  }

  function handleLineChange(idx: number, next: ReadingLineDTO) {
    setDraft((d) => {
      const lines = d.lines.slice();
      lines[idx] = { ...next, Index: idx };
      return { ...d, lines };
    });
  }

  function handleLineDelete(idx: number) {
    setDraft((d) => {
      const lines = d.lines
        .filter((_, i) => i !== idx)
        .map((l, i) => ({ ...l, Index: i }));
      return { ...d, lines };
    });
  }

  // -------------------------------------------------------------------------
  // BGM operations
  // -------------------------------------------------------------------------

  function handleBgmSelect(media: MediaResponse) {
    setDraft((d) => ({ ...d, bgmMediaId: media.id }));
  }

  function handleBgmClear() {
    setDraft((d) => ({ ...d, bgmMediaId: null }));
  }

  // -------------------------------------------------------------------------
  // Save / Delete
  // -------------------------------------------------------------------------

  async function handleSave() {
    setSaveError(null);
    setConflict(false);

    const patch: UpdateReadingSectionRequest = {
      version: section.version,
      name: draft.name,
      // bgmMediaId uses triple-state: null = clear, string = set, undefined = keep
      bgmMediaId: draft.bgmMediaId,
      lines: draft.lines,
      sortOrder: draft.sortOrder,
    };

    try {
      await updateMutation.mutateAsync({ id: section.id, patch });
    } catch (err) {
      if (isConflictError(err)) {
        setConflict(true);
        return;
      }
      setSaveError(err instanceof Error ? err.message : "저장에 실패했습니다");
    }
  }

  async function handleDelete() {
    try {
      await deleteMutation.mutateAsync(section.id);
      onDeleted?.();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "삭제에 실패했습니다");
      setConfirmDelete(false);
    }
  }

  function handleRefresh() {
    setConflict(false);
    queryClient.invalidateQueries({ queryKey: readingKeys.list(themeId) });
  }

  function handleCopyDraft() {
    const text = JSON.stringify(draft, null, 2);
    void navigator.clipboard?.writeText(text);
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {conflict && (
        <EditorSaveConflictBanner
          scopeLabel="읽기 대사"
          onReload={handleRefresh}
          onPreserve={handleCopyDraft}
          onDismiss={() => setConflict(false)}
        />
      )}

      {saveError && !conflict && (
        <div className="rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {saveError}
        </div>
      )}

      {/* Section name */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400">섹션 이름:</label>
        <input
          type="text"
          aria-label="섹션 이름"
          className="flex-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-100"
          value={draft.name}
          onChange={(e) =>
            setDraft((d) => ({ ...d, name: e.target.value }))
          }
        />
      </div>

      {/* BGM picker */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400">배경 BGM:</label>
        {draft.bgmMediaId ? (
          <span className="flex items-center gap-1 text-xs text-amber-300">
            <Music className="h-3 w-3" />
            {selectedBgm?.name ?? "(선택됨)"}
            <button
              type="button"
              onClick={handleBgmClear}
              aria-label="BGM 제거"
              className="ml-1 text-amber-300 hover:text-amber-200"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setBgmPickerOpen(true)}
            className="text-xs text-slate-400 underline hover:text-slate-200"
          >
            BGM 선택
          </button>
        )}
      </div>

      {/* Lines */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-slate-400">대사 ({draft.lines.length}줄)</label>
          <button
            type="button"
            onClick={handleAddLine}
            className="flex items-center gap-1 rounded bg-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-600"
          >
            <Plus className="h-3 w-3" />
            줄 추가
          </button>
        </div>

        {draft.lines.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-500">
            대사가 없습니다
          </p>
        ) : (
          draft.lines.map((line, idx) => (
            <ReadingLineRow
              key={idx}
              themeId={themeId}
              line={line}
              index={idx}
              characters={characters}
              selectedImage={imageById.get(line.ImageMediaID ?? "") ?? null}
              onChange={(next) => handleLineChange(idx, next)}
              onDelete={() => handleLineDelete(idx)}
            />
          ))
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between border-t border-slate-700 pt-3">
        <button
          type="button"
          onClick={() => setConfirmDelete((v) => !v)}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-rose-400 hover:bg-rose-500/10"
        >
          <Trash2 className="h-3 w-3" />
          섹션 삭제
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || updateMutation.isPending}
          className="flex items-center gap-1 rounded bg-amber-500 px-3 py-1 text-xs font-medium text-slate-900 hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
        >
          <Save className="h-3 w-3" />
          {updateMutation.isPending ? "저장 중..." : "저장"}
        </button>
      </div>

      {confirmDelete && (
        <div className="rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          <p className="mb-2">
            정말 이 섹션을 삭제하시겠습니까? 되돌릴 수 없습니다.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded bg-slate-700 px-2 py-1 text-slate-200 hover:bg-slate-600"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="rounded bg-rose-500 px-2 py-1 text-slate-50 hover:bg-rose-400 disabled:bg-rose-500/60"
            >
              {deleteMutation.isPending ? "삭제 중..." : "삭제"}
            </button>
          </div>
        </div>
      )}

      <MediaPicker
        open={bgmPickerOpen}
        onClose={() => setBgmPickerOpen(false)}
        onSelect={handleBgmSelect}
        themeId={themeId}
        filterType="BGM"
        selectedId={draft.bgmMediaId}
        title="BGM 선택"
      />
    </div>
  );
}
