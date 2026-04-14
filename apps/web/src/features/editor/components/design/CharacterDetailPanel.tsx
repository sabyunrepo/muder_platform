import type { Mission } from './MissionEditor';
import { MissionEditor } from './MissionEditor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClueItem {
  id: string;
  name: string;
}

interface CharacterItem {
  id: string;
  name: string;
}

interface CharacterDetailPanelProps {
  selectedChar: CharacterItem | null;
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
    <div className="max-w-lg space-y-6">
      <h3 className="text-sm font-semibold text-slate-200">{selectedChar.name}</h3>

      {/* 시작 단서 배정 */}
      <div>
        <h4 className="mb-2 text-xs font-medium text-slate-400">시작 단서</h4>
        {clues?.length ? (
          <div className="space-y-1">
            {clues.map((clue) => (
              <label
                key={clue.id}
                className="flex items-center gap-2 rounded px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
              >
                <input
                  type="checkbox"
                  checked={charClueIds.includes(clue.id)}
                  onChange={(e) => onClueToggle(clue.id, e.target.checked)}
                  className="accent-amber-500"
                />
                {clue.name}
              </label>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-600">단서가 없습니다</p>
        )}
      </div>

      {/* 히든 미션 */}
      <MissionEditor
        missions={charMissions}
        onAdd={onAddMission}
        onChange={onChangeMission}
        onDelete={onDeleteMission}
      />
    </div>
  );
}
