import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { User } from 'lucide-react';
import { toast } from 'sonner';
import type { EditorThemeResponse } from '@/features/editor/api';
import {
  useEditorCharacters,
  useEditorClues,
  useUpdateConfigJson,
} from '@/features/editor/api';
import type { Mission } from './MissionEditor';
import { CharacterDetailPanel } from './CharacterDetailPanel';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CharacterAssignPanelProps {
  themeId: string;
  theme: EditorThemeResponse;
}

// ---------------------------------------------------------------------------
// CharacterAssignPanel
// ---------------------------------------------------------------------------

export function CharacterAssignPanel({ themeId, theme }: CharacterAssignPanelProps) {
  const { data: characters, isLoading: charsLoading } = useEditorCharacters(themeId);
  const { data: clues } = useEditorClues(themeId);
  const updateConfig = useUpdateConfigJson(themeId);
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

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

  const saveConfig = useCallback(
    (updates: Record<string, unknown>) => {
      pendingRef.current = { ...(theme.config_json ?? {}), ...updates };
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (!pendingRef.current) return;
        updateConfig.mutate(pendingRef.current, {
          onSuccess: () => toast.success('저장되었습니다'),
          onError: () => toast.error('저장에 실패했습니다'),
        });
        pendingRef.current = null;
      }, 500);
    },
    [theme.config_json, updateConfig],
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
    <div className="flex h-full flex-col md:flex-row">
      {/* ── Left: Character list ── */}
      <aside className="shrink-0 overflow-y-auto border-b border-slate-800 py-2 md:w-60 md:border-b-0 md:border-r">
        {characters.map((char) => (
          <button
            key={char.id}
            type="button"
            onClick={() => setSelectedCharId(char.id)}
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
