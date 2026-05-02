import { Accordion } from '@/shared/components/ui';
import type { MysteryRole } from '@/features/editor/api';
import type { Mission } from './MissionEditor';
import { MissionEditor } from './MissionEditor';
import { StartingClueAssigner } from './StartingClueAssigner';
import { CharacterRoleSheetSection } from './CharacterRoleSheetSection';

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
  description?: string | null;
  image_url?: string | null;
  is_culprit?: boolean;
  mystery_role?: MysteryRole;
}

interface CharacterDetailPanelProps {
  themeId: string;
  selectedChar: CharacterItem | null;
  characters: CharacterItem[];
  clues: ClueItem[] | undefined;
  charClueIds: string[];
  charMissions: Mission[];
  onClueToggle: (clueId: string, checked: boolean) => void;
  onAddMission: () => void;
  onChangeMission: (missionId: string, field: keyof Mission, value: string | number) => void;
  onDeleteMission: (missionId: string) => void;
  onMysteryRoleChange?: (role: MysteryRole) => void;
}

const mysteryRoleOptions: Array<{ value: MysteryRole; label: string; description: string }> = [
  { value: 'suspect', label: '용의자', description: '일반 투표 후보' },
  { value: 'culprit', label: '범인', description: '정답 캐릭터' },
  { value: 'accomplice', label: '공범', description: '범인을 돕는 캐릭터' },
  { value: 'detective', label: '탐정', description: '투표 후보 포함 여부를 별도 설정' },
];

function getMysteryRoleLabel(role: MysteryRole) {
  return mysteryRoleOptions.find((option) => option.value === role)?.label ?? '용의자';
}

// ---------------------------------------------------------------------------
// CharacterDetailPanel
// ---------------------------------------------------------------------------

export function CharacterDetailPanel({
  themeId,
  selectedChar,
  characters,
  clues,
  charClueIds,
  charMissions,
  onClueToggle,
  onAddMission,
  onChangeMission,
  onDeleteMission,
  onMysteryRoleChange,
}: CharacterDetailPanelProps) {
  if (!selectedChar) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs text-slate-600">좌측에서 캐릭터를 선택하세요</p>
      </div>
    );
  }

  const selectedRole: MysteryRole = selectedChar.mystery_role
    ?? (selectedChar.is_culprit ? 'culprit' : 'suspect');

  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-200">{selectedChar.name}</h3>
        <p className="mt-1 text-xs text-slate-500">시스템 ID: <span className="font-mono text-slate-400">{selectedChar.id}</span></p>
      </div>

      <Accordion
        storageKey={`editor:character:${selectedChar.id}:sections`}
        items={[
          {
            id: 'base',
            title: '베이스',
            subtitle: `${getMysteryRoleLabel(selectedRole)} · 공개 소개`,
            defaultOpen: true,
            forceOpen: true,
            children: (
              <div className="grid gap-3 md:grid-cols-[10rem_1fr]">
                <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-950 text-xs text-slate-600">
                  {selectedChar.image_url ? '사진 등록됨' : '사진 없음'}
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">이름</p>
                    <p className="mt-1 text-sm text-slate-200">{selectedChar.name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">역할</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {mysteryRoleOptions.map((option) => {
                        const active = selectedRole === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            disabled={!onMysteryRoleChange}
                            onClick={() => onMysteryRoleChange?.(option.value)}
                            className={`rounded-lg border px-3 py-2 text-left transition ${
                              active
                                ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
                                : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                            } disabled:cursor-default disabled:opacity-80`}
                          >
                            <span className="block text-xs font-semibold">{option.label}</span>
                            <span className="mt-1 block text-[11px] leading-4 text-slate-500">{option.description}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">공개 소개</p>
                    <p className="mt-1 whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs leading-5 text-slate-400">
                      {selectedChar.description || '공개 소개가 없습니다.'}
                    </p>
                  </div>
                </div>
              </div>
            ),
          },
          {
            id: 'role-sheet',
            title: '역할지',
            subtitle: 'Markdown 또는 PDF',
            defaultOpen: true,
            children: (
              <CharacterRoleSheetSection
                themeId={themeId}
                characterId={selectedChar.id}
                characterName={selectedChar.name}
              />
            ),
          },
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
