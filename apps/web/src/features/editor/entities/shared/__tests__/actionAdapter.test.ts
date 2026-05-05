import { describe, expect, it } from "vitest";
import {
  DELIVER_INFORMATION_ACTION,
  getCreatorActionLabel,
  getVisibleCreatorActionOptions,
  isInformationDeliveryAction,
  toCreatorActionLabels,
} from "../actionAdapter";

describe("actionAdapter", () => {
  it("creator-facing label을 공통으로 제공하고 내부 코드를 숨길 수 있다", () => {
    expect(getCreatorActionLabel("broadcast")).toBe("공지 전달");
    expect(getCreatorActionLabel("unknown_custom_action")).toBe("직접 설정한 실행");
  });

  it("정보 전달 action의 legacy/current 타입을 동일하게 판정한다", () => {
    expect(isInformationDeliveryAction({ type: DELIVER_INFORMATION_ACTION })).toBe(true);
    expect(isInformationDeliveryAction({ type: "deliver_information" })).toBe(true);
    expect(isInformationDeliveryAction({ type: "SET_BGM" })).toBe(false);
  });

  it("hidden type을 제외한 선택 옵션을 반환한다", () => {
    expect(getVisibleCreatorActionOptions(["SET_BGM"]).map((option) => option.value)).not.toContain(
      "SET_BGM",
    );
    expect(getVisibleCreatorActionOptions().map((option) => option.value)).toEqual([
      "OPEN_VOTING",
      "CLOSE_VOTING",
      "UNMUTE_CHAT",
      "MUTE_CHAT",
      "SET_BGM",
      "PLAY_SOUND",
      "PLAY_MEDIA",
      "STOP_AUDIO",
    ]);
  });

  it("정보 전달은 phase summary의 일반 action 목록에서 제외할 수 있다", () => {
    expect(
      toCreatorActionLabels(
        [{ type: "SET_BGM" }, { type: DELIVER_INFORMATION_ACTION }, { type: "MUTE_CHAT" }],
        { excludeInformationDelivery: true },
      ),
    ).toEqual(["BGM 재생", "채팅 닫기"]);
  });

  it("legacy 소문자 action도 기존 저장 데이터용 라벨을 유지한다", () => {
    expect(toCreatorActionLabels([{ type: "play_bgm" }, { type: "disable_chat" }])).toEqual([
      "BGM 재생",
      "채팅 닫기",
    ]);
  });
});
