import { describe, expect, it } from "vitest";
import {
  formatDiscussionRoomSummary,
  normalizeDiscussionRoomPolicy,
  patchDiscussionRoomPolicy,
} from "../discussionRoomPolicyAdapter";

describe("discussionRoomPolicyAdapter", () => {
  it("빈 정책을 새 토론방 기본값으로 정규화한다", () => {
    expect(normalizeDiscussionRoomPolicy(undefined)).toEqual({
      enabled: false,
      mainRoomName: "전체토론방",
      privateRooms: [],
      closeBehavior: "return_to_main",
      privateRoomsEnabled: false,
      roomKind: "all",
      privateRoomName: "밀담방",
      participantMode: "all",
      participantSummary: "",
      availability: "phase_active",
      conditionalRoomName: "",
    });
  });

  it("여러 밀담방 이름, 최소 인원, 무제한 시간을 정규화한다", () => {
    expect(
      normalizeDiscussionRoomPolicy({
        enabled: true,
        mainRoomName: " 추리 회의 ",
        privateRooms: [
          { id: " alpha ", name: " 비밀 회의 ", maxMembers: 1, timeLimitSeconds: 300 },
          { id: "", name: " ", maxMembers: 4, timeLimitSeconds: 0 },
          { id: "gamma", name: "단서방", maxMembers: Number.NaN, timeLimitSeconds: "invalid" as never },
        ],
      }),
    ).toMatchObject({
      enabled: true,
      mainRoomName: "추리 회의",
      privateRooms: [
        { id: "alpha", name: "비밀 회의", maxMembers: 2, timeLimitSeconds: 300 },
        { id: "private-2", name: "밀담방 2", maxMembers: 4, timeLimitSeconds: null },
        { id: "gamma", name: "단서방", maxMembers: 2, timeLimitSeconds: null },
      ],
      closeBehavior: "return_to_main",
    });
  });

  it("레거시 밀담 설정을 단일 privateRooms 항목으로 변환한다", () => {
    expect(
      normalizeDiscussionRoomPolicy({
        privateRoomsEnabled: true,
        privateRoomName: " 비밀 회의 ",
      }),
    ).toMatchObject({
      privateRooms: [{ id: "private", name: "비밀 회의", maxMembers: 2, timeLimitSeconds: null }],
    });
  });

  it("패치가 새 privateRooms 형태를 보존하고 정규화한다", () => {
    expect(
      patchDiscussionRoomPolicy(
        {
          enabled: true,
          mainRoomName: " 전체 토론 ",
          privateRooms: [{ id: "old", name: "기존방", maxMembers: 3, timeLimitSeconds: null }],
        },
        {
          privateRooms: [
            { id: "updated", name: " 갱신방 ", maxMembers: 1, timeLimitSeconds: -10 },
            { id: "", name: "", maxMembers: 5, timeLimitSeconds: undefined },
          ],
        },
      ),
    ).toMatchObject({
      enabled: true,
      mainRoomName: "전체 토론",
      privateRooms: [
        { id: "updated", name: "갱신방", maxMembers: 2, timeLimitSeconds: null },
        { id: "private-2", name: "밀담방 2", maxMembers: 5, timeLimitSeconds: null },
      ],
      closeBehavior: "return_to_main",
    });
  });

  it("명시적인 빈 privateRooms 패치는 마지막 밀담방을 제거한다", () => {
    expect(
      patchDiscussionRoomPolicy(
        {
          enabled: true,
          privateRoomsEnabled: true,
          privateRoomName: "기존 밀담",
        },
        { privateRooms: [] },
      ),
    ).toMatchObject({
      enabled: true,
      privateRooms: [],
      privateRoomsEnabled: false,
    });
  });

  it("제작자 요약 문구에 메인 토론방과 밀담방 이름을 포함한다", () => {
    expect(formatDiscussionRoomSummary(undefined)).toBe("토론방 사용 안 함");
    expect(
      formatDiscussionRoomSummary({
        enabled: true,
        mainRoomName: "추리 회의",
        privateRooms: [
          { id: "a", name: "밀담 A", maxMembers: 2, timeLimitSeconds: null },
          { id: "b", name: "밀담 B", maxMembers: 3, timeLimitSeconds: 120 },
        ],
        closeBehavior: "return_to_main",
      }),
    ).toBe("메인 토론방: 추리 회의 · 밀담방 2개: 밀담 A, 밀담 B");
  });
});
