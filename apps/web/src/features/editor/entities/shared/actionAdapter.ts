import type { PhaseAction } from "../../flowTypes";

export interface CreatorActionOption {
  value: string;
  label: string;
}

export const DELIVER_INFORMATION_ACTION = "DELIVER_INFORMATION";
export const LEGACY_DELIVER_INFORMATION_ACTION = "deliver_information";

export const CREATOR_ACTION_OPTIONS: CreatorActionOption[] = [
  { value: "broadcast", label: "공지 전달" },
  { value: "enable_voting", label: "투표 시작" },
  { value: "disable_voting", label: "투표 종료" },
  { value: "enable_chat", label: "채팅 열기" },
  { value: "disable_chat", label: "채팅 닫기" },
  { value: "play_bgm", label: "BGM 재생" },
  { value: "stop_bgm", label: "BGM 정지" },
];

const ACTION_LABELS = new Map<string, string>([
  ...CREATOR_ACTION_OPTIONS.map((option) => [option.value, option.label] as const),
  [DELIVER_INFORMATION_ACTION, "정보 전달"],
  [LEGACY_DELIVER_INFORMATION_ACTION, "정보 전달"],
]);

export function getCreatorActionLabel(type: string): string {
  return ACTION_LABELS.get(type) ?? "직접 설정한 실행";
}

export function isInformationDeliveryAction(action: PhaseAction): boolean {
  return action.type === DELIVER_INFORMATION_ACTION || action.type === LEGACY_DELIVER_INFORMATION_ACTION;
}

export function getVisibleCreatorActionOptions(hiddenTypes: string[] = []): CreatorActionOption[] {
  return CREATOR_ACTION_OPTIONS.filter((option) => !hiddenTypes.includes(option.value));
}

export function toCreatorActionLabels(
  actions: PhaseAction[],
  options: { excludeInformationDelivery?: boolean } = {},
): string[] {
  return actions
    .filter((action) => !options.excludeInformationDelivery || !isInformationDeliveryAction(action))
    .map((action) => getCreatorActionLabel(action.type));
}
