import { Accordion } from '@/shared/components/ui';
import type { Mission } from './MissionEditor';
import { MissionEditor } from './MissionEditor';
import { StartingClueAssigner } from './StartingClueAssigner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClueItem {
  id: string;
  name: string;
  location?: string;
  round?: number;
  tag?: string;
}

interface CharacterItem {
  id: string;
  name: string;
}

interface CharacterDetailPanelProps {
  selectedChar: CharacterItem | null;
  characters: CharacterItem[];
  clues: ClueItem[] | undefined;
  charClueIds: string[];
  charMissions: Mission[];
  onClueToggle: (clueId: string, checked: boolean) => void;
  onAddMission: () => void;
  onChangeMission: (missionId: string, field: keyof Mission, value: string | number) => void;
  onDeleteMission: (missionId: string) => void;
}

// ---------------------------------------------------------------------------
// CharacterDetailPanel
// ---------------------------------------------------------------------------

export function CharacterDetailPanel({
  selectedChar,
  characters,
  clues,
  charClueIds,
  charMissions,
  onClueToggle,
  onAddMission,
  onChangeMission,
  onDeleteMission,
}: CharacterDetailPanelProps) {
  if (!selectedChar) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs text-slate-600">좌측에서 캐릭터를 선택하세요</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-4">
      <h3 className="text-sm font-semibold text-slate-200">{selectedChar.name}</h3>

      <Accordion
        storageKey={`editor:character:${selectedChar.id}:sections`}
        items={[
          {
            id: 'starting-clue',
            title: '시작 단서',
            subtitle: `${charClueIds.length}/${clues?.length ?? 0}개 배정`,
            defaultOpen: true,
            children: (
              <StartingClueAssigner
                characterName={selectedChar.name}
                clues={clues ?? []}
                selectedIds={charClueIds}
                onClueToggle={onClueToggle}
              />
            ),
          },
          {
            id: 'hidden-mission',
            title: '히든 미션',
            subtitle: `${charMissions.length}개`,
            defaultOpen: true,
            children: (
              <MissionEditor
                missions={charMissions}
                characters={characters}
                clues={clues ?? []}
                onAdd={onAddMission}
                onChange={onChangeMission}
                onDelete={onDeleteMission}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
