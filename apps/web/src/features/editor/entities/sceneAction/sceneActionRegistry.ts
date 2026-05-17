import type { CreatorActionOption } from "../shared/actionAdapter";
import {
  DELIVER_INFORMATION_ACTION,
  GRANT_CLUE_ACTION,
} from "../shared/actionAdapter";

export const DECK_INVESTIGATION_MODULE_ID = "deck_investigation";

export const SCENE_ACTION_TYPES = {
  SET_BGM: "SET_BGM",
  STOP_AUDIO: "STOP_AUDIO",
  PLAY_SOUND: "PLAY_SOUND",
  PLAY_MEDIA: "PLAY_MEDIA",
  SET_BACKGROUND: "SET_BACKGROUND",
  SET_THEME_COLOR: "SET_THEME_COLOR",
  BROADCAST_MESSAGE: "BROADCAST_MESSAGE",
  DELIVER_INFORMATION: DELIVER_INFORMATION_ACTION,
  GRANT_CLUE: GRANT_CLUE_ACTION,
  OPEN_VOTING: "OPEN_VOTING",
  CLOSE_VOTING: "CLOSE_VOTING",
  UNMUTE_CHAT: "UNMUTE_CHAT",
  MUTE_CHAT: "MUTE_CHAT",
  GRANT_INVESTIGATION_TOKEN: "GRANT_INVESTIGATION_TOKEN",
  RESET_INVESTIGATION_TOKEN: "RESET_INVESTIGATION_TOKEN",
} as const;

interface SceneActionDefinition extends CreatorActionOption {
  requiredModuleId?: string;
  defaultParams?: Record<string, unknown>;
}

const SCENE_ACTION_DEFINITIONS: SceneActionDefinition[] = [
  { value: SCENE_ACTION_TYPES.SET_BGM, label: "BGM 설정", defaultParams: {} },
  { value: SCENE_ACTION_TYPES.STOP_AUDIO, label: "BGM 종료", defaultParams: { scope: "bgm" } },
  { value: SCENE_ACTION_TYPES.PLAY_SOUND, label: "효과음 재생", defaultParams: {} },
  { value: SCENE_ACTION_TYPES.PLAY_MEDIA, label: "영상 재생", defaultParams: {} },
  { value: SCENE_ACTION_TYPES.SET_BACKGROUND, label: "배경 이미지 변경", defaultParams: {} },
  {
    value: SCENE_ACTION_TYPES.BROADCAST_MESSAGE,
    label: "알림 보내기",
    defaultParams: { message: "", target: { type: "all_players" } },
  },
  { value: SCENE_ACTION_TYPES.GRANT_CLUE, label: "단서 지급", defaultParams: { deliveries: [] } },
  { value: SCENE_ACTION_TYPES.OPEN_VOTING, label: "투표 시작", requiredModuleId: "voting" },
  { value: SCENE_ACTION_TYPES.CLOSE_VOTING, label: "투표 종료", requiredModuleId: "voting" },
  { value: SCENE_ACTION_TYPES.UNMUTE_CHAT, label: "채팅 열기", requiredModuleId: "text_chat" },
  { value: SCENE_ACTION_TYPES.MUTE_CHAT, label: "채팅 닫기", requiredModuleId: "text_chat" },
  {
    value: SCENE_ACTION_TYPES.GRANT_INVESTIGATION_TOKEN,
    label: "조사권 추가",
    requiredModuleId: DECK_INVESTIGATION_MODULE_ID,
    defaultParams: { tokenId: "", amount: 1 },
  },
  {
    value: SCENE_ACTION_TYPES.RESET_INVESTIGATION_TOKEN,
    label: "조사권 재설정",
    requiredModuleId: DECK_INVESTIGATION_MODULE_ID,
    defaultParams: { tokenId: "", mode: "default" },
  },
];

export function getSceneActionOptions({
  enabledModuleIds,
}: {
  enabledModuleIds: string[];
}): CreatorActionOption[] {
  const enabled = new Set(enabledModuleIds);
  return SCENE_ACTION_DEFINITIONS.filter(
    (definition) => !definition.requiredModuleId || enabled.has(definition.requiredModuleId),
  ).map(({ value, label }) => ({ value, label }));
}

export function createSceneActionDefaultParams(type: string): Record<string, unknown> | undefined {
  const definition = SCENE_ACTION_DEFINITIONS.find((item) => item.value === type);
  return definition?.defaultParams ? cloneDefaultParams(definition.defaultParams) : undefined;
}

function cloneDefaultParams(params: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(params)) as Record<string, unknown>;
}

export function isSceneActionComplete(action: { type: string; params?: Record<string, unknown> }): boolean {
  if (action.type === SCENE_ACTION_TYPES.STOP_AUDIO) {
    return true;
  }
  return true;
}
