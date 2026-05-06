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
      roomKind: "all",
      mainRoomName: "전체 토론",
      privateRoomsEnabled: false,
      privateRoomName: "밀담방",
      participantMode: "all",
      participantSummary: "",
      availability: "phase_active",
      conditionalRoomName: "",
      closeBehavior: "close_on_exit",
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
      roomKind: "all",
      mainRoomName: "전체 토론",
      privateRoomsEnabled: true,
      privateRoomName: "비밀 회의",
      participantMode: "all",
      participantSummary: "",
      availability: "condition",
      conditionalRoomName: "단서 공개 후",
      closeBehavior: "close_on_exit",
    });
  });

  it("토론 유형, 참여 대상, 종료 정책을 저장 가능한 정책으로 병합한다", () => {
    expect(
      patchDiscussionRoomPolicy(undefined, {
        enabled: true,
        roomKind: "small_group",
        participantMode: "characters",
        participantSummary: "탐정, 목격자",
        closeBehavior: "keep_until_next_scene",
      }),
    ).toMatchObject({
      enabled: true,
      roomKind: "small_group",
      participantMode: "characters",
      participantSummary: "탐정, 목격자",
      closeBehavior: "keep_until_next_scene",
    });
  });

  it("제작자 요약 문구를 만든다", () => {
    expect(formatDiscussionRoomSummary(undefined)).toBe("토론방 사용 안 함");
    expect(
      formatDiscussionRoomSummary({
        enabled: true,
        roomKind: "all",
        mainRoomName: "추리 회의",
        privateRoomsEnabled: true,
        privateRoomName: "밀담",
        participantMode: "all",
        availability: "phase_active",
        closeBehavior: "close_on_exit",
      }),
    ).toBe("장면 시작 시 · 전원 참여 · 장면 종료 시 닫기 · 전체 토론: 추리 회의, 밀담");
    expect(
      formatDiscussionRoomSummary({
        enabled: true,
        roomKind: "private",
        mainRoomName: "추리 회의",
        privateRoomsEnabled: false,
        privateRoomName: "밀담",
        participantMode: "condition",
        participantSummary: "단서 A 보유자",
        availability: "condition",
        conditionalRoomName: "비밀 토론",
        closeBehavior: "keep_until_next_scene",
      }),
    ).toBe(
      "트리거가 열 때까지 대기 · 조건: 단서 A 보유자 · 다음 장면까지 유지 · 비공개 토론: 추리 회의, 비밀 토론",
    );
  });
});
