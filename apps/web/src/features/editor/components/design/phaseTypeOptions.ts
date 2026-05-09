export const PHASE_TYPE_OPTIONS = [
  { value: "investigation", label: "수사" },
  { value: "discussion", label: "토론" },
  { value: "voting", label: "투표/질문" },
  { value: "story_progression", label: "리딩" },
] as const;

export type SupportedPhaseType = (typeof PHASE_TYPE_OPTIONS)[number]["value"];

export function normalizePhaseType(value: string | undefined): SupportedPhaseType {
  return PHASE_TYPE_OPTIONS.some((option) => option.value === value)
    ? (value as SupportedPhaseType)
    : "investigation";
}
