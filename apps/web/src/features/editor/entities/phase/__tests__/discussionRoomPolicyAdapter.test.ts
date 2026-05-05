import { describe, expect, it } from "vitest";
import {
  formatDiscussionRoomSummary,
  normalizeDiscussionRoomPolicy,
  patchDiscussionRoomPolicy,
} from "../discussionRoomPolicyAdapter";

describe("discussionRoomPolicyAdapter", () => {
  it("빈 정책을 제작자 기본값으로 정규화한다", () => {
    expect(normalizeDiscussionRoomPolicy(undefined)).toEqual({
      enabled: false,
      mainRoomName: "전체 토론",
      privateRoomsEnabled: false,
      privateRoomName: "밀담방",
      availability: "phase_active",
      conditionalRoomName: "",
    });
  });

  it("조건부 토론방 이름과 밀담 설정을 저장 가능한 정책으로 병합한다", () => {
    expect(
      patchDiscussionRoomPolicy(
        { enabled: true, mainRoomName: " 전체 토론 " },
        {
          privateRoomsEnabled: true,
          privateRoomName: " 비밀 회의 ",
          availability: "condition",
          conditionalRoomName: " 단서 공개 후 ",
        },
      ),
    ).toEqual({
      enabled: true,
      mainRoomName: "전체 토론",
      privateRoomsEnabled: true,
      privateRoomName: "비밀 회의",
      availability: "condition",
      conditionalRoomName: "단서 공개 후",
    });
  });

  it("제작자 요약 문구를 만든다", () => {
    expect(formatDiscussionRoomSummary(undefined)).toBe("토론방 사용 안 함");
    expect(
      formatDiscussionRoomSummary({
        enabled: true,
        mainRoomName: "추리 회의",
        privateRoomsEnabled: true,
        privateRoomName: "밀담",
        availability: "phase_active",
      }),
    ).toBe("장면 시작 시 · 추리 회의, 밀담");
    expect(
      formatDiscussionRoomSummary({
        enabled: true,
        mainRoomName: "추리 회의",
        privateRoomsEnabled: false,
        privateRoomName: "밀담",
        availability: "condition",
        conditionalRoomName: "비밀 토론",
      }),
    ).toBe("트리거가 열 때까지 대기 · 추리 회의, 비밀 토론");
  });
});
