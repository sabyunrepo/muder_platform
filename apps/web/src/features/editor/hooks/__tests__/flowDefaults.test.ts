import { describe, it, expect } from "vitest";
import { createDefaultTemplate } from "../flowDefaults";

describe("createDefaultTemplate", () => {
  it("returns 5 nodes and 4 edges", () => {
    const { nodes, edges } = createDefaultTemplate();
    expect(nodes).toHaveLength(5);
    expect(edges).toHaveLength(4);
  });

  it("has exactly 1 start node", () => {
    const { nodes } = createDefaultTemplate();
    expect(nodes.filter((n) => n.type === "start")).toHaveLength(1);
  });

  it("has exactly 3 phase nodes", () => {
    const { nodes } = createDefaultTemplate();
    expect(nodes.filter((n) => n.type === "phase")).toHaveLength(3);
  });

  it("has exactly 1 ending node", () => {
    const { nodes } = createDefaultTemplate();
    expect(nodes.filter((n) => n.type === "ending")).toHaveLength(1);
  });

  it("phase nodes have expected labels", () => {
    const { nodes } = createDefaultTemplate();
    const phaseLabels = nodes
      .filter((n) => n.type === "phase")
      .map((n) => (n.data as { label?: string }).label);
    expect(phaseLabels).toEqual(["자기소개", "자유조사", "투표"]);
  });

  it("edges connect nodes sequentially", () => {
    const { nodes, edges } = createDefaultTemplate();
    const nodeIds = nodes.map((n) => n.id);
    for (const edge of edges) {
      expect(nodeIds).toContain(edge.source);
      expect(nodeIds).toContain(edge.target);
    }
    // Each consecutive pair is connected
    for (let i = 0; i < nodes.length - 1; i++) {
      const hasEdge = edges.some(
        (e) => e.source === nodes[i].id && e.target === nodes[i + 1].id,
      );
      expect(hasEdge).toBe(true);
    }
  });

  it("returns fresh copies on each call (no shared mutation)", () => {
    const a = createDefaultTemplate();
    const b = createDefaultTemplate();
    a.nodes[0].data = { label: "mutated" };
    expect((b.nodes[0].data as { label?: string }).label).toBeUndefined();
  });

  it("node positions are set correctly", () => {
    const { nodes } = createDefaultTemplate();
    expect(nodes[0].position).toEqual({ x: 0, y: 200 });
    expect(nodes[4].position).toEqual({ x: 1000, y: 200 });
  });
});
