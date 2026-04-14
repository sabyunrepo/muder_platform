import { describe, it, expect } from "vitest";
import { createDefaultTemplate } from "../flowDefaults";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("createDefaultTemplate", () => {
  it("returns 5 nodes and 4 edges", () => {
    const { nodes, edges } = createDefaultTemplate();
    expect(nodes).toHaveLength(5);
    expect(edges).toHaveLength(4);
  });

  it("generates valid UUID IDs for all nodes and edges", () => {
    const { nodes, edges } = createDefaultTemplate();
    for (const n of nodes) expect(n.id).toMatch(UUID_RE);
    for (const e of edges) expect(e.id).toMatch(UUID_RE);
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
    for (let i = 0; i < nodes.length - 1; i++) {
      expect(edges[i].source).toBe(nodes[i].id);
      expect(edges[i].target).toBe(nodes[i + 1].id);
    }
  });

  it("returns unique IDs on each call", () => {
    const a = createDefaultTemplate();
    const b = createDefaultTemplate();
    const aIds = a.nodes.map((n) => n.id);
    const bIds = b.nodes.map((n) => n.id);
    // No overlap between two calls
    expect(aIds.some((id) => bIds.includes(id))).toBe(false);
  });

  it("node positions are set correctly", () => {
    const { nodes } = createDefaultTemplate();
    expect(nodes[0].position).toEqual({ x: 0, y: 200 });
    expect(nodes[4].position).toEqual({ x: 1000, y: 200 });
  });
});
