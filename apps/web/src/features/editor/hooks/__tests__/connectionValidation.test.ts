import { describe, it, expect } from "vitest";
import type { Node, Edge, Connection } from "@xyflow/react";
import { wouldCreateCycle, isValidConnection } from "../connectionValidation";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(id: string, type: string): Node {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: {},
  };
}

function makeEdge(source: string, target: string): Edge {
  return { id: `${source}-${target}`, source, target };
}

function makeConn(source: string, target: string): Connection {
  return { source, target, sourceHandle: null, targetHandle: null };
}

// ---------------------------------------------------------------------------
// wouldCreateCycle
// ---------------------------------------------------------------------------

describe("wouldCreateCycle", () => {
  it("자기 자신으로의 연결은 사이클이다", () => {
    const nodes = [makeNode("a", "phase")];
    expect(wouldCreateCycle(nodes, [], makeConn("a", "a"))).toBe(true);
  });

  it("직접 사이클을 감지한다: a→b, b→a 추가 시", () => {
    const nodes = [makeNode("a", "phase"), makeNode("b", "phase")];
    const edges = [makeEdge("a", "b")];
    expect(wouldCreateCycle(nodes, edges, makeConn("b", "a"))).toBe(true);
  });

  it("간접 사이클을 감지한다: a→b→c, c→a 추가 시", () => {
    const nodes = [
      makeNode("a", "phase"),
      makeNode("b", "phase"),
      makeNode("c", "phase"),
    ];
    const edges = [makeEdge("a", "b"), makeEdge("b", "c")];
    expect(wouldCreateCycle(nodes, edges, makeConn("c", "a"))).toBe(true);
  });

  it("사이클이 없는 유효한 연결은 false를 반환한다", () => {
    const nodes = [makeNode("a", "phase"), makeNode("b", "phase")];
    expect(wouldCreateCycle(nodes, [], makeConn("a", "b"))).toBe(false);
  });

  it("source나 target이 null이면 false를 반환한다", () => {
    const nodes = [makeNode("a", "phase")];
    const conn: Connection = { source: null, target: "a", sourceHandle: null, targetHandle: null };
    expect(wouldCreateCycle(nodes, [], conn)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isValidConnection
// ---------------------------------------------------------------------------

describe("isValidConnection", () => {
  it("Start → Phase는 허용된다", () => {
    const nodes = [makeNode("s", "start"), makeNode("p", "phase")];
    expect(isValidConnection(nodes, [], makeConn("s", "p"))).toBe(true);
  });

  it("Start → Branch는 허용된다", () => {
    const nodes = [makeNode("s", "start"), makeNode("b", "branch")];
    expect(isValidConnection(nodes, [], makeConn("s", "b"))).toBe(true);
  });

  it("Start → Ending은 허용되지 않는다", () => {
    const nodes = [makeNode("s", "start"), makeNode("e", "ending")];
    expect(isValidConnection(nodes, [], makeConn("s", "e"))).toBe(false);
  });

  it("Ending → Phase는 허용되지 않는다 (Ending은 출력 없음)", () => {
    const nodes = [makeNode("e", "ending"), makeNode("p", "phase")];
    expect(isValidConnection(nodes, [], makeConn("e", "p"))).toBe(false);
  });

  it("Branch → Phase는 허용된다", () => {
    const nodes = [makeNode("b", "branch"), makeNode("p", "phase")];
    expect(isValidConnection(nodes, [], makeConn("b", "p"))).toBe(true);
  });

  it("Branch → Ending은 허용된다", () => {
    const nodes = [makeNode("b", "branch"), makeNode("e", "ending")];
    expect(isValidConnection(nodes, [], makeConn("b", "e"))).toBe(true);
  });

  it("Phase → Phase는 허용된다", () => {
    const nodes = [makeNode("p1", "phase"), makeNode("p2", "phase")];
    expect(isValidConnection(nodes, [], makeConn("p1", "p2"))).toBe(true);
  });

  it("자기 연결은 허용되지 않는다", () => {
    const nodes = [makeNode("p", "phase")];
    expect(isValidConnection(nodes, [], makeConn("p", "p"))).toBe(false);
  });

  it("사이클을 형성하는 연결은 허용되지 않는다", () => {
    const nodes = [makeNode("a", "phase"), makeNode("b", "phase")];
    const edges = [makeEdge("a", "b")];
    expect(isValidConnection(nodes, edges, makeConn("b", "a"))).toBe(false);
  });

  it("노드가 존재하지 않으면 허용되지 않는다", () => {
    expect(isValidConnection([], [], makeConn("x", "y"))).toBe(false);
  });
});
