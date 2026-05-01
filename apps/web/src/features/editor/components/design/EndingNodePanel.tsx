import type { Node } from "@xyflow/react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useUpdateFlowNode } from "../../flowApi";
import { flowKeys, type FlowGraphResponse, type FlowNodeData } from "../../flowTypes";
import { useDebouncedMutation } from "@/hooks/useDebouncedMutation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EndingNodePanelProps {
  node: Node;
  themeId: string;
  onUpdate: (id: string, data: Partial<FlowNodeData>) => void;
}

/** Debounce window for ending-node saves. Preserves prior 500ms behavior. */
const SAVE_DEBOUNCE_MS = 500;

// ---------------------------------------------------------------------------
// EndingNodePanel — 엔딩 노드 편집 패널
// ---------------------------------------------------------------------------

export function EndingNodePanel({
  node,
  themeId,
  onUpdate,
}: EndingNodePanelProps) {
  const updateNode = useUpdateFlowNode(themeId);
  const queryClient = useQueryClient();
  const data = node.data as FlowNodeData;

  const debouncer = useDebouncedMutation<FlowNodeData>({
    debounceMs: SAVE_DEBOUNCE_MS,
    mutate: (body, opts) =>
      updateNode.mutate({ nodeId: node.id, body: { data: body } }, opts),
    applyOptimistic: (body) => {
      const cacheKey = flowKeys.graph(themeId);
      const previous = queryClient.getQueryData<FlowGraphResponse>(cacheKey);
      if (!previous) return null;
      queryClient.setQueryData<FlowGraphResponse>(cacheKey, {
        ...previous,
        nodes: previous.nodes.map((n) =>
          n.id === node.id ? { ...n, data: { ...n.data, ...body } } : n,
        ),
      });
      return () => queryClient.setQueryData(cacheKey, previous);
    },
    onError: () => toast.error("저장에 실패했습니다"),
  });
  const flush = debouncer.flush;

  const handleChange = (patch: Partial<FlowNodeData>) => {
    onUpdate(node.id, patch);
    debouncer.schedule(
      { ...data, ...patch },
      (prev) => ({ ...data, ...(prev ?? {}), ...patch }),
    );
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        엔딩 설정
      </h3>

      {/* Label */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-slate-400">라벨</label>
        <input
          type="text"
          value={data.label ?? ""}
          onChange={(e) => handleChange({ label: e.target.value })}
          onBlur={flush}
          placeholder="엔딩 이름"
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-slate-400">설명</label>
        <textarea
          value={data.description ?? ""}
          onChange={(e) => handleChange({ description: e.target.value })}
          onBlur={flush}
          placeholder="엔딩 설명"
          rows={3}
          className="resize-none rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
        />
      </div>

      {/* Score multiplier */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-slate-400">점수 배율</label>
        <input
          type="number"
          min={0}
          step={0.1}
          value={data.score_multiplier ?? ""}
          onChange={(e) =>
            handleChange({
              score_multiplier: e.target.value
                ? Number(e.target.value)
                : undefined,
            })
          }
          onBlur={flush}
          placeholder="1.0"
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
        />
      </div>
    </div>
  );
}
