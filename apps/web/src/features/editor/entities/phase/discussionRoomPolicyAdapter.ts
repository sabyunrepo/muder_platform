import type { DiscussionRoomPolicy } from "../../flowTypes";

export const DEFAULT_DISCUSSION_ROOM_POLICY: DiscussionRoomPolicy = {
  enabled: false,
  mainRoomName: "전체 토론",
  privateRoomsEnabled: false,
  privateRoomName: "밀담방",
  availability: "phase_active",
  conditionalRoomName: "",
};

export function normalizeDiscussionRoomPolicy(
  policy: Partial<DiscussionRoomPolicy> | null | undefined,
): DiscussionRoomPolicy {
  return {
    ...DEFAULT_DISCUSSION_ROOM_POLICY,
    ...policy,
    mainRoomName: cleanName(policy?.mainRoomName, DEFAULT_DISCUSSION_ROOM_POLICY.mainRoomName),
    privateRoomName: cleanName(policy?.privateRoomName, DEFAULT_DISCUSSION_ROOM_POLICY.privateRoomName),
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
  const rooms = [normalized.mainRoomName];
  if (normalized.privateRoomsEnabled) rooms.push(normalized.privateRoomName);
  if (normalized.availability === "condition" && normalized.conditionalRoomName) {
    rooms.push(normalized.conditionalRoomName);
  }
  const availability = normalized.availability === "condition" ? "트리거 대기" : "장면 시작 시";
  return `${availability} · ${rooms.join(", ")}`;
}

function cleanName(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}
