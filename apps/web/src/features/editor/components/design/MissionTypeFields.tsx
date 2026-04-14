import type { Mission, MissionEditorCharacter, MissionEditorClue } from './MissionEditor';
import { KillFields, PossessFields, SecretFields, ProtectFields } from './MissionTypeFieldGroups';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MissionTypeFieldsProps {
  mission: Mission;
  characters: MissionEditorCharacter[];
  clues: MissionEditorClue[];
  onChange: (missionId: string, field: keyof Mission, value: string | number) => void;
}

// ---------------------------------------------------------------------------
// MissionTypeFields
// ---------------------------------------------------------------------------

export function MissionTypeFields({ mission, characters, clues, onChange }: MissionTypeFieldsProps) {
  switch (mission.type) {
    case 'kill':
      return <KillFields mission={mission} characters={characters} onChange={onChange} />;
    case 'possess':
      return <PossessFields mission={mission} clues={clues} onChange={onChange} />;
    case 'secret':
      return <SecretFields mission={mission} onChange={onChange} />;
    case 'protect':
      return <ProtectFields mission={mission} characters={characters} clues={clues} onChange={onChange} />;
    default:
      return null;
  }
}
