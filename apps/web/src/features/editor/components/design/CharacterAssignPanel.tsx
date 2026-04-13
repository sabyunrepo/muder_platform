import { useState, useCallback, useMemo } from 'react';
import { User, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { EditorThemeResponse } from '@/features/editor/api';
import {
  useEditorCharacters,
  useEditorClues,
  useUpdateConfigJson,
} from '@/features/editor/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Mission {
  id: string;
  type: string;
  description: string;
  points: number;
}

interface CharacterAssignPanelProps {
  themeId: string;
  theme: EditorThemeResponse;
}

const MISSION_TYPES = [
  { value: 'find', label: '찾기' },
  { value: 'protect', label: '보호' },
  { value: 'sabotage', label: '방해' },
  { value: 'observe', label: '관찰' },
];

// ---------------------------------------------------------------------------
// CharacterAssignPanel
// ---------------------------------------------------------------------------

export function CharacterAssignPanel({ themeId, theme }: CharacterAssignPanelProps) {
  const { data: characters, isLoading: charsLoading } = useEditorCharacters(themeId);
  const { data: clues } = useEditorClues(themeId);
  const updateConfig = useUpdateConfigJson(themeId);
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

  const saveConfig = useCallback(
    (updates: Record<string, unknown>) => {
      updateConfig.mutate(
        { ...(theme.config_json ?? {}), ...updates },
        {
          onSuccess: () => toast.success('저장되었습니다'),
          onError: () => toast.error('저장에 실패했습니다'),
        },
      );
    },
    [theme.config_json, updateConfig],
  );

  const handleClueToggle = useCallback(
    (charId: string, clueId: string, checked: boolean) => {
      const current = characterClues[charId] ?? [];
      const next = checked
        ? [...current, clueId]
        : current.filter((id) => id !== clueId);
      saveConfig({ character_clues: { ...characterClues, [charId]: next } });
    },
    [characterClues, saveConfig],
  );

  const handleAddMission = useCallback(
    (charId: string) => {
      const current = characterMissions[charId] ?? [];
      const mission: Mission = {
        id: crypto.randomUUID(),
        type: 'find',
        description: '',
        points: 10,
      };
      saveConfig({
        character_missions: { ...characterMissions, [charId]: [...current, mission] },
      });
    },
    [characterMissions, saveConfig],
  );

  const handleDeleteMission = useCallback(
    (charId: string, missionId: string) => {
      const current = characterMissions[charId] ?? [];
      saveConfig({
        character_missions: {
          ...characterMissions,
          [charId]: current.filter((m) => m.id !== missionId),
        },
      });
    },
    [characterMissions, saveConfig],
  );

  const handleMissionChange = useCallback(
    (charId: string, missionId: string, field: keyof Mission, value: string | number) => {
      const current = characterMissions[charId] ?? [];
      saveConfig({
        character_missions: {
          ...characterMissions,
          [charId]: current.map((m) => (m.id === missionId ? { ...m, [field]: value } : m)),
        },
      });
    },
    [characterMissions, saveConfig],
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

  const selectedChar = characters.find((c) => c.id === selectedCharId);
  const charClueIds = selectedCharId ? (characterClues[selectedCharId] ?? []) : [];
  const charMissions = selectedCharId ? (characterMissions[selectedCharId] ?? []) : [];

  return (
    <div className="flex h-full">
      {/* ── Left: Character list ── */}
      <aside className="w-60 shrink-0 overflow-y-auto border-r border-slate-800 py-2">
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
        {selectedChar ? (
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
                        onChange={(e) =>
                          handleClueToggle(selectedCharId!, clue.id, e.target.checked)
                        }
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
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-medium text-slate-400">히든 미션</h4>
                <button
                  type="button"
                  onClick={() => handleAddMission(selectedCharId!)}
                  className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
                >
                  <Plus className="h-3 w-3" />
                  추가
                </button>
              </div>
              {charMissions.length > 0 ? (
                <div className="space-y-3">
                  {charMissions.map((mission) => (
                    <div
                      key={mission.id}
                      className="rounded border border-slate-800 bg-slate-900 p-3"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <select
                          value={mission.type}
                          onChange={(e) =>
                            handleMissionChange(selectedCharId!, mission.id, 'type', e.target.value)
                          }
                          className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300"
                        >
                          {MISSION_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleDeleteMission(selectedCharId!, mission.id)}
                          aria-label="미션 삭제"
                          className="text-slate-600 hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={mission.description}
                        onChange={(e) =>
                          handleMissionChange(
                            selectedCharId!, mission.id, 'description', e.target.value,
                          )
                        }
                        placeholder="미션 설명"
                        className="mb-2 w-full rounded bg-slate-800 px-2 py-1 text-xs text-slate-300 placeholder-slate-600"
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">포인트:</span>
                        <input
                          type="number"
                          value={mission.points}
                          onChange={(e) =>
                            handleMissionChange(
                              selectedCharId!, mission.id, 'points', Number(e.target.value),
                            )
                          }
                          className="w-16 rounded bg-slate-800 px-2 py-1 text-xs text-slate-300"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-600">미션이 없습니다</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-slate-600">좌측에서 캐릭터를 선택하세요</p>
          </div>
        )}
      </div>
    </div>
  );
}
