export const DEFAULT_CONDITION_LABEL = "분기 조건";
export const CONDITION_HELP_TEXT = "조건은 페이즈 이동, 결말 판정, 단서 효과에서 같은 방식으로 재사용됩니다.";

const CONDITION_VARIABLE_LABELS: Record<string, string> = {
  mission_status: "미션 결과",
  character_alive: "캐릭터 생존",
  vote_target: "투표 대상",
  clue_held: "단서 보유",
  custom_flag: "직접 설정한 조건",
};

const CONDITION_OPERATOR_LABELS: Record<string, string> = {
  AND: "모든 조건",
  OR: "하나 이상",
};

export function getConditionVariableLabel(variable: string): string {
  return CONDITION_VARIABLE_LABELS[variable] ?? "직접 설정한 조건";
}

export function getConditionOperatorLabel(operator: string): string {
  return CONDITION_OPERATOR_LABELS[operator] ?? "조건 그룹";
}

export function describeConditionRecord(condition: Record<string, unknown> | null): string {
  if (!condition || typeof condition !== "object") return "조건 없음";
  const operator = typeof condition.operator === "string" ? condition.operator : "AND";
  const rules = Array.isArray(condition.rules) ? condition.rules : [];
  return `${getConditionOperatorLabel(operator)} · ${rules.length}개 규칙`;
}
