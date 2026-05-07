import type { AdvanceBy, ReadingLineDTO } from '../../readingApi';
import type { CharacterOption } from './readingBlockUiTypes';

export function AdvanceField({
  line,
  characters,
  onChange,
  compact = false,
  allowVoice = true,
}: {
  line: ReadingLineDTO;
  characters: CharacterOption[];
  onChange: (patch: Partial<ReadingLineDTO>) => void;
  compact?: boolean;
  allowVoice?: boolean;
}) {
  const canSelectRole = characters.length > 0;
  const advanceBy = line.AdvanceBy ?? 'gm';
  const mode = advanceBy.startsWith('role:')
    ? canSelectRole
      ? 'role'
      : 'gm'
    : advanceBy === 'voice' && allowVoice
      ? 'voice'
      : 'gm';
  const roleId = advanceBy.startsWith('role:') ? advanceBy.slice('role:'.length) : '';

  function setMode(nextMode: string) {
    if (nextMode === 'voice' && !allowVoice) {
      onChange({ AdvanceBy: 'gm' });
      return;
    }
    if (nextMode === 'role') {
      if (!canSelectRole) {
        onChange({ AdvanceBy: 'gm' });
        return;
      }
      onChange({ AdvanceBy: `role:${characters[0].id}` as AdvanceBy });
      return;
    }
    onChange({ AdvanceBy: nextMode as AdvanceBy });
  }

  return (
    <div className={compact ? 'flex items-center gap-2' : 'min-w-0'}>
      {!compact && <p className="mb-1 text-xs text-slate-500">진행</p>}
      <select
        aria-label="진행 방식"
        className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100"
        value={mode}
        onChange={(event) => setMode(event.target.value)}
      >
        <option value="gm">방장</option>
        {allowVoice && <option value="voice">음성 자동</option>}
        {canSelectRole && <option value="role">역할 지정</option>}
      </select>
      {mode === 'role' && (
        <select
          aria-label="진행 역할"
          className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100"
          value={roleId}
          onChange={(event) => onChange({ AdvanceBy: `role:${event.target.value}` as AdvanceBy })}
        >
          {characters.map((character) => (
            <option key={character.id} value={character.id}>
              {character.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
