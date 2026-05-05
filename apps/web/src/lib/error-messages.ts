import type { ApiError } from "@mmp/shared";

/** 에러 코드별 한국어 사용자 메시지 */
const ERROR_MESSAGES: Record<string, string> = {
  // Auth
  AUTH_TOKEN_EXPIRED: "세션이 만료되었습니다. 다시 로그인해주세요.",
  AUTH_TOKEN_INVALID: "인증 정보가 유효하지 않습니다.",
  AUTH_TOKEN_MISSING: "로그인이 필요합니다.",

  // Game
  GAME_NOT_FOUND: "게임을 찾을 수 없습니다.",
  GAME_FULL: "게임 정원이 가득 찼습니다.",
  GAME_NOT_STARTED: "아직 게임이 시작되지 않았습니다.",
  GAME_ALREADY_OVER: "이미 종료된 게임입니다.",

  // Session
  SESSION_NOT_FOUND: "세션을 찾을 수 없습니다.",
  SESSION_EXPIRED: "세션이 만료되었습니다.",

  // Player
  PLAYER_NOT_FOUND: "플레이어를 찾을 수 없습니다.",
  PLAYER_NOT_IN_GAME: "해당 게임에 참여하지 않은 플레이어입니다.",
  PLAYER_ALREADY_IN_GAME: "이미 게임에 참여 중입니다.",

  // Room
  ROOM_NOT_FOUND: "방을 찾을 수 없습니다.",
  ROOM_FULL: "방이 가득 찼습니다.",
  ROOM_NOT_WAITING: "현재 참가할 수 없는 방입니다.",

  // Reading
  READING_SECTION_NOT_FOUND: "리딩 섹션을 찾을 수 없습니다.",
  READING_ADVANCE_FORBIDDEN: "리딩을 진행할 권한이 없습니다.",
  READING_INVALID_ADVANCE_BY: "리딩 진행 모드가 올바르지 않습니다.",
  READING_LINE_OUT_OF_RANGE: "리딩 줄이 범위를 벗어났습니다.",
  READING_VOICE_REQUIRED: "음성 자동 진행 모드에는 음성 파일이 필요합니다.",

  // Media
  MEDIA_REFERENCE_IN_USE: "이 미디어는 다른 곳에서 사용 중이라 삭제할 수 없습니다.",
  MEDIA_NOT_IN_THEME: "이 테마에 속하지 않은 미디어입니다.",

  // Editor
  EDITOR_CONFIG_VERSION_MISMATCH:
    "다른 변경사항과 충돌했습니다. 최신 내용으로 새로고침 후 다시 저장해주세요.",

  // Generic
  BAD_REQUEST: "잘못된 요청입니다.",
  UNAUTHORIZED: "인증이 필요합니다.",
  FORBIDDEN: "접근 권한이 없습니다.",
  NOT_FOUND: "요청한 리소스를 찾을 수 없습니다.",
  CONFLICT: "요청이 충돌합니다. 다시 시도해주세요.",
  VALIDATION_ERROR: "입력값을 확인해주세요.",
  INTERNAL_ERROR: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
  TIMEOUT: "요청 시간이 초과되었습니다.",
};

const FALLBACK_MESSAGE = "알 수 없는 오류가 발생했습니다.";

/**
 * 에러 코드에 해당하는 사용자 친화적 메시지를 반환한다.
 * params가 있으면 {key} 형식의 플레이스홀더를 치환한다.
 */
export function getUserMessage(error: ApiError): string {
  const template =
    (error.code && ERROR_MESSAGES[error.code]) ?? FALLBACK_MESSAGE;

  if (error.params) {
    return template.replace(
      /\{(\w+)\}/g,
      (_, key: string) => String(error.params?.[key] ?? `{${key}}`),
    );
  }

  return template;
}

/**
 * 개발 환경에서는 detail을 포함한 상세 메시지를 반환한다.
 */
export function getDevMessage(error: ApiError): string {
  const userMsg = getUserMessage(error);
  if (import.meta.env.DEV && error.detail) {
    return `${userMsg}\n(${error.detail})`;
  }
  return userMsg;
}
