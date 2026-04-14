import { describe, it, expect } from "vitest";
import type { Edge } from "@xyflow/react";

// ---------------------------------------------------------------------------
// Optimistic revert logic simulation
// Tests the CYCLE_DETECTED revert pattern from useClueGraphData.onConnect
// ---------------------------------------------------------------------------

function simulateRevert(
  edges: Edge[],
  newEdgeId: string,
  err: Error,
): Edge[] {
  const isCycle = err.message?.includes("CYCLE_DETECTED");
  if (isCycle) {
    return edges.filter((e) => e.id !== newEdgeId);
  }
  return edges;
}

describe("optimistic revert on mutation error", () => {
  it("removes the optimistic edge on CYCLE_DETECTED", () => {
    const newEdgeId = "clue-0-clue-1-1234";
    const edges: Edge[] = [
      { id: "existing", source: "clue-2", target: "clue-3" },
      { id: newEdgeId, source: "clue-0", target: "clue-1" },
    ];

    const result = simulateRevert(
      edges,
      newEdgeId,
      new Error("CYCLE_DETECTED: graph contains a cycle"),
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("existing");
  });

  it("does not revert edge on generic error", () => {
    const newEdgeId = "clue-0-clue-1-1234";
    const edges: Edge[] = [
      { id: newEdgeId, source: "clue-0", target: "clue-1" },
    ];

    const result = simulateRevert(edges, newEdgeId, new Error("network error"));

    expect(result).toHaveLength(1);
  });

  it("does not remove unrelated edges on CYCLE_DETECTED", () => {
    const newEdgeId = "new-edge";
    const edges: Edge[] = [
      { id: "keep-1", source: "a", target: "b" },
      { id: "keep-2", source: "c", target: "d" },
      { id: newEdgeId, source: "e", target: "f" },
    ];

    const result = simulateRevert(
      edges,
      newEdgeId,
      new Error("CYCLE_DETECTED"),
    );

    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual(["keep-1", "keep-2"]);
  });

  it("handles empty edge list on CYCLE_DETECTED without throwing", () => {
    const result = simulateRevert(
      [],
      "missing-edge",
      new Error("CYCLE_DETECTED"),
    );
    expect(result).toHaveLength(0);
  });
});
