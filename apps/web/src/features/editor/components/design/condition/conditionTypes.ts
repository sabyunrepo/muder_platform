// ---------------------------------------------------------------------------
// Condition Types — PR-6
// ---------------------------------------------------------------------------

export type ConditionVariable =
  | "mission_status"
  | "character_alive"
  | "vote_target"
  | "clue_held"
  | "custom_flag";

export type ConditionComparator = "=" | "!=" | ">" | "<";

export interface ConditionRule {
  id: string;
  variable: ConditionVariable;
  target_character_id?: string;
  target_mission_id?: string;
  target_clue_id?: string;
  comparator: ConditionComparator;
  value: string;
}

export interface ConditionGroup {
  id: string;
  operator: "AND" | "OR";
  rules: (ConditionRule | ConditionGroup)[];
}

// ---------------------------------------------------------------------------
// Variable metadata
// ---------------------------------------------------------------------------

export interface ConditionVariableMeta {
  value: ConditionVariable;
  label: string;
  needsCharacter: boolean;
  needsMission: boolean;
  needsClue: boolean;
}

export const CONDITION_VARIABLES: ConditionVariableMeta[] = [
  { value: "mission_status",  label: "미션 결과",     needsCharacter: true,  needsMission: true,  needsClue: false },
  { value: "character_alive", label: "캐릭터 생존",   needsCharacter: true,  needsMission: false, needsClue: false },
  { value: "vote_target",     label: "투표 대상",     needsCharacter: false, needsMission: false, needsClue: false },
  { value: "clue_held",       label: "단서 보유",     needsCharacter: true,  needsMission: false, needsClue: true  },
  { value: "custom_flag",     label: "커스텀 플래그", needsCharacter: false, needsMission: false, needsClue: false },
];

export const COMPARATOR_LABELS: Record<ConditionComparator, string> = {
  "=":  "=",
  "!=": "≠",
  ">":  ">",
  "<":  "<",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isGroup(
  item: ConditionRule | ConditionGroup,
): item is ConditionGroup {
  return "operator" in item;
}

export function createEmptyRule(): ConditionRule {
  return {
    id: crypto.randomUUID(),
    variable: "mission_status",
    comparator: "=",
    value: "",
  };
}

export function createEmptyGroup(): ConditionGroup {
  return {
    id: crypto.randomUUID(),
    operator: "AND",
    rules: [createEmptyRule()],
  };
}

export function groupToRecord(
  group: ConditionGroup,
): Record<string, unknown> {
  return group as unknown as Record<string, unknown>;
}

export function recordToGroup(
  raw: Record<string, unknown> | null,
): ConditionGroup {
  if (raw && typeof raw === "object" && "operator" in raw) {
    return raw as unknown as ConditionGroup;
  }
  return createEmptyGroup();
}
