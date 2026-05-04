import { describe, expect, it, vi } from "vitest";
import {
  createMissionDraft,
  readCharacterMissionMap,
  toMissionRuntimeDraft,
  toMissionViewModel,
  writeCharacterMissionMap,
} from "../missionAdapter";

describe("missionAdapter", () => {
  it("legacy character_missions를 제작자용 미션 맵으로 정규화한다", () => {
    const missions = readCharacterMissionMap({
      character_missions: {
        "char-1": [
          { id: "m1", type: "possess", description: "비밀 편지를 가진다", points: 10, targetClueId: "clue-1" },
          { broken: true },
        ],
      },
    });

    expect(missions["char-1"]).toEqual([
      expect.objectContaining({ id: "m1", type: "possess", description: "비밀 편지를 가진다", points: 10 }),
      expect.objectContaining({ id: "mission-2", type: "secret", points: 0 }),
    ]);
  });

  it("새 미션은 결과 화면 공개와 수동 판정을 기본값으로 만든다", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("mission-new");
    expect(createMissionDraft()).toEqual({
      id: "mission-new",
      type: "secret",
      description: "",
      points: 0,
    });
    vi.restoreAllMocks();
  });

  it("제작자 타입을 runtime engine 후보 계약으로 변환한다", () => {
    expect(toMissionRuntimeDraft({
      id: "m1",
      type: "possess",
      description: "단서를 가진다",
      points: 7,
      targetClueId: "clue-1",
    })).toEqual({
      id: "m1",
      type: "hold_clue",
      description: "단서를 가진다",
      points: 7,
      verification: "auto",
      targetClueId: "clue-1",
    });
  });

  it("새 미션을 자동 판정 타입으로 바꾸면 runtime verification은 auto가 된다", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("mission-new");
    const draft = createMissionDraft();
    const runtime = toMissionRuntimeDraft({ ...draft, type: "possess", targetClueId: "clue-1" });

    expect(runtime).toEqual(expect.objectContaining({
      type: "hold_clue",
      verification: "auto",
    }));
    vi.restoreAllMocks();
  });

  it("제작자가 이해할 요약과 자동 판정 경고를 만든다", () => {
    expect(toMissionViewModel({ id: "m2", type: "kill", description: "", points: -1 })).toEqual({
      id: "m2",
      title: "미션 내용을 입력해 주세요",
      typeLabel: "살해",
      pointsLabel: "점수 없음",
      resultVisibilityLabel: "결과 화면에서 공개",
      runtimeType: "vote_target",
      warnings: [
        "플레이어가 이해할 미션 내용을 입력해 주세요.",
        "투표형 미션은 대상 캐릭터를 선택해야 자동 판정할 수 있습니다.",
      ],
    });
  });

  it("저장 payload는 legacy character_missions 경계에만 쓴다", () => {
    expect(writeCharacterMissionMap(
      { title: "기존 설정" },
      { "char-1": [{ id: "m1", type: "secret", description: "비밀", points: 0 }] },
    )).toEqual({
      title: "기존 설정",
      character_missions: { "char-1": [{ id: "m1", type: "secret", description: "비밀", points: 0 }] },
    });
  });
});
