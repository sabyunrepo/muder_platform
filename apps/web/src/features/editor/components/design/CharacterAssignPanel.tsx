import { useState, useCallback, useMemo } from "react";
import type { EditorThemeResponse, MysteryRole } from "@/features/editor/api";
import { useEditorCharacters, useEditorClues, useUpdateCharacter } from "@/features/editor/api";
import { useCharacterConfigDebounce } from "@/features/editor/hooks/useCharacterConfigDebounce";
import type { Mission } from "./MissionEditor";
import { CharacterDetailPanel } from "./CharacterDetailPanel";
import { EntityEditorShell } from "@/features/editor/entities/shell/EntityEditorShell";
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
  const updateCharacter = useUpdateCharacter(themeId);
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const activeCharId = characters?.some((char) => char.id === selectedCharId)
    ? selectedCharId
    : characters?.[0]?.id ?? null;

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
      if (!activeCharId) return;
      const current = characterClues[activeCharId] ?? [];
      const next = checked ? [...current, clueId] : current.filter((id) => id !== clueId);
      saveConfig(writeCharacterStartingClueMap(theme.config_json, {
        ...characterClues,
        [activeCharId]: next,
      }));
    },
    [activeCharId, characterClues, saveConfig, theme.config_json],
  );

  const handleAddMission = useCallback(() => {
    if (!activeCharId) return;
    const current = characterMissions[activeCharId] ?? [];
    const mission: Mission = {
      id: crypto.randomUUID(),
      type: "kill",
      description: "",
      points: 10,
    };
    saveConfig({
      character_missions: { ...characterMissions, [activeCharId]: [...current, mission] },
    });
  }, [activeCharId, characterMissions, saveConfig]);

  const handleDeleteMission = useCallback(
    (missionId: string) => {
      if (!activeCharId) return;
      const current = characterMissions[activeCharId] ?? [];
      saveConfig({
        character_missions: {
          ...characterMissions,
          [activeCharId]: current.filter((m) => m.id !== missionId),
        },
      });
    },
    [activeCharId, characterMissions, saveConfig],
  );

  const handleMissionChange = useCallback(
    (missionId: string, field: keyof Mission, value: string | number) => {
      if (!activeCharId) return;
      const current = characterMissions[activeCharId] ?? [];
      saveConfig({
        character_missions: {
          ...characterMissions,
          [activeCharId]: current.map((m) =>
            m.id === missionId ? { ...m, [field]: value } : m,
          ),
        },
      });
    },
    [activeCharId, characterMissions, saveConfig],
  );

  const handleMysteryRoleChange = useCallback(
    (role: MysteryRole) => {
      if (!activeCharId) return;
      const selected = characters?.find((char) => char.id === activeCharId);
      if (!selected) return;

      updateCharacter.mutate({
        characterId: selected.id,
        body: {
          name: selected.name,
          description: selected.description ?? undefined,
          image_url: selected.image_url ?? undefined,
          is_culprit: role === "culprit",
          mystery_role: role,
          sort_order: selected.sort_order,
        },
      });
    },
    [activeCharId, characters, updateCharacter],
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
      <EntityEditorShell
        title="캐릭터"
        items={[]}
        selectedId={undefined}
        onSelect={() => undefined}
        emptyMessage="캐릭터를 먼저 추가하세요"
        emptyDescription="기본 탭에서 캐릭터를 만든 뒤 역할지와 시작 단서를 배정할 수 있습니다."
        getItemId={(char) => char.id}
        getItemTitle={(char) => char.name}
        renderDetail={() => null}
      />
    );
  }

  const selectedChar = characters.find((c) => c.id === activeCharId) ?? characters[0] ?? null;
  const charClueIds = activeCharId ? (characterClues[activeCharId] ?? []) : [];
  const charMissions = activeCharId ? (characterMissions[activeCharId] ?? []) : [];

  return (
    <div
      className="flex h-full flex-col md:flex-row"
      onBlur={(e) => {
        // Flush pending config when focus leaves the panel entirely. `relatedTarget`
        // is null when the user clicks outside React's focus tree (e.g. tab switch).
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) flush();
      }}
    >
      <EntityEditorShell
        title="캐릭터"
        items={characters}
        selectedId={selectedChar?.id}
        onSelect={handleSelectChar}
        getItemId={(char) => char.id}
        getItemTitle={(char) => char.name}
        getItemDescription={(char) => char.description ?? ''}
        getItemBadges={(char) => [formatMysteryRoleBadge(char.mystery_role, char.is_culprit)]}
        renderDetail={() => (
          <CharacterDetailPanel
            themeId={themeId}
            selectedChar={selectedChar}
            characters={characters ?? []}
            clues={clues}
            charClueIds={charClueIds}
            charMissions={charMissions}
            onClueToggle={handleClueToggle}
            onAddMission={handleAddMission}
            onChangeMission={handleMissionChange}
            onDeleteMission={handleDeleteMission}
            onMysteryRoleChange={handleMysteryRoleChange}
          />
        )}
      />
    </div>
  );
}


function formatMysteryRoleBadge(role: MysteryRole | undefined, isCulprit: boolean | undefined) {
  if (role === "culprit" || (!role && isCulprit)) return "범인";
  if (role === "accomplice") return "공범";
  if (role === "detective") return "탐정";
  return "용의자";
}
