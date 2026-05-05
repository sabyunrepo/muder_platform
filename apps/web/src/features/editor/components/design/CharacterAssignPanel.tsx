import { useState, useCallback, useMemo } from "react";
import { Edit3, Trash2 } from "lucide-react";
import type { EditorCharacterResponse, EditorThemeResponse, MysteryRole } from "@/features/editor/api";
import { useEditorCharacters, useEditorClues, useUpdateCharacter } from "@/features/editor/api";
import { useCharacterConfigDebounce } from "@/features/editor/hooks/useCharacterConfigDebounce";
import { CharacterDetailPanel } from "./CharacterDetailPanel";
import { EntityEditorShell } from "@/features/editor/entities/shell/EntityEditorShell";
import {
  readCharacterStartingClueMap,
  writeCharacterStartingClueMap,
} from "@/features/editor/utils/configShape";
import {
  buildCharacterVisibilityUpdatePayload,
  buildCharacterRoleUpdatePayload,
  buildCharacterEndcardUpdatePayload,
  getCharacterListBadges,
  type CharacterVisibilityField,
} from "@/features/editor/entities/character/characterEditorAdapter";
import {
  createMissionDraft,
  readCharacterMissionMap,
  writeCharacterMissionMap,
  type Mission,
} from "@/features/editor/entities/mission/missionAdapter";

interface CharacterAssignPanelProps {
  themeId: string;
  theme: EditorThemeResponse;
  onCreate?: () => void;
  onEdit?: (character: EditorCharacterResponse) => void;
  onDelete?: (character: EditorCharacterResponse) => void;
}

export function CharacterAssignPanel({
  themeId,
  theme,
  onCreate,
  onEdit,
  onDelete,
}: CharacterAssignPanelProps) {
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
    return readCharacterMissionMap(theme.config_json);
  }, [theme.config_json]);

  const { saveConfig, flush } = useCharacterConfigDebounce(themeId, theme.config_json);

  const handleSelectChar = useCallback(
    (id: string) => {
      flush();
      setSelectedCharId(id);
    },
    [flush],
  );

  const handleClueToggleForChar = useCallback(
    (characterId: string, clueId: string, checked: boolean) => {
      const current = characterClues[characterId] ?? [];
      const next = checked ? [...current, clueId] : current.filter((id) => id !== clueId);
      saveConfig(writeCharacterStartingClueMap(theme.config_json, {
        ...characterClues,
        [characterId]: next,
      }));
    },
    [characterClues, saveConfig, theme.config_json],
  );

  const handleAddMissionForChar = useCallback((characterId: string) => {
    const current = characterMissions[characterId] ?? [];
    saveConfig(writeCharacterMissionMap(undefined, {
      ...characterMissions,
      [characterId]: [...current, createMissionDraft()],
    }));
  }, [characterMissions, saveConfig]);

  const handleDeleteMissionForChar = useCallback(
    (characterId: string, missionId: string) => {
      const current = characterMissions[characterId] ?? [];
      saveConfig(writeCharacterMissionMap(undefined, {
        ...characterMissions,
        [characterId]: current.filter((m) => m.id !== missionId),
      }));
    },
    [characterMissions, saveConfig],
  );

  const handleMissionChangeForChar = useCallback(
    (characterId: string, missionId: string, field: keyof Mission, value: string | number) => {
      const current = characterMissions[characterId] ?? [];
      saveConfig(writeCharacterMissionMap(undefined, {
        ...characterMissions,
        [characterId]: current.map((m) =>
          m.id === missionId ? { ...m, [field]: value } : m,
        ),
      }));
    },
    [characterMissions, saveConfig],
  );

  const handleMysteryRoleChangeForChar = useCallback(
    (characterId: string, role: MysteryRole) => {
      const selected = characters?.find((char) => char.id === characterId);
      if (!selected) return;

      updateCharacter.mutate({
        characterId: selected.id,
        body: buildCharacterRoleUpdatePayload(selected, role),
      });
    },
    [characters, updateCharacter],
  );

  const handleVisibilityChangeForChar = useCallback(
    (characterId: string, field: CharacterVisibilityField, value: boolean) => {
      if (updateCharacter.isPending) return;

      const selected = characters?.find((char) => char.id === characterId);
      if (!selected) return;

      updateCharacter.mutate({
        characterId: selected.id,
        body: buildCharacterVisibilityUpdatePayload(selected, field, value),
      });
    },
    [characters, updateCharacter],
  );

  const handleEndcardChangeForChar = useCallback(
    (characterId: string, values: { title: string; body: string; imageUrl: string }) => {
      if (updateCharacter.isPending) return;

      const selected = characters?.find((char) => char.id === characterId);
      if (!selected) return;

      updateCharacter.mutate({
        characterId: selected.id,
        body: buildCharacterEndcardUpdatePayload(selected, values),
      });
    },
    [characters, updateCharacter],
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
        onCreate={onCreate}
        emptyMessage="캐릭터를 먼저 추가하세요"
        emptyDescription="캐릭터를 만든 뒤 역할지, 시작 단서, 히든 미션을 한 곳에서 관리합니다."
        getItemId={(char) => char.id}
        getItemTitle={(char) => char.name}
        renderDetail={() => null}
      />
    );
  }

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
        selectedId={activeCharId ?? undefined}
        onSelect={handleSelectChar}
        onCreate={onCreate}
        getItemId={(char) => char.id}
        getItemTitle={(char) => char.name}
        getItemDescription={(char) => char.description ?? ''}
        getItemBadges={getCharacterListBadges}
        renderItemActions={(char) => (
          <div className="flex gap-1">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(char)}
                aria-label={`${char.name} 수정`}
                className="rounded-md p-2 text-slate-600 transition hover:bg-slate-800 hover:text-amber-300"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(char)}
                aria-label={`${char.name} 삭제`}
                className="rounded-md p-2 text-slate-600 transition hover:bg-red-950/40 hover:text-red-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
        renderDetail={(char) => (
          <CharacterDetailPanel
            themeId={themeId}
            selectedChar={char}
            characters={characters ?? []}
            clues={clues}
            charClueIds={characterClues[char.id] ?? []}
            charMissions={characterMissions[char.id] ?? []}
            onClueToggle={(clueId, checked) => handleClueToggleForChar(char.id, clueId, checked)}
            onAddMission={() => handleAddMissionForChar(char.id)}
            onChangeMission={(missionId, field, value) => handleMissionChangeForChar(char.id, missionId, field, value)}
            onDeleteMission={(missionId) => handleDeleteMissionForChar(char.id, missionId)}
            onMysteryRoleChange={(role) => handleMysteryRoleChangeForChar(char.id, role)}
            onVisibilityChange={
              updateCharacter.isPending
                ? undefined
                : (field, value) => handleVisibilityChangeForChar(char.id, field, value)
            }
            onEndcardChange={
              updateCharacter.isPending
                ? undefined
                : (values) => handleEndcardChangeForChar(char.id, values)
            }
          />
        )}
      />
    </div>
  );
}
