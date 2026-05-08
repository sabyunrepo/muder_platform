import { Plus, Trash2 } from 'lucide-react';
import { MissionTypeFields } from './MissionTypeFields';
import {
  MISSION_TYPES,
  MISSION_REVEAL_OPTIONS,
  toMissionViewModel,
  type Mission,
  type MissionEditorCharacter,
  type MissionEditorClue,
} from '../../entities/mission/missionAdapter';
import type {
  ProgressNodeRevealOption,
  RoundRevealOption,
} from '@/features/editor/entities/reveal/revealTimingOptions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { Mission, MissionEditorCharacter, MissionEditorClue };

interface MissionEditorProps {
  missions: Mission[];
  characters?: MissionEditorCharacter[];
  clues?: MissionEditorClue[];
  roundOptions?: RoundRevealOption[];
  nodeOptions?: ProgressNodeRevealOption[];
  onAdd: () => void;
  onChange: (missionId: string, field: keyof Mission, value: string | number) => void;
  onDelete: (missionId: string) => void;
}

// ---------------------------------------------------------------------------
// MissionEditor
// ---------------------------------------------------------------------------

export function MissionEditor({
  missions,
  characters = [],
  clues = [],
  roundOptions = DEFAULT_MISSION_ROUND_OPTIONS,
  nodeOptions = DEFAULT_MISSION_NODE_OPTIONS,
  onAdd,
  onChange,
  onDelete,
}: MissionEditorProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-medium text-slate-400">히든 미션</h4>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
        >
          <Plus className="h-3 w-3" />
          추가
        </button>
      </div>
      {missions.length > 0 ? (
        <div className="space-y-3">
          {missions.map((mission) => (
            <MissionCard
              key={mission.id}
              mission={mission}
              characters={characters}
              clues={clues}
              roundOptions={roundOptions}
              nodeOptions={nodeOptions}
              onChange={onChange}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-600">미션이 없습니다</p>
      )}
    </div>
  );
}

function MissionCard({
  mission,
  characters,
  clues,
  roundOptions,
  nodeOptions,
  onChange,
  onDelete,
}: {
  mission: Mission;
  characters: MissionEditorCharacter[];
  clues: MissionEditorClue[];
  roundOptions: RoundRevealOption[];
  nodeOptions: ProgressNodeRevealOption[];
  onChange: (missionId: string, field: keyof Mission, value: string | number) => void;
  onDelete: (missionId: string) => void;
}) {
  const viewModel = toMissionViewModel(mission);
  const descriptionId = `mission-description-${mission.id}`;
  return (
    <div className="rounded border border-slate-800 bg-slate-900 p-3">
      <div className="mb-2 flex items-center justify-between">
        <select
          value={mission.type}
          onChange={(e) => onChange(mission.id, 'type', e.target.value)}
          className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300"
          aria-label="미션 유형"
        >
          {MISSION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onDelete(mission.id)}
          aria-label="미션 삭제"
          className="text-slate-600 hover:text-red-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <label className="sr-only" htmlFor={descriptionId}>미션 설명</label>
      <input
        id={descriptionId}
        type="text"
        value={mission.description}
        onChange={(e) => onChange(mission.id, 'description', e.target.value)}
        placeholder="미션 설명"
        className="mb-2 w-full rounded bg-slate-800 px-2 py-1 text-xs text-slate-300 placeholder-slate-600"
      />
      <div className="mb-2 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
        <label className="flex items-center gap-2">
          <span>포인트:</span>
          <input
            type="number"
            value={mission.points}
            onChange={(e) => onChange(mission.id, 'points', Number(e.target.value))}
            className="w-16 rounded bg-slate-800 px-2 py-1 text-xs text-slate-300"
          />
        </label>
        <label className="flex items-center gap-2">
          <span>공개:</span>
          <select
            value={mission.visibleFrom ?? 'game_start'}
            onChange={(e) => onChange(mission.id, 'visibleFrom', e.target.value)}
            className="min-w-0 flex-1 rounded bg-slate-800 px-2 py-1 text-xs text-slate-300"
            aria-label="미션 공개 시점"
          >
            {MISSION_REVEAL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {mission.visibleFrom === 'round_start' ? (
        <label className="mb-2 block text-xs text-slate-500">
          시작 라운드
          <select
            value={String(mission.revealRound ?? 1)}
            onChange={(e) => onChange(mission.id, 'revealRound', Number(e.target.value))}
            className="mt-1 w-full rounded bg-slate-800 px-2 py-1 text-xs text-slate-300"
          >
            {roundOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} 시작
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {mission.visibleFrom === 'node_reached' ? (
        <label className="mb-2 block text-xs text-slate-500">
          진행 노드
          <select
            value={mission.revealNodeId ?? nodeOptions[0]?.value ?? ''}
            onChange={(e) => onChange(mission.id, 'revealNodeId', e.target.value)}
            className="mt-1 w-full rounded bg-slate-800 px-2 py-1 text-xs text-slate-300 placeholder-slate-600"
          >
            {nodeOptions.length === 0 ? (
              <option value="">진행 장면 없음</option>
            ) : null}
            {nodeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="mb-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
        <span className="rounded-full bg-slate-800 px-2 py-0.5">{viewModel.revealLabel}</span>
        <span className="rounded-full bg-slate-800 px-2 py-0.5">{viewModel.verificationLabel}</span>
        <span className="rounded-full bg-slate-800 px-2 py-0.5">{viewModel.engineOwnerLabel}</span>
      </div>
      <MissionTypeFields
        mission={mission}
        characters={characters}
        clues={clues}
        onChange={onChange}
      />
      {viewModel.warnings.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] leading-4 text-amber-200">
          {viewModel.warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      )}
    </div>
  );
}

const DEFAULT_MISSION_ROUND_OPTIONS = Array.from({ length: 5 }, (_, index) => {
  const round = index + 1;
  return { value: round, label: `${round}라운드` };
});

const DEFAULT_MISSION_NODE_OPTIONS = [
  { value: 'intro_finished', label: '자기소개 종료' },
  { value: 'round_summary', label: '라운드 정리' },
  { value: 'voting_started', label: '투표 시작' },
];
