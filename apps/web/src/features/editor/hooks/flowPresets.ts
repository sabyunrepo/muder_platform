import type { Node, Edge } from "@xyflow/react";

// ---------------------------------------------------------------------------
// Preset definition
// ---------------------------------------------------------------------------

export interface FlowPreset {
  id: string;
  label: string;
  description: string;
  nodes: Array<{ type: string; label?: string }>;
}

const NODE_Y = 200;
const NODE_GAP = 250;

export const FLOW_PRESETS: FlowPreset[] = [
  {
    id: "classic",
    label: "클래식 머더미스터리",
    description: "자기소개 → 자유조사 → 중간투표 → 최종변론 → 최종투표",
    nodes: [
      { type: "start" },
      { type: "phase", label: "자기소개" },
      { type: "phase", label: "자유조사" },
      { type: "phase", label: "중간투표" },
      { type: "phase", label: "최종변론" },
      { type: "phase", label: "최종투표" },
      { type: "ending" },
    ],
  },
  {
    id: "time-attack",
    label: "타임어택",
    description: "단서탐색(20분) → 긴급토론(10분) → 투표",
    nodes: [
      { type: "start" },
      { type: "phase", label: "단서탐색" },
      { type: "phase", label: "긴급토론" },
      { type: "phase", label: "투표" },
      { type: "ending" },
    ],
  },
  {
    id: "free-explore",
    label: "자유탐색",
    description: "자유조사 → 투표 (간소화)",
    nodes: [
      { type: "start" },
      { type: "phase", label: "자유조사" },
      { type: "phase", label: "투표" },
      { type: "ending" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Factory — fresh UUIDs per call
// ---------------------------------------------------------------------------

export function createPresetFlow(
  preset: FlowPreset,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = preset.nodes.map((n, i) => ({
    id: crypto.randomUUID(),
    type: n.type,
    position: { x: i * NODE_GAP, y: NODE_Y },
    data: n.label ? { label: n.label } : {},
  }));

  const edges: Edge[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({
      id: crypto.randomUUID(),
      source: nodes[i].id,
      target: nodes[i + 1].id,
    });
  }

  return { nodes, edges };
}
