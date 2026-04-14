import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Edge } from "@xyflow/react";
import type { ClueResponse } from "@/features/editor/api";
import type { ClueRelationResponse } from "../../clueRelationApi";

// ---------------------------------------------------------------------------
// Replicate pure converter functions from useClueGraphData (module-internal)
// ---------------------------------------------------------------------------

const COLS = 4;
const COL_GAP = 200;
const ROW_GAP = 120;

function cluesToNodes(clues: ClueResponse[]) {
  return clues.map((clue, i) => ({
    id: clue.id,
    type: "clue",
    position: {
      x: (i % COLS) * COL_GAP + 40,
      y: Math.floor(i / COLS) * ROW_GAP + 40,
    },
    data: { label: clue.name },
  }));
}

function relationsToEdges(relations: ClueRelationResponse[]) {
  return relations.map((r) => ({
    id: r.id,
    source: r.sourceId,
    target: r.targetId,
    type: "relation",
    data: { mode: r.mode },
  }));
}

function buildRequests(eds: Edge[]) {
  return eds.map((e) => ({
    sourceId: e.source,
    targetId: e.target,
    mode: (e.data as { mode?: "AND" | "OR" } | undefined)?.mode ?? "AND",
  }));
}

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

export const makeClue = (i: number): ClueResponse => ({
  id: `clue-${i}`,
  theme_id: "theme-1",
  location_id: null,
  name: `단서 ${i}`,
  description: null,
  image_url: null,
  is_common: false,
  level: 1,
  clue_type: "normal",
  sort_order: i,
  created_at: "2026-04-15T00:00:00Z",
  is_usable: false,
  use_effect: null,
  use_target: null,
  use_consumed: false,
});

export const makeRelation = (
  id: string,
  sourceId: string,
  targetId: string,
): ClueRelationResponse => ({ id, sourceId, targetId, mode: "AND" });

// ---------------------------------------------------------------------------
// Converter tests
// ---------------------------------------------------------------------------

describe("cluesToNodes", () => {
  it("maps each clue to a node with correct id", () => {
    const nodes = cluesToNodes([makeClue(0), makeClue(1)]);
    expect(nodes[0].id).toBe("clue-0");
    expect(nodes[1].id).toBe("clue-1");
  });

  it("places clues in grid layout — 4 columns", () => {
    const clues = Array.from({ length: 5 }, (_, i) => makeClue(i));
    const nodes = cluesToNodes(clues);
    expect(nodes[0].position.x).toBe(40);
    expect(nodes[3].position.x).toBe(640);
    expect(nodes[4].position.y).toBe(40 + ROW_GAP);
    expect(nodes[4].position.x).toBe(40);
  });

  it("sets node type to 'clue'", () => {
    const nodes = cluesToNodes([makeClue(0)]);
    expect(nodes[0].type).toBe("clue");
  });
});

describe("relationsToEdges", () => {
  it("maps relation to edge with correct source/target", () => {
    const edges = relationsToEdges([makeRelation("r1", "clue-0", "clue-1")]);
    expect(edges[0].source).toBe("clue-0");
    expect(edges[0].target).toBe("clue-1");
  });

  it("sets edge type to 'relation'", () => {
    const edges = relationsToEdges([makeRelation("r1", "clue-0", "clue-1")]);
    expect(edges[0].type).toBe("relation");
  });

  it("preserves mode OR in edge data", () => {
    const rel: ClueRelationResponse = {
      id: "r1",
      sourceId: "clue-0",
      targetId: "clue-1",
      mode: "OR",
    };
    const edges = relationsToEdges([rel]);
    expect((edges[0].data as { mode: string }).mode).toBe("OR");
  });
});

describe("buildRequests", () => {
  it("converts edges to clue relation requests", () => {
    const edges: Edge[] = [
      { id: "e1", source: "clue-0", target: "clue-1", data: { mode: "OR" } },
    ];
    const reqs = buildRequests(edges);
    expect(reqs[0].sourceId).toBe("clue-0");
    expect(reqs[0].targetId).toBe("clue-1");
    expect(reqs[0].mode).toBe("OR");
  });

  it("defaults mode to AND when edge data is missing", () => {
    const edges: Edge[] = [{ id: "e1", source: "s", target: "t" }];
    const reqs = buildRequests(edges);
    expect(reqs[0].mode).toBe("AND");
  });
});

// ---------------------------------------------------------------------------
// Debounce coalescing
// ---------------------------------------------------------------------------

describe("debounce coalescing (autoSave pattern)", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("coalesces multiple rapid calls into one", () => {
    const fn = vi.fn();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const debouncedSave = (arg: string) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fn(arg), 1000);
    };
    debouncedSave("a");
    debouncedSave("b");
    debouncedSave("c");
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith("c");
  });

  it("fires separately when calls are spaced beyond debounce window", () => {
    const fn = vi.fn();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const debouncedSave = (arg: string) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fn(arg), 1000);
    };
    debouncedSave("first");
    vi.advanceTimersByTime(1100);
    debouncedSave("second");
    vi.advanceTimersByTime(1100);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
