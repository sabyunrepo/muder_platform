import type { Node, Edge } from "@xyflow/react";

// ---------------------------------------------------------------------------
// Default flow template for new (blank) themes
// ---------------------------------------------------------------------------

const NODE_Y = 200;

const DEFAULT_NODES: Node[] = [
  {
    id: "default-start",
    type: "start",
    position: { x: 0, y: NODE_Y },
    data: {},
  },
  {
    id: "default-phase-1",
    type: "phase",
    position: { x: 250, y: NODE_Y },
    data: { label: "자기소개" },
  },
  {
    id: "default-phase-2",
    type: "phase",
    position: { x: 500, y: NODE_Y },
    data: { label: "자유조사" },
  },
  {
    id: "default-phase-3",
    type: "phase",
    position: { x: 750, y: NODE_Y },
    data: { label: "투표" },
  },
  {
    id: "default-ending",
    type: "ending",
    position: { x: 1000, y: NODE_Y },
    data: {},
  },
];

const DEFAULT_EDGES: Edge[] = [
  {
    id: "default-edge-1",
    source: "default-start",
    target: "default-phase-1",
  },
  {
    id: "default-edge-2",
    source: "default-phase-1",
    target: "default-phase-2",
  },
  {
    id: "default-edge-3",
    source: "default-phase-2",
    target: "default-phase-3",
  },
  {
    id: "default-edge-4",
    source: "default-phase-3",
    target: "default-ending",
  },
];

// ---------------------------------------------------------------------------
// Factory — returns fresh copies (no shared mutation risk)
// ---------------------------------------------------------------------------

export function createDefaultTemplate(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: DEFAULT_NODES.map((n) => ({ ...n, data: { ...n.data } })),
    edges: DEFAULT_EDGES.map((e) => ({ ...e })),
  };
}
