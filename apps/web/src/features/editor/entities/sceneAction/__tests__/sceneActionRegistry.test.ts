import { describe, expect, it } from "vitest";
import {
  createSceneActionDefaultParams,
  DECK_INVESTIGATION_MODULE_ID,
  getSceneActionOptions,
  isSceneActionComplete,
} from "../sceneActionRegistry";

describe("sceneActionRegistry", () => {
  it("조사권 모듈이 꺼져 있으면 조사권 액션을 새 액션 목록에서 숨긴다", () => {
    const options = getSceneActionOptions({ enabledModuleIds: [] });

    expect(options.some((option) => option.value === "SET_BGM")).toBe(true);
    expect(options.some((option) => option.value === "SET_THEME_COLOR")).toBe(false);
    expect(options.some((option) => option.value === "DELIVER_INFORMATION")).toBe(false);
    expect(options.some((option) => option.value === "GRANT_INVESTIGATION_TOKEN")).toBe(false);
    expect(options.some((option) => option.value === "RESET_INVESTIGATION_TOKEN")).toBe(false);
  });

  it("조사권 모듈이 켜져 있으면 조사권 추가와 재설정을 노출한다", () => {
    const options = getSceneActionOptions({
      enabledModuleIds: [DECK_INVESTIGATION_MODULE_ID],
    });

    expect(options.some((option) => option.value === "GRANT_INVESTIGATION_TOKEN")).toBe(true);
    expect(options.some((option) => option.value === "RESET_INVESTIGATION_TOKEN")).toBe(true);
  });

  it("장면 액션별 기본 params를 만든다", () => {
    expect(createSceneActionDefaultParams("SET_BGM")).toEqual({});
    expect(createSceneActionDefaultParams("STOP_AUDIO")).toEqual({ scope: "bgm" });
    expect(createSceneActionDefaultParams("BROADCAST_MESSAGE")).toEqual({
      message: "",
      target: { type: "all_players" },
    });
    expect(createSceneActionDefaultParams("GRANT_CLUE")).toEqual({ deliveries: [] });
    expect(createSceneActionDefaultParams("GRANT_INVESTIGATION_TOKEN")).toEqual({
      tokenId: "",
      amount: 1,
    });
    expect(createSceneActionDefaultParams("RESET_INVESTIGATION_TOKEN")).toEqual({
      tokenId: "",
      mode: "default",
    });
  });

  it("중첩된 기본 params를 호출마다 새 객체로 만든다", () => {
    const firstBroadcast = createSceneActionDefaultParams("BROADCAST_MESSAGE");
    const secondBroadcast = createSceneActionDefaultParams("BROADCAST_MESSAGE");
    const firstTarget = firstBroadcast?.target as { type: string };

    firstTarget.type = "character";

    expect(secondBroadcast).toEqual({
      message: "",
      target: { type: "all_players" },
    });

    const firstGrant = createSceneActionDefaultParams("GRANT_CLUE");
    const secondGrant = createSceneActionDefaultParams("GRANT_CLUE");
    const firstDeliveries = firstGrant?.deliveries as unknown[];

    firstDeliveries.push({ id: "grant-1" });

    expect(secondGrant).toEqual({ deliveries: [] });
  });

  it("BGM 종료 액션은 별도 미디어 선택 없이 완료 상태다", () => {
    expect(isSceneActionComplete({ type: "STOP_AUDIO", params: { scope: "bgm" } })).toBe(true);
  });
});
