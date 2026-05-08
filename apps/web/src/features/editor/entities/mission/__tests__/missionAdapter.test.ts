import { describe, expect, it, vi } from "vitest";
import {
  createMissionDraft,
  readCharacterMissionMap,
  toMissionEngineContractDraft,
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
      verification: "auto",
      visibleFrom: "game_start",
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
      condition: "토론 이후 공개",
    })).toEqual({
      id: "m1",
      type: "hold_clue",
      description: "단서를 가진다",
      points: 7,
      verification: "auto",
      resultVisibility: "result_only",
      engineOwner: "backend_engine",
      visibleFrom: "game_start",
      targetClueId: "clue-1",
      legacyConditionNote: "토론 이후 공개",
    });
  });

  it("미션 조건 메모는 공백을 제거하고 빈 값은 runtime 후보에서 제외한다", () => {
    expect(toMissionRuntimeDraft({
      id: "m-trim",
      type: "secret",
      description: "비밀",
      points: 1,
      condition: "  토론 이후 공개  ",
    })).toEqual(expect.objectContaining({
      legacyConditionNote: "토론 이후 공개",
    }));

    expect(toMissionRuntimeDraft({
      id: "m-empty",
      type: "secret",
      description: "비밀",
      points: 1,
      condition: "   ",
    })).not.toHaveProperty("legacyConditionNote");
  });

  it("새 미션을 자동 판정 타입으로 바꾸면 runtime verification은 auto가 된다", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("mission-new");
    const draft = createMissionDraft();
    const runtime = toMissionRuntimeDraft({ ...draft, type: "possess", targetClueId: "clue-1" });

    expect(runtime).toEqual(expect.objectContaining({
      type: "hold_clue",
      verification: "auto",
      resultVisibility: "result_only",
      engineOwner: "backend_engine",
      visibleFrom: "game_start",
    }));
    vi.restoreAllMocks();
  });

  it("legacy 수동 판정값이 있어도 runtime 후보는 auto로 정규화하되 자동 판정 집계와 분리한다", () => {
    const runtime = toMissionRuntimeDraft({
      id: "m-custom",
      type: "secret",
      description: "비밀을 지킨다",
      points: 3,
      verification: "gm_verify",
    });

    expect(runtime).toEqual(expect.objectContaining({
      type: "custom",
      verification: "auto",
    }));
    expect(toMissionEngineContractDraft({
      "char-1": [
        {
          id: "m-custom",
          type: "secret",
          description: "비밀을 지킨다",
          points: 3,
          verification: "gm_verify",
        },
      ],
    }).assignments[0]).toEqual(expect.objectContaining({
      autoVerifiableCount: 0,
      manualReviewCount: 0,
    }));
  });

  it("제작자가 이해할 요약과 자동 판정 경고를 만든다", () => {
    expect(toMissionViewModel({ id: "m2", type: "kill", description: "", points: -1, condition: "공모", visibleFrom: "round_start", revealRound: 2 })).toEqual({
      id: "m2",
      title: "미션 내용을 입력해 주세요",
      typeLabel: "살해",
      pointsLabel: "점수 없음",
      resultVisibilityLabel: "결과 화면에서만 공개",
      runtimeType: "vote_target",
      verification: "auto",
      verificationLabel: "엔진 연동 필요",
      revealLabel: "2라운드 시작부터",
      engineOwnerLabel: "게임 판정은 백엔드가 담당",
      warnings: [
        "플레이어가 이해할 미션 내용을 입력해 주세요.",
        "투표형 미션은 대상 캐릭터를 선택해야 자동 판정할 수 있습니다.",
        "미션 조건 메모는 제작자 참고용이며, 실제 진행 분기는 스토리 이동 조건에서 판정됩니다.",
      ],
    });
  });

  it("캐릭터별 미션을 백엔드 엔진 후보 계약으로 요약한다", () => {
    expect(toMissionEngineContractDraft({
      "char-1": [
        { id: "m1", type: "possess", description: "편지를 가진다", points: 5, targetClueId: "clue-1" },
        { id: "m2", type: "secret", description: "비밀을 지킨다", points: 0 },
      ],
      "char-empty": [],
    })).toEqual({
      moduleId: "hidden_mission",
      resultVisibility: "result_only",
      engineOwner: "backend_engine",
      assignments: [
        {
          characterId: "char-1",
          totalPoints: 5,
          autoVerifiableCount: 1,
          manualReviewCount: 0,
          missions: [
            expect.objectContaining({ id: "m1", type: "hold_clue", verification: "auto" }),
            expect.objectContaining({ id: "m2", type: "custom", verification: "auto" }),
          ],
        },
      ],
    });
  });

  it("미션 공개 시점 필드를 저장 DTO와 runtime 후보에 유지한다", () => {
    expect(toMissionRuntimeDraft({
      id: "m-round",
      type: "possess",
      description: "2라운드 이후 단서를 가진다",
      points: 5,
      targetClueId: "clue-1",
      visibleFrom: "round_start",
      revealRound: 2,
    })).toEqual(expect.objectContaining({
      visibleFrom: "round_start",
      revealRound: 2,
    }));

    expect(writeCharacterMissionMap(
      { title: "기존 설정" },
      { "char-1": [{ id: "m1", type: "secret", description: "비밀", points: 0, visibleFrom: "intro_end" }] },
    )).toEqual({
      title: "기존 설정",
      character_missions: { "char-1": [{ id: "m1", type: "secret", description: "비밀", points: 0, visibleFrom: "intro_end" }] },
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
