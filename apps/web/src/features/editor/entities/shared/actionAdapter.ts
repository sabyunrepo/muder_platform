import type { PhaseAction } from "../../flowTypes";

export interface CreatorActionOption {
  value: string;
  label: string;
}

export const DELIVER_INFORMATION_ACTION = "DELIVER_INFORMATION";
export const LEGACY_DELIVER_INFORMATION_ACTION = "deliver_information";

export const CREATOR_ACTION_OPTIONS: CreatorActionOption[] = [
  { value: "OPEN_VOTING", label: "투표 시작" },
  { value: "CLOSE_VOTING", label: "투표 종료" },
  { value: "UNMUTE_CHAT", label: "채팅 열기" },
  { value: "MUTE_CHAT", label: "채팅 닫기" },
  { value: "SET_BGM", label: "BGM 재생" },
  { value: "PLAY_SOUND", label: "효과음 재생" },
  { value: "PLAY_MEDIA", label: "영상 재생" },
  { value: "STOP_AUDIO", label: "BGM/효과음 정지" },
  { value: "SET_BACKGROUND", label: "배경 이미지 변경" },
  { value: "SET_THEME_COLOR", label: "화면 색상 테마 변경" },
];

const ACTION_LABELS = new Map<string, string>([
  ...CREATOR_ACTION_OPTIONS.map((option) => [option.value, option.label] as const),
  [DELIVER_INFORMATION_ACTION, "정보 전달"],
  [LEGACY_DELIVER_INFORMATION_ACTION, "정보 전달"],
  ["OPEN_GROUP_CHAT", "토론방 열기"],
  ["CLOSE_GROUP_CHAT", "토론방 닫기"],
  ["broadcast", "공지 전달"],
  ["enable_voting", "투표 시작"],
  ["disable_voting", "투표 종료"],
  ["enable_chat", "채팅 열기"],
  ["disable_chat", "채팅 닫기"],
  ["play_bgm", "BGM 재생"],
  ["play_sound", "효과음 재생"],
  ["play_media", "영상 재생"],
  ["set_background", "배경 이미지 변경"],
  ["set_theme_color", "화면 색상 테마 변경"],
  ["stop_bgm", "BGM 정지"],
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
