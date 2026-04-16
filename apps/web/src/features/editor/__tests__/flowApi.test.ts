import { describe, it, expect, vi, beforeEach } from "vitest";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    deleteVoid: vi.fn(),
    putVoid: vi.fn(),
    patchVoid: vi.fn(),
  },
}));
vi.mock("@/services/api", () => ({
  api: apiMock,
}));
vi.mock("@/services/queryClient", () => ({
  queryClient: { invalidateQueries: vi.fn() },
}));
vi.mock("@tanstack/react-query", () => ({
  useMutation: ({ mutationFn }: { mutationFn: (v: unknown) => unknown }) => ({
    mutate: (v: unknown) => mutationFn(v),
    mutateAsync: (v: unknown) => mutationFn(v),
  }),
  useQuery: () => ({ data: undefined }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

import { useUpdateFlowNode, useUpdateFlowEdge } from "../flowApi";

describe("flowApi verb contract (W2 review CRIT-1 regression)", () => {
  beforeEach(() => {
    for (const fn of Object.values(apiMock)) fn.mockReset();
    apiMock.patch.mockResolvedValue({});
    apiMock.put.mockResolvedValue({});
  });

  it("useUpdateFlowNode uses PATCH (not PUT) — backend is Patch-only", async () => {
    const m = useUpdateFlowNode("theme-1");
    await m.mutateAsync({ nodeId: "n-1", body: { label: "x" } });
    expect(apiMock.patch).toHaveBeenCalledWith(
      "/v1/editor/themes/theme-1/flow/nodes/n-1",
      { label: "x" },
    );
    expect(apiMock.put).not.toHaveBeenCalled();
  });

  it("useUpdateFlowEdge uses PATCH (not PUT)", async () => {
    const m = useUpdateFlowEdge("theme-1");
    await m.mutateAsync({ edgeId: "e-1", body: { label: "y" } });
    expect(apiMock.patch).toHaveBeenCalledWith(
      "/v1/editor/themes/theme-1/flow/edges/e-1",
      { label: "y" },
    );
    expect(apiMock.put).not.toHaveBeenCalled();
  });
});
