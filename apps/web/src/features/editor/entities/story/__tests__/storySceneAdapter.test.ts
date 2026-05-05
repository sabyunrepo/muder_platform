import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { DELIVER_INFORMATION_ACTION } from "../../shared/actionAdapter";
import {
  toStorySceneFlowSummary,
  toStorySceneFlowSummaryFromGraph,
} from "../storySceneAdapter";

const completeCondition = {
  id: "group-1",
  operator: "AND",
  rules: [
    {
      id: "rule-1",
      variable: "custom_flag",
      target_flag_key: "route_open",
      comparator: "=",
      value: "true",
    },
  ],
};

describe("storySceneAdapter", () => {
  it("Flow phase node를 제작자용 스토리 장면 요약으로 변환한다", () => {
    const nodes: Node[] = [
      { id: "start", type: "start", position: { x: 0, y: 0 }, data: {} },
      {
        id: "scene-2",
        type: "phase",
        position: { x: 200, y: 100 },
        data: { label: "토론", phase_type: "discussion", onExit: [{ type: "disable_chat" }] },
      },
      {
        id: "scene-1",
        type: "phase",
        position: { x: 100, y: 50 },
        data: {
          label: "오프닝",
          phase_type: "story_progression",
          onEnter: [
            { type: "play_bgm" },
            {
              type: DELIVER_INFORMATION_ACTION,
              params: {
                deliveries: [
                  {
                    target: { type: "all_players" },
                    reading_section_ids: ["reading-1"],
                  },
                ],
              },
            },
          ],
        },
      },
    ];
    const edges: Edge[] = [
      { id: "edge-1", source: "scene-1", target: "scene-2" },
      {
        id: "edge-2",
        source: "scene-2",
        target: "ending-1",
        data: { condition: completeCondition },
      },
      {
        id: "edge-legacy",
        source: "scene-2",
        target: "ending-2",
        data: { condition: { op: "and", clauses: [{ fact: "has_clue" }] } },
      },
    ];

    expect(toStorySceneFlowSummary(nodes, edges)).toEqual({
      sceneCountLabel: "2개 장면",
      transitionCountLabel: "3개 이동",
      conditionalTransitionCountLabel: "조건 이동 1개",
      scenes: [
        {
          id: "scene-1",
          title: "오프닝",
          typeLabel: "스토리 진행",
          informationLabel: "1개 정보 공개",
          transitionLabel: "기본 이동 1개 · 조건 이동 0개",
          startActionLabel: "변화 1개",
          endActionLabel: "변화 없음",
        },
        {
          id: "scene-2",
          title: "토론",
          typeLabel: "토론",
          informationLabel: "0개 정보 공개",
          transitionLabel: "기본 이동 1개 · 조건 이동 1개",
          startActionLabel: "변화 없음",
          endActionLabel: "변화 1개",
        },
      ],
    });
  });

  it("API graph 응답의 source_id/target_id 조건 이동을 장면 요약으로 변환한다", () => {
    const summary = toStorySceneFlowSummaryFromGraph({
      nodes: [
        {
          id: "scene-1",
          theme_id: "theme-1",
          type: "phase",
          data: { label: "수사", phase_type: "investigation" },
          position_x: 0,
          position_y: 0,
          created_at: "2026-05-05T00:00:00Z",
          updated_at: "2026-05-05T00:00:00Z",
        },
      ],
      edges: [
        {
          id: "edge-1",
          theme_id: "theme-1",
          source_id: "scene-1",
          target_id: "ending-1",
          condition: completeCondition,
          label: null,
          sort_order: 1,
          created_at: "2026-05-05T00:00:00Z",
        },
      ],
    });

    expect(summary).toMatchObject({
      sceneCountLabel: "1개 장면",
      transitionCountLabel: "1개 이동",
      conditionalTransitionCountLabel: "조건 이동 1개",
      scenes: [
        {
          title: "수사",
          transitionLabel: "기본 이동 없음 · 조건 이동 1개",
        },
      ],
    });
  });
});
