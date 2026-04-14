import type { Mission, MissionEditorCharacter, MissionEditorClue } from './MissionEditor';

type OnChange = (missionId: string, field: keyof Mission, value: string | number) => void;

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-xs text-slate-500">{children}</span>;
}

function CharacterSelect({ missionId, value, characters, onChange }: {
  missionId: string;
  value: string | undefined;
  characters: MissionEditorCharacter[];
  onChange: OnChange;
}) {
  return (
    <div className="flex flex-col gap-1">
      <FieldLabel>대상 캐릭터</FieldLabel>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(missionId, 'targetCharacterId', e.target.value)}
        className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300"
      >
        <option value="">선택 안 함</option>
        {characters.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </div>
  );
}

function ClueSelect({ missionId, value, clues, onChange }: {
  missionId: string;
  value: string | undefined;
  clues: MissionEditorClue[];
  onChange: OnChange;
}) {
  return (
    <div className="flex flex-col gap-1">
      <FieldLabel>대상 단서</FieldLabel>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(missionId, 'targetClueId', e.target.value)}
        className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300"
      >
        <option value="">선택 안 함</option>
        {clues.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field groups per mission type
// ---------------------------------------------------------------------------

export function KillFields({ mission, characters, onChange }: {
  mission: Mission;
  characters: MissionEditorCharacter[];
  onChange: OnChange;
}) {
  return (
    <div className="mt-2 space-y-2 border-t border-slate-800 pt-2">
      <CharacterSelect missionId={mission.id} value={mission.targetCharacterId} characters={characters} onChange={onChange} />
      <div className="flex flex-col gap-1">
        <FieldLabel>공모 조건</FieldLabel>
        <select
          value={mission.condition ?? '단독'}
          onChange={(e) => onChange(mission.id, 'condition', e.target.value)}
          className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300"
        >
          <option value="단독">단독</option>
          <option value="공모">공모</option>
        </select>
      </div>
    </div>
  );
}

export function PossessFields({ mission, clues, onChange }: {
  mission: Mission;
  clues: MissionEditorClue[];
  onChange: OnChange;
}) {
  return (
    <div className="mt-2 space-y-2 border-t border-slate-800 pt-2">
      <ClueSelect missionId={mission.id} value={mission.targetClueId} clues={clues} onChange={onChange} />
      <div className="flex items-center gap-2">
        <FieldLabel>수량</FieldLabel>
        <input
          type="number"
          min={1}
          value={mission.quantity ?? 1}
          onChange={(e) => onChange(mission.id, 'quantity', Number(e.target.value))}
          className="w-16 rounded bg-slate-800 px-2 py-1 text-xs text-slate-300"
        />
      </div>
      <div className="flex flex-col gap-1">
        <FieldLabel>조건</FieldLabel>
        <input
          type="text"
          value={mission.condition ?? ''}
          onChange={(e) => onChange(mission.id, 'condition', e.target.value)}
          placeholder="보유 조건 설명"
          className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300 placeholder-slate-600"
        />
      </div>
    </div>
  );
}

export function SecretFields({ mission, onChange }: {
  mission: Mission;
  onChange: OnChange;
}) {
  return (
    <div className="mt-2 space-y-2 border-t border-slate-800 pt-2">
      <div className="flex flex-col gap-1">
        <FieldLabel>비밀 내용</FieldLabel>
        <textarea
          value={mission.secretContent ?? ''}
          onChange={(e) => onChange(mission.id, 'secretContent', e.target.value)}
          placeholder="비밀 내용을 입력하세요"
          rows={2}
          className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300 placeholder-slate-600 resize-none"
        />
      </div>
      <div className="flex items-center gap-2">
        <FieldLabel>패널티</FieldLabel>
        <input
          type="number"
          min={0}
          value={mission.penalty ?? 0}
          onChange={(e) => onChange(mission.id, 'penalty', Number(e.target.value))}
          className="w-16 rounded bg-slate-800 px-2 py-1 text-xs text-slate-300"
        />
      </div>
      <div className="flex items-center gap-2">
        <FieldLabel>난이도 (1–5)</FieldLabel>
        <input
          type="number"
          min={1}
          max={5}
          value={mission.difficulty ?? 1}
          onChange={(e) => onChange(mission.id, 'difficulty', Number(e.target.value))}
          className="w-16 rounded bg-slate-800 px-2 py-1 text-xs text-slate-300"
        />
      </div>
    </div>
  );
}

export function ProtectFields({ mission, characters, clues, onChange }: {
  mission: Mission;
  characters: MissionEditorCharacter[];
  clues: MissionEditorClue[];
  onChange: OnChange;
}) {
  return (
    <div className="mt-2 space-y-2 border-t border-slate-800 pt-2">
      <CharacterSelect missionId={mission.id} value={mission.targetCharacterId} characters={characters} onChange={onChange} />
      <ClueSelect missionId={mission.id} value={mission.targetClueId} clues={clues} onChange={onChange} />
      <div className="flex flex-col gap-1">
        <FieldLabel>조건</FieldLabel>
        <input
          type="text"
          value={mission.condition ?? ''}
          onChange={(e) => onChange(mission.id, 'condition', e.target.value)}
          placeholder="보호 조건 설명"
          className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300 placeholder-slate-600"
        />
      </div>
    </div>
  );
}
