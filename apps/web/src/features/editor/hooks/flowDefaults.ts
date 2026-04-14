import type { Node, Edge } from "@xyflow/react";

// ---------------------------------------------------------------------------
// Default flow template for new (blank) themes
// ---------------------------------------------------------------------------

const NODE_Y = 200;

interface TemplateNode {
  type: string;
  x: number;
  label?: string;
}

const TEMPLATE_NODES: TemplateNode[] = [
  { type: "start", x: 0 },
  { type: "phase", x: 250, label: "자기소개" },
  { type: "phase", x: 500, label: "자유조사" },
  { type: "phase", x: 750, label: "투표" },
  { type: "ending", x: 1000 },
];

// ---------------------------------------------------------------------------
// Factory — generates fresh UUIDs on every call (backend requires UUID IDs)
// ---------------------------------------------------------------------------

export function createDefaultTemplate(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = TEMPLATE_NODES.map((t) => ({
    id: crypto.randomUUID(),
    type: t.type,
    position: { x: t.x, y: NODE_Y },
    data: t.label ? { label: t.label } : {},
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
