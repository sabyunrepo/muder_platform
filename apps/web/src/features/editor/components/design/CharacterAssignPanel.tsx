import { useState, useCallback, useMemo, useRef } from 'react';
import { User } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import type { EditorThemeResponse } from '@/features/editor/api';
import {
  editorKeys,
  useEditorCharacters,
  useEditorClues,
  useUpdateConfigJson,
} from '@/features/editor/api';
import { useDebouncedMutation } from '@/hooks/useDebouncedMutation';
import type { Mission } from './MissionEditor';
import { CharacterDetailPanel } from './CharacterDetailPanel';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Debounce window for config saves (W2 PR-5: 500→1500ms). */
const SAVE_DEBOUNCE_MS = 1500;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CharacterAssignPanelProps {
  themeId: string;
  theme: EditorThemeResponse;
}

type ConfigPatch = Record<string, unknown>;

// ---------------------------------------------------------------------------
// CharacterAssignPanel
// ---------------------------------------------------------------------------

export function CharacterAssignPanel({ themeId, theme }: CharacterAssignPanelProps) {
  const { data: characters, isLoading: charsLoading } = useEditorCharacters(themeId);
  const { data: clues } = useEditorClues(themeId);
  const updateConfig = useUpdateConfigJson(themeId);
  const queryClient = useQueryClient();
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);

  const characterClues = useMemo((): Record<string, string[]> => {
    const cc = (theme.config_json ?? {}).character_clues;
    return (cc && typeof cc === 'object' && !Array.isArray(cc))
      ? (cc as Record<string, string[]>) : {};
  }, [theme.config_json]);

  const characterMissions = useMemo((): Record<string, Mission[]> => {
    const cm = (theme.config_json ?? {}).character_missions;
    return (cm && typeof cm === 'object' && !Array.isArray(cm))
      ? (cm as Record<string, Mission[]>) : {};
  }, [theme.config_json]);

  // Pre-edit snapshot captured at the FIRST schedule of a debounce window —
  // distinct from the schedule-time UI mirror that follows. This is the
  // correct rollback target on mutation failure (round-2 N-1 / CodeRabbit).
  // Cleared after the mutation settles (success or rollback) so the next
  // edit window starts fresh.
  const pendingSnapshotRef = useRef<EditorThemeResponse | undefined>(undefined);

  const debouncer = useDebouncedMutation<ConfigPatch>({
    debounceMs: SAVE_DEBOUNCE_MS,
    mutate: (body, opts) =>
      updateConfig.mutate(body, {
        onSuccess: () => {
          toast.success('저장되었습니다');
          pendingSnapshotRef.current = undefined;
        },
        onError: (err) => {
          // The hook's onError chain runs first (rollback → toast.error),
          // then we clear so a follow-up edit captures a fresh snapshot.
          opts.onError(err);
          pendingSnapshotRef.current = undefined;
        },
      }),
    applyOptimistic: () => {
      // Build the rollback closure from the pre-edit snapshot captured in
      // saveConfig — NOT from the current cache (which already has the
      // schedule-time mirror applied). On failure, restore truly to the
      // pre-edit state.
      const previous = pendingSnapshotRef.current;
      if (!previous) return null;
      const cacheKey = editorKeys.theme(themeId);
      return () => queryClient.setQueryData(cacheKey, previous);
    },
    onError: () => toast.error('저장에 실패했습니다'),
  });
  const flush = debouncer.flush;

  const saveConfig = useCallback(
    (updates: ConfigPatch) => {
      const cacheKey = editorKeys.theme(themeId);

      // Capture the *true* pre-edit snapshot once per debounce window. This
      // is the rollback target on mutation failure — distinct from the
      // schedule-time UI mirror below.
      if (!pendingSnapshotRef.current) {
        pendingSnapshotRef.current = queryClient.getQueryData<EditorThemeResponse>(cacheKey);
      }

      // Schedule-time UI mirror — character toggles need sync feedback so
      // users see the flip immediately, not after the debounce window. The
      // hook's `applyOptimistic` runs at flush time and captures the rollback
      // closure pointing at `pendingSnapshotRef.current`.
      const cacheNow = queryClient.getQueryData<EditorThemeResponse>(cacheKey);
      if (cacheNow) {
        queryClient.setQueryData<EditorThemeResponse>(cacheKey, {
          ...cacheNow,
          config_json: { ...(cacheNow.config_json ?? {}), ...updates },
        });
      }

      // Merge basis priority (H-W2-1): pending body > optimistic cache >
      // theme.config_json. Prevents loss of earlier edits made within the
      // same debounce window on different keys.
      debouncer.schedule(updates, (prev) => {
        const cached = queryClient.getQueryData<EditorThemeResponse>(cacheKey)?.config_json;
        const basis = prev ?? cached ?? theme.config_json ?? {};
        return { ...basis, ...updates };
      });
    },
    [debouncer, queryClient, theme.config_json, themeId],
  );

  const handleSelectChar = useCallback(
    (id: string) => {
      flush();
      setSelectedCharId(id);
    },
    [flush],
  );

  const handleClueToggle = useCallback(
    (clueId: string, checked: boolean) => {
      if (!selectedCharId) return;
      const current = characterClues[selectedCharId] ?? [];
      const next = checked ? [...current, clueId] : current.filter((id) => id !== clueId);
      saveConfig({ character_clues: { ...characterClues, [selectedCharId]: next } });
    },
    [characterClues, saveConfig, selectedCharId],
  );

  const handleAddMission = useCallback(() => {
    if (!selectedCharId) return;
    const current = characterMissions[selectedCharId] ?? [];
    const mission: Mission = { id: crypto.randomUUID(), type: 'kill', description: '', points: 10 };
    saveConfig({ character_missions: { ...characterMissions, [selectedCharId]: [...current, mission] } });
  }, [characterMissions, saveConfig, selectedCharId]);

  const handleDeleteMission = useCallback(
    (missionId: string) => {
      if (!selectedCharId) return;
      const current = characterMissions[selectedCharId] ?? [];
      saveConfig({
        character_missions: { ...characterMissions, [selectedCharId]: current.filter((m) => m.id !== missionId) },
      });
    },
    [characterMissions, saveConfig, selectedCharId],
  );

  const handleMissionChange = useCallback(
    (missionId: string, field: keyof Mission, value: string | number) => {
      if (!selectedCharId) return;
      const current = characterMissions[selectedCharId] ?? [];
      saveConfig({
        character_missions: {
          ...characterMissions,
          [selectedCharId]: current.map((m) => (m.id === missionId ? { ...m, [field]: value } : m)),
        },
      });
    },
    [characterMissions, saveConfig, selectedCharId],
  );

  if (charsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs text-slate-600">로딩 중...</p>
      </div>
    );
  }

  if (!characters?.length) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <User className="mx-auto mb-3 h-8 w-8 text-slate-700" />
          <p className="text-xs text-slate-500">캐릭터를 먼저 추가하세요</p>
        </div>
      </div>
    );
  }

  const selectedChar = characters.find((c) => c.id === selectedCharId) ?? null;
  const charClueIds = selectedCharId ? (characterClues[selectedCharId] ?? []) : [];
  const charMissions = selectedCharId ? (characterMissions[selectedCharId] ?? []) : [];

  return (
    <div
      className="flex h-full flex-col md:flex-row"
      onBlur={(e) => {
        // Flush pending config when focus leaves the panel entirely. `relatedTarget`
        // is null when the user clicks outside React's focus tree (e.g. tab switch).
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) flush();
      }}
    >
      {/* ── Left: Character list ── */}
      <aside className="shrink-0 overflow-y-auto border-b border-slate-800 py-2 md:w-60 md:border-b-0 md:border-r">
        {characters.map((char) => (
          <button
            key={char.id}
            type="button"
            onClick={() => handleSelectChar(char.id)}
            className={`flex w-full items-center gap-2 px-4 py-2 text-left text-xs transition-colors ${
              selectedCharId === char.id
                ? 'bg-slate-800 text-amber-400'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            <User className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{char.name}</span>
            {char.is_culprit && (
              <span className="ml-auto shrink-0 text-[10px] text-red-400">범인</span>
            )}
          </button>
        ))}
      </aside>

      {/* ── Right: Detail ── */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <CharacterDetailPanel
          selectedChar={selectedChar}
          characters={characters ?? []}
          clues={clues}
          charClueIds={charClueIds}
          charMissions={charMissions}
          onClueToggle={handleClueToggle}
          onAddMission={handleAddMission}
          onChangeMission={handleMissionChange}
          onDeleteMission={handleDeleteMission}
        />
      </div>
    </div>
  );
}
