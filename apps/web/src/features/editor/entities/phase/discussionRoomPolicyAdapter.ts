import type { DiscussionPrivateRoomPolicy, DiscussionRoomPolicy } from "../../flowTypes";

export const DEFAULT_DISCUSSION_ROOM_POLICY: DiscussionRoomPolicy = {
  enabled: false,
  mainRoomName: "전체토론방",
  privateRooms: [],
  closeBehavior: "return_to_main",
  roomKind: "all",
  privateRoomsEnabled: false,
  privateRoomName: "밀담방",
  participantMode: "all",
  participantSummary: "",
  availability: "phase_active",
  conditionalRoomName: "",
};

export function normalizeDiscussionRoomPolicy(
  policy: Partial<DiscussionRoomPolicy> | null | undefined,
): DiscussionRoomPolicy {
  const privateRooms = normalizePrivateRooms(policy);

  return {
    ...DEFAULT_DISCUSSION_ROOM_POLICY,
    ...policy,
    enabled: policy?.enabled ?? DEFAULT_DISCUSSION_ROOM_POLICY.enabled,
    mainRoomName: cleanName(policy?.mainRoomName, DEFAULT_DISCUSSION_ROOM_POLICY.mainRoomName),
    privateRooms,
    closeBehavior: "return_to_main",
    roomKind: normalizeRoomKind(policy?.roomKind),
    privateRoomsEnabled: Array.isArray(policy?.privateRooms)
      ? privateRooms.length > 0
      : policy?.privateRoomsEnabled ?? privateRooms.length > 0,
    privateRoomName: cleanName(policy?.privateRoomName, DEFAULT_DISCUSSION_ROOM_POLICY.privateRoomName),
    participantMode: normalizeParticipantMode(policy?.participantMode),
    participantSummary: policy?.participantSummary?.trim() ?? "",
    availability: policy?.availability === "condition" ? "condition" : "phase_active",
    conditionalRoomName: policy?.conditionalRoomName?.trim() ?? "",
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

  const privateRoomSummary = normalized.privateRooms.length > 0
    ? `밀담방 ${normalized.privateRooms.length}개: ${normalized.privateRooms.map((room) => room.name).join(", ")}`
    : "밀담방 없음";

  return [`메인 토론방: ${normalized.mainRoomName}`, privateRoomSummary].join(" · ");
}

function cleanName(value: unknown, fallback: string): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed : fallback;
}

function normalizePrivateRooms(policy: Partial<DiscussionRoomPolicy> | null | undefined): DiscussionPrivateRoomPolicy[] {
  const hasExplicitPrivateRooms = Array.isArray(policy?.privateRooms);
  const privateRooms = hasExplicitPrivateRooms
    ? policy.privateRooms.map((room, index) => normalizePrivateRoom(room, index))
    : [];

  if (hasExplicitPrivateRooms || privateRooms.length > 0 || !policy?.privateRoomsEnabled) {
    return privateRooms;
  }

  return [
    {
      id: "private",
      name: cleanName(policy.privateRoomName, "밀담방"),
      maxMembers: 2,
      timeLimitSeconds: null,
    },
  ];
}

function normalizePrivateRoom(room: Partial<DiscussionPrivateRoomPolicy>, index: number): DiscussionPrivateRoomPolicy {
  return {
    id: cleanName(room.id, `private-${index + 1}`),
    name: cleanName(room.name, `밀담방 ${index + 1}`),
    maxMembers: normalizeMaxMembers(room.maxMembers),
    timeLimitSeconds: normalizeTimeLimitSeconds(room.timeLimitSeconds),
  };
}

function normalizeMaxMembers(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(2, Math.floor(value)) : 2;
}

function normalizeTimeLimitSeconds(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

function normalizeRoomKind(value: unknown): DiscussionRoomPolicy["roomKind"] {
  if (value === "small_group" || value === "private") return value;
  return "all";
}

function normalizeParticipantMode(value: unknown): DiscussionRoomPolicy["participantMode"] {
  if (value === "characters" || value === "condition") return value;
  return "all";
}
