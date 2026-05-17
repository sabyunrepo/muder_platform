import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileInput, Play, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { queryClient } from '@/services/queryClient';

import {
  readingKeys,
  useDeleteReadingSection,
  useUpdateReadingSection,
  type ReadingBlockType,
  type ReadingLineDTO,
  type ReadingSectionResponse,
  type UpdateReadingSectionRequest,
} from '../../readingApi';
import { MediaPicker } from '../media/MediaPicker';
import type { MediaResponse } from '../../mediaApi';
import { useMediaList } from '../../mediaApi';
import { normalizeReadingBlocks } from '../../entities/story/readingBlockAdapter';
import { ReadingBlockRow } from './ReadingBlockRow';
import { ReadingSaveErrorBanner } from './ReadingSaveErrorBanner';
import { ReadingSectionBgmPanel } from './ReadingSectionBgmPanel';
import { ReadingSectionPreviewModal } from './ReadingSectionPreviewModal';
import { ReadingScriptImportModal } from './ReadingScriptImportModal';
import { EditorSaveConflictBanner } from '../EditorSaveConflictBanner';
import { useAutosavedDraft } from '../../hooks/useAutosavedDraft';
import type { CharacterOption } from './readingBlockUiTypes';
import {
  blockActions,
  createBlock,
  getReadingSaveErrorMessage,
  isConflictError,
  normalizeReadingLinesForSave,
  toDraft,
  toParserMedia,
  validateReadingLinesForSave,
  type ReadingSaveValidationIssue,
  type ReadingSectionDraft,
} from './readingSectionEditorModel';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReadingSectionEditorProps {
  themeId: string;
  section: ReadingSectionResponse;
  characters: CharacterOption[];
  onDeleted?: () => void;
}

function buildReadingPatch(
  draft: ReadingSectionDraft,
  section: ReadingSectionResponse,
  characters: CharacterOption[],
  narratorCharacterId: string | null,
): { patch: UpdateReadingSectionRequest; issues: ReadingSaveValidationIssue[] } {
  const normalizedLines = normalizeReadingLinesForSave(
    draft.lines,
    characters,
    narratorCharacterId,
  );
  const issues = validateReadingLinesForSave(normalizedLines);
  return {
    issues,
    patch: {
      version: section.version,
      name: draft.name,
      // bgmMediaId uses triple-state: null = clear, string = set, undefined = keep
      bgmMediaId: draft.bgmMediaId,
      bgmMode: draft.bgmMode,
      narratorCharacterId,
      lines: normalizedLines,
      sortOrder: draft.sortOrder,
    },
  };
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
  const lineKeyCounter = useRef(0);
  const createLineKey = useCallback(
    () => `reading-line-${section.id}-${lineKeyCounter.current++}`,
    [section.id]
  );
  const [lineKeys, setLineKeys] = useState<string[]>(() =>
    section.lines.map(() => createLineKey())
  );
  const [bgmPickerOpen, setBgmPickerOpen] = useState(false);
  const [scriptImportOpen, setScriptImportOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [validationIssues, setValidationIssues] = useState<ReadingSaveValidationIssue[]>([]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const updateMutation = useUpdateReadingSection(themeId);
  const deleteMutation = useDeleteReadingSection(themeId);
  const toReadingDraft = useCallback((value: ReadingSectionResponse) => toDraft(value), []);
  const isSameReadingDraft = useCallback(
    (left: ReadingSectionDraft, right: ReadingSectionDraft) =>
      JSON.stringify(left) === JSON.stringify(right),
    [],
  );
  const saveReadingPatch = useCallback(
    (patch: UpdateReadingSectionRequest) =>
      updateMutation.mutateAsync({ id: section.id, patch }),
    [section.id, updateMutation],
  );
  const buildReadingSaveBody = useCallback(
    (currentDraft: ReadingSectionDraft, latestSection: ReadingSectionResponse) => {
      const result = buildReadingPatch(
        currentDraft,
        latestSection,
        characters,
        currentDraft.narratorCharacterId ??
          characters.find((character) => character.isPlayable)?.id ??
          null,
      );
      if (result.issues.length > 0) {
        setValidationIssues(result.issues);
        setSaveError('저장 전에 미디어가 빠진 블록을 확인해 주세요.');
        return null;
      }
      setValidationIssues([]);
      setSaveError(null);
      return result.patch;
    },
    [characters],
  );
  const {
    draft,
    setDraft,
    isDirty,
  } = useAutosavedDraft<ReadingSectionResponse, ReadingSectionDraft, UpdateReadingSectionRequest>({
    serverValue: section,
    serverKey: section.id,
    debounceMs: 1200,
    toDraft: toReadingDraft,
    isEqual: isSameReadingDraft,
    buildSaveBody: buildReadingSaveBody,
    save: saveReadingPatch,
    messages: {
      toastId: `reading-section-autosave-${section.id}`,
      loading: '읽기 대사를 저장 중입니다',
      success: '읽기 대사가 저장되었습니다',
      error: '읽기 대사 저장에 실패했습니다',
    },
    onError: (err) => {
      if (isConflictError(err)) {
        setConflict(true);
        return;
      }
      setSaveError(getReadingSaveErrorMessage(err));
    },
  });

  useEffect(() => {
    if (isDirty) return;
    setLineKeys(section.lines.map(() => createLineKey()));
    setConflict(false);
    setSaveError(null);
    setValidationIssues([]);
  }, [createLineKey, isDirty, section]);

  // BGM list (BGM filter only) — used to display selected BGM name without
  // an extra fetch when picker is closed.
  const { data: bgmList = [] } = useMediaList(themeId, 'BGM');
  const { data: imageList = [] } = useMediaList(themeId, 'IMAGE');
  const { data: voiceList = [] } = useMediaList(themeId, 'VOICE');
  const { data: videoList = [] } = useMediaList(themeId, 'VIDEO');
  const { data: sfxList = [] } = useMediaList(themeId, 'SFX');
  const selectedBgm = useMemo(
    () => bgmList.find((m) => m.id === draft.bgmMediaId) ?? null,
    [bgmList, draft.bgmMediaId]
  );
  const playableCharacters = useMemo(
    () => characters.filter((character) => character.isPlayable),
    [characters]
  );
  const defaultNarratorCharacterId = playableCharacters[0]?.id ?? null;
  const effectiveNarratorCharacterId =
    draft.narratorCharacterId ?? defaultNarratorCharacterId;
  const allMedia = useMemo(
    () => [...bgmList, ...imageList, ...voiceList, ...videoList, ...sfxList],
    [bgmList, imageList, voiceList, sfxList, videoList]
  );
  const mediaById = useMemo(() => new Map(allMedia.map((media) => [media.id, media])), [allMedia]);

  const previewLines = useMemo(() => normalizeReadingBlocks(draft.lines), [draft.lines]);
  const validationIssueByLine = useMemo(
    () => new Map(validationIssues.map((issue) => [issue.lineIndex, issue.message])),
    [validationIssues]
  );

  // -------------------------------------------------------------------------
  // Block operations
  // -------------------------------------------------------------------------

  function handleAddBlock(type: ReadingBlockType) {
    clearSaveFeedback();
    setDraft((d) => ({
      ...d,
      lines: [...d.lines, createBlock(type, d.lines.length)],
    }));
    setLineKeys((keys) => [...keys, createLineKey()]);
  }

  function handleLineChange(idx: number, next: ReadingLineDTO) {
    clearSaveFeedback();
    setDraft((d) => {
      const lines = d.lines.slice();
      lines[idx] = { ...next, Index: idx };
      return { ...d, lines };
    });
  }

  function handleMoveBlock(from: number, to: number) {
    if (
      from === to ||
      from < 0 ||
      to < 0 ||
      from >= draft.lines.length ||
      to >= draft.lines.length
    ) {
      return;
    }
    clearSaveFeedback();
    setDraft((d) => {
      const lines = d.lines.slice();
      const [moved] = lines.splice(from, 1);
      lines.splice(to, 0, moved);
      return {
        ...d,
        lines: lines.map((line, index) => ({ ...line, Index: index })),
      };
    });
    setLineKeys((keys) => {
      const nextKeys = keys.slice();
      const [movedKey] = nextKeys.splice(from, 1);
      nextKeys.splice(to, 0, movedKey);
      return nextKeys;
    });
  }

  function handleApplyParsedBlocks(blocks: ReadingLineDTO[]) {
    clearSaveFeedback();
    setDraft((d) => ({ ...d, lines: normalizeReadingBlocks(blocks) }));
    setLineKeys(blocks.map(() => createLineKey()));
  }

  function handleLineDelete(idx: number) {
    clearSaveFeedback();
    setDraft((d) => {
      const lines = d.lines.filter((_, i) => i !== idx).map((l, i) => ({ ...l, Index: i }));
      return { ...d, lines };
    });
    setLineKeys((keys) => keys.filter((_, i) => i !== idx));
  }

  // -------------------------------------------------------------------------
  // BGM operations
  // -------------------------------------------------------------------------

  function handleBgmSelect(media: MediaResponse) {
    clearSaveFeedback();
    setDraft((d) => ({ ...d, bgmMediaId: media.id }));
  }

  function handleBgmClear() {
    clearSaveFeedback();
    setDraft((d) => ({ ...d, bgmMediaId: null }));
  }

  function handleBgmModeChange(mode: typeof draft.bgmMode) {
    clearSaveFeedback();
    setDraft((d) => ({ ...d, bgmMode: mode }));
  }

  function handleNarratorCharacterChange(characterId: string) {
    clearSaveFeedback();
    setDraft((d) => ({ ...d, narratorCharacterId: characterId || null }));
  }

  function clearSaveFeedback() {
    setSaveError(null);
    setValidationIssues([]);
  }

  async function handleDelete() {
    try {
      await deleteMutation.mutateAsync(section.id);
      onDeleted?.();
    } catch (err) {
      setSaveError(getReadingSaveErrorMessage(err));
      setConfirmDelete(false);
    }
  }

  function handleRefresh() {
    setConflict(false);
    queryClient.invalidateQueries({ queryKey: readingKeys.list(themeId) });
  }

  async function handleCopyDraft() {
    const text = JSON.stringify(draft, null, 2);
    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard API is not available');
      }
      await navigator.clipboard.writeText(text);
      toast.success('내 변경 내용을 클립보드에 복사했습니다');
    } catch {
      toast.error('클립보드에 복사할 수 없습니다');
    }
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
        <ReadingSaveErrorBanner message={saveError} issues={validationIssues} />
      )}

      {/* Section name */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400">섹션 이름:</label>
        <input
          type="text"
          aria-label="섹션 이름"
          className="flex-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-100"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        />
      </div>

      <ReadingSectionBgmPanel
        draft={draft}
        selectedBgm={selectedBgm}
        onOpenPicker={() => setBgmPickerOpen(true)}
        onClear={handleBgmClear}
        onModeChange={handleBgmModeChange}
      />

      <div className="rounded border border-slate-800 bg-slate-900/60 px-3 py-3">
        <label className="flex max-w-xs flex-col gap-1 text-xs font-medium text-slate-300">
          나레이션 진행
          <select
            aria-label="나레이션 진행"
            className="h-8 rounded border border-slate-700 bg-slate-800 px-2 text-xs font-normal text-slate-100"
            value={effectiveNarratorCharacterId ?? ''}
            onChange={(event) => handleNarratorCharacterChange(event.target.value)}
          >
            {playableCharacters.length === 0 ? (
              <option value="">플레이어 캐릭터 없음</option>
            ) : (
              playableCharacters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.name}
                </option>
              ))
            )}
          </select>
        </label>
      </div>

      {/* Blocks */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 border-t border-slate-800 pt-4 md:flex-row md:items-center md:justify-between">
          <div>
            <label className="text-sm font-medium text-slate-200">
              대본 블록 ({draft.lines.length}개)
            </label>
            <p className="mt-1 text-xs text-slate-500">
              대사와 연출을 같은 흐름에서 순서대로 편집합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="inline-flex items-center gap-1 rounded border border-amber-500/50 px-2 py-1 text-xs font-medium text-amber-200 hover:bg-amber-500/10"
            >
              <Play className="h-3.5 w-3.5" />
              테스트
            </button>
            <button
              type="button"
              onClick={() => setScriptImportOpen(true)}
              className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
            >
              <FileInput className="h-3.5 w-3.5" />
              대본 입력
            </button>
            {blockActions.map((action) => (
              <button
                key={action.type}
                type="button"
                onClick={() => handleAddBlock(action.type)}
                className="inline-flex items-center gap-1 rounded bg-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-600"
              >
                <action.icon className="h-3.5 w-3.5" />
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {draft.lines.length === 0 ? (
          <div className="rounded border border-dashed border-slate-700 bg-slate-900/50 px-4 py-8 text-center">
            <p className="text-sm text-slate-300">아직 블록이 없습니다.</p>
            <p className="mt-1 text-xs text-slate-500">
              대본 입력으로 붙여넣거나, 필요한 블록을 하나씩 추가하세요.
            </p>
          </div>
        ) : (
          draft.lines.map((line, idx) => (
            <ReadingBlockRow
              key={lineKeys[idx] ?? `reading-line-fallback-${idx}`}
              themeId={themeId}
              line={line}
              index={idx}
              totalCount={draft.lines.length}
              characters={characters}
              mediaById={mediaById}
              dragging={draggingIndex === idx}
              validationMessage={validationIssueByLine.get(idx)}
              onChange={(next) => handleLineChange(idx, next)}
              onDelete={() => handleLineDelete(idx)}
              onMove={handleMoveBlock}
              onDragStart={() => setDraggingIndex(idx)}
              onDragEnd={() => setDraggingIndex(null)}
            />
          ))
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-start border-t border-slate-700 pt-3">
        <button
          type="button"
          onClick={() => setConfirmDelete((v) => !v)}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-rose-400 hover:bg-rose-500/10"
        >
          <Trash2 className="h-3 w-3" />
          섹션 삭제
        </button>
      </div>

      {confirmDelete && (
        <div className="rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          <p className="mb-2">정말 이 섹션을 삭제하시겠습니까? 되돌릴 수 없습니다.</p>
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
              {deleteMutation.isPending ? '삭제 중...' : '삭제'}
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
        title="배경음악 선택"
      />
      <ReadingScriptImportModal
        open={scriptImportOpen}
        hasExistingBlocks={draft.lines.length > 0}
        characters={characters}
        media={allMedia.map(toParserMedia)}
        onClose={() => setScriptImportOpen(false)}
        onApply={handleApplyParsedBlocks}
      />
      <ReadingSectionPreviewModal
        open={previewOpen}
        sectionName={draft.name || section.name}
        bgmMediaId={draft.bgmMediaId}
        bgmMode={draft.bgmMode}
        lines={previewLines}
        characters={characters}
        mediaById={mediaById}
        dirty={isDirty}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
}
