import { useState, useCallback, useMemo } from "react";
import { User } from "lucide-react";
import type { EditorThemeResponse } from "@/features/editor/api";
import { useEditorCharacters, useEditorClues } from "@/features/editor/api";
import { useCharacterConfigDebounce } from "@/features/editor/hooks/useCharacterConfigDebounce";
import type { Mission } from "./MissionEditor";
import { CharacterDetailPanel } from "./CharacterDetailPanel";
import { CharacterList } from "./CharacterList";
import {
  readCharacterStartingClueMap,
  writeCharacterStartingClueMap,
} from "@/features/editor/utils/configShape";

interface CharacterAssignPanelProps {
  themeId: string;
  theme: EditorThemeResponse;
}

export function CharacterAssignPanel({ themeId, theme }: CharacterAssignPanelProps) {
  const { data: characters, isLoading: charsLoading } = useEditorCharacters(themeId);
  const { data: clues } = useEditorClues(themeId);
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);

  const characterClues = useMemo(
    () => readCharacterStartingClueMap(theme.config_json),
    [theme.config_json],
  );

  const characterMissions = useMemo((): Record<string, Mission[]> => {
    const cm = (theme.config_json ?? {}).character_missions;
    return cm && typeof cm === "object" && !Array.isArray(cm)
      ? (cm as Record<string, Mission[]>)
      : {};
  }, [theme.config_json]);

  const { saveConfig, flush } = useCharacterConfigDebounce(themeId, theme.config_json);

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
      saveConfig(writeCharacterStartingClueMap(theme.config_json, {
        ...characterClues,
        [selectedCharId]: next,
      }));
    },
    [characterClues, saveConfig, selectedCharId, theme.config_json],
  );

  const handleAddMission = useCallback(() => {
    if (!selectedCharId) return;
    const current = characterMissions[selectedCharId] ?? [];
    const mission: Mission = {
      id: crypto.randomUUID(),
      type: "kill",
      description: "",
      points: 10,
    };
    saveConfig({
      character_missions: { ...characterMissions, [selectedCharId]: [...current, mission] },
    });
  }, [characterMissions, saveConfig, selectedCharId]);

  const handleDeleteMission = useCallback(
    (missionId: string) => {
      if (!selectedCharId) return;
      const current = characterMissions[selectedCharId] ?? [];
      saveConfig({
        character_missions: {
          ...characterMissions,
          [selectedCharId]: current.filter((m) => m.id !== missionId),
        },
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
          [selectedCharId]: current.map((m) =>
            m.id === missionId ? { ...m, [field]: value } : m,
          ),
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
      <CharacterList
        characters={characters}
        selectedCharId={selectedCharId}
        onSelect={handleSelectChar}
      />

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
