// ---------------------------------------------------------------------------
// Condition Types — PR-6
// ---------------------------------------------------------------------------

export type ConditionVariable =
  | "mission_status"
  | "character_alive"
  | "vote_target"
  | "clue_held"
  | "trigger_count"
  | "investigation_token"
  | "scene_visit_count"
  | "room_state"
  | "location_state"
  | "custom_flag";

export type ConditionComparator = "=" | "!=" | ">" | "<" | ">=" | "<=";

export interface ConditionRule {
  id: string;
  variable: ConditionVariable;
  target_character_id?: string;
  target_mission_id?: string;
  target_clue_id?: string;
  target_trigger_id?: string;
  target_token_id?: string;
  target_scene_id?: string;
  target_room_id?: string;
  target_location_id?: string;
  target_flag_key?: string;
  comparator: ConditionComparator;
  value: string;
}

export interface ConditionGroup {
  id: string;
  operator: "AND" | "OR";
  rules: (ConditionRule | ConditionGroup)[];
}

export const CONDITION_SCHEMA_VERSION = 1;
export const MAX_CONDITION_DEPTH = 3;

// ---------------------------------------------------------------------------
// Variable metadata
// ---------------------------------------------------------------------------

export interface ConditionVariableMeta {
  value: ConditionVariable;
  label: string;
  needsCharacter: boolean;
  needsMission: boolean;
  needsClue: boolean;
  valueSelect?: "character" | "boolean";
  targetLabel?: string;
  targetKind?: "trigger" | "token" | "scene" | "room" | "location" | "flag";
  valueLabel?: string;
}

export const CONDITION_VARIABLES: ConditionVariableMeta[] = [
  { value: "mission_status",      label: "미션 결과",       needsCharacter: true,  needsMission: true,  needsClue: false, valueLabel: "상태" },
  { value: "character_alive",     label: "캐릭터 생존",     needsCharacter: true,  needsMission: false, needsClue: false, valueSelect: "boolean", valueLabel: "true/false" },
  { value: "vote_target",         label: "투표 대상",       needsCharacter: false, needsMission: false, needsClue: false, valueSelect: "character", valueLabel: "캐릭터" },
  { value: "clue_held",           label: "단서 보유",       needsCharacter: true,  needsMission: false, needsClue: true, valueSelect: "boolean", valueLabel: "true/false" },
  { value: "trigger_count",       label: "트리거 실행 횟수", needsCharacter: false, needsMission: false, needsClue: false, targetLabel: "트리거", targetKind: "trigger", valueLabel: "횟수" },
  { value: "investigation_token", label: "조사권 수",       needsCharacter: true,  needsMission: false, needsClue: false, targetLabel: "조사권", targetKind: "token", valueLabel: "수량" },
  { value: "scene_visit_count",   label: "장면 반복 횟수",   needsCharacter: false, needsMission: false, needsClue: false, targetLabel: "장면", targetKind: "scene", valueLabel: "횟수" },
  { value: "room_state",          label: "토론방 상태",     needsCharacter: false, needsMission: false, needsClue: false, targetLabel: "토론방", targetKind: "room", valueLabel: "상태" },
  { value: "location_state",      label: "장소 상태",       needsCharacter: false, needsMission: false, needsClue: false, targetLabel: "장소", targetKind: "location", valueLabel: "상태" },
  { value: "custom_flag",         label: "커스텀 플래그",   needsCharacter: false, needsMission: false, needsClue: false, targetLabel: "플래그 이름", targetKind: "flag", valueLabel: "값" },
];

export const COMPARATOR_LABELS: Record<ConditionComparator, string> = {
  "=":  "=",
  "!=": "≠",
  ">":  ">",
  "<":  "<",
  ">=": "≥",
  "<=": "≤",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isGroup(item: ConditionRule | ConditionGroup): item is ConditionGroup {
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
  if (isConditionGroupRecord(raw)) {
    return raw as unknown as ConditionGroup;
  }
  return createEmptyGroup();
}

export function isConditionGroupRecord(raw: unknown, depth = 0, requireComplete = false): raw is ConditionGroup {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || depth > MAX_CONDITION_DEPTH) {
    return false;
  }
  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.id !== "string" || !["AND", "OR"].includes(String(candidate.operator))) {
    return false;
  }
  if (!Array.isArray(candidate.rules) || candidate.rules.length === 0) return false;
  return candidate.rules.every((item) =>
    isConditionRuleRecord(item, requireComplete) || isConditionGroupRecord(item, depth + 1, requireComplete),
  );
}

export function isConditionRuleRecord(raw: unknown, requireComplete = false): raw is ConditionRule {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const candidate = raw as Record<string, unknown>;
  const variables = new Set(CONDITION_VARIABLES.map((item) => item.value));
  const comparators = new Set(Object.keys(COMPARATOR_LABELS));
  if (
    typeof candidate.id === "string" &&
    typeof candidate.variable === "string" &&
    variables.has(candidate.variable as ConditionVariable) &&
    typeof candidate.comparator === "string" &&
    comparators.has(candidate.comparator) &&
    typeof candidate.value === "string"
  ) {
    return !requireComplete || hasRequiredConditionTargets(candidate as unknown as ConditionRule);
  }
  return false;
}

export function isCompleteConditionGroupRecord(raw: unknown): raw is ConditionGroup {
  return isConditionGroupRecord(raw, 0, true);
}

export function hasRequiredConditionTargets(rule: ConditionRule): boolean {
  switch (rule.variable) {
    case "mission_status":
      return Boolean(rule.target_character_id && rule.target_mission_id);
    case "character_alive":
      return Boolean(rule.target_character_id);
    case "vote_target":
      return Boolean(rule.value);
    case "clue_held":
      return Boolean(rule.target_character_id && rule.target_clue_id);
    case "trigger_count":
      return Boolean(rule.target_trigger_id);
    case "investigation_token":
      return Boolean(rule.target_character_id && rule.target_token_id);
    case "scene_visit_count":
      return Boolean(rule.target_scene_id);
    case "room_state":
      return Boolean(rule.target_room_id);
    case "location_state":
      return Boolean(rule.target_location_id);
    case "custom_flag":
      return Boolean(rule.target_flag_key);
    default:
      return false;
  }
}
