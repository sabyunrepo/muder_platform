import { describe, it, expect } from "vitest";
import { FLOW_PRESETS, createPresetFlow } from "../flowPresets";

describe("FLOW_PRESETS", () => {
  it("3가지 프리셋이 정의되어 있다", () => {
    expect(FLOW_PRESETS).toHaveLength(3);
  });

  it("각 프리셋은 id, label, description, nodes를 가진다", () => {
    for (const preset of FLOW_PRESETS) {
      expect(preset.id).toBeTruthy();
      expect(preset.label).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(preset.nodes.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("createPresetFlow", () => {
  it("클래식 프리셋: 7 노드 + 6 엣지", () => {
    const classic = FLOW_PRESETS.find((p) => p.id === "classic")!;
    const flow = createPresetFlow(classic);
    expect(flow.nodes).toHaveLength(7);
    expect(flow.edges).toHaveLength(6);
  });

  it("타임어택 프리셋: 5 노드 + 4 엣지", () => {
    const ta = FLOW_PRESETS.find((p) => p.id === "time-attack")!;
    const flow = createPresetFlow(ta);
    expect(flow.nodes).toHaveLength(5);
    expect(flow.edges).toHaveLength(4);
  });

  it("자유탐색 프리셋: 4 노드 + 3 엣지", () => {
    const free = FLOW_PRESETS.find((p) => p.id === "free-explore")!;
    const flow = createPresetFlow(free);
    expect(flow.nodes).toHaveLength(4);
    expect(flow.edges).toHaveLength(3);
  });

  it("매 호출마다 고유 UUID를 생성한다", () => {
    const preset = FLOW_PRESETS[0];
    const a = createPresetFlow(preset);
    const b = createPresetFlow(preset);
    expect(a.nodes[0].id).not.toBe(b.nodes[0].id);
  });

  it("엣지가 노드를 순차 연결한다", () => {
    const preset = FLOW_PRESETS[0];
    const flow = createPresetFlow(preset);
    for (let i = 0; i < flow.edges.length; i++) {
      expect(flow.edges[i].source).toBe(flow.nodes[i].id);
      expect(flow.edges[i].target).toBe(flow.nodes[i + 1].id);
    }
  });
});
