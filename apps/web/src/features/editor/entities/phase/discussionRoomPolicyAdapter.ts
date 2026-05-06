import type { DiscussionRoomPolicy } from "../../flowTypes";

export const DEFAULT_DISCUSSION_ROOM_POLICY: DiscussionRoomPolicy = {
  enabled: false,
  roomKind: "all",
  mainRoomName: "전체 토론",
  privateRoomsEnabled: false,
  privateRoomName: "밀담방",
  participantMode: "all",
  participantSummary: "",
  availability: "phase_active",
  conditionalRoomName: "",
  closeBehavior: "close_on_exit",
};

export function normalizeDiscussionRoomPolicy(
  policy: Partial<DiscussionRoomPolicy> | null | undefined,
): DiscussionRoomPolicy {
  return {
    ...DEFAULT_DISCUSSION_ROOM_POLICY,
    ...policy,
    roomKind: normalizeRoomKind(policy?.roomKind),
    mainRoomName: cleanName(policy?.mainRoomName, DEFAULT_DISCUSSION_ROOM_POLICY.mainRoomName),
    privateRoomName: cleanName(policy?.privateRoomName, DEFAULT_DISCUSSION_ROOM_POLICY.privateRoomName),
    participantMode: normalizeParticipantMode(policy?.participantMode),
    participantSummary: policy?.participantSummary?.trim() ?? "",
    availability: policy?.availability === "condition" ? "condition" : "phase_active",
    conditionalRoomName: policy?.conditionalRoomName?.trim() ?? "",
    closeBehavior: policy?.closeBehavior === "keep_until_next_scene"
      ? "keep_until_next_scene"
      : "close_on_exit",
  };
}

export function patchDiscussionRoomPolicy(
  current: Partial<DiscussionRoomPolicy> | null | undefined,
  patch: Partial<DiscussionRoomPolicy>,
): DiscussionRoomPolicy {
  return normalizeDiscussionRoomPolicy({ ...normalizeDiscussionRoomPolicy(current), ...patch });
}

export function formatDiscussionRoomSummary(policy: DiscussionRoomPolicy | null | undefined): string {
  const normalized = normalizeDiscussionRoomPolicy(policy);
  if (!normalized.enabled) return "토론방 사용 안 함";
  const rooms = [`${roomKindLabel(normalized.roomKind)}: ${normalized.mainRoomName}`];
  if (normalized.privateRoomsEnabled) rooms.push(normalized.privateRoomName);
  if (normalized.availability === "condition" && normalized.conditionalRoomName) {
    rooms.push(normalized.conditionalRoomName);
  }
  const availability = normalized.availability === "condition" ? "트리거가 열 때까지 대기" : "장면 시작 시";
  return [
    availability,
    participantLabel(normalized),
    normalized.closeBehavior === "keep_until_next_scene" ? "다음 장면까지 유지" : "장면 종료 시 닫기",
    rooms.join(", "),
  ].join(" · ");
}

function cleanName(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function normalizeRoomKind(value: unknown): DiscussionRoomPolicy["roomKind"] {
  if (value === "small_group" || value === "private") return value;
  return "all";
}

function normalizeParticipantMode(value: unknown): DiscussionRoomPolicy["participantMode"] {
  if (value === "characters" || value === "condition") return value;
  return "all";
}

function roomKindLabel(kind: DiscussionRoomPolicy["roomKind"]): string {
  if (kind === "small_group") return "소그룹 토론";
  if (kind === "private") return "비공개 토론";
  return "전체 토론";
}

function participantLabel(policy: DiscussionRoomPolicy): string {
  if (policy.participantMode === "characters") {
    return policy.participantSummary ? `참여자: ${policy.participantSummary}` : "특정 캐릭터 참여";
  }
  if (policy.participantMode === "condition") {
    return policy.participantSummary ? `조건: ${policy.participantSummary}` : "조건 만족 시 참여";
  }
  return "전원 참여";
}
