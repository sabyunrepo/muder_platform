import { useId } from "react";
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
  const labelInputId = useId();
  const descriptionInputId = useId();
  const iconInputId = useId();
  const colorInputId = useId();
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
        <label htmlFor={labelInputId} className="text-[11px] text-slate-400">라벨</label>
        <input
          id={labelInputId}
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
        <label htmlFor={descriptionInputId} className="text-[11px] text-slate-400">설명</label>
        <textarea
          id={descriptionInputId}
          value={data.description ?? ""}
          onChange={(e) => handleChange({ description: e.target.value })}
          onBlur={flush}
          placeholder="엔딩 설명"
          rows={3}
          className="resize-none rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
        />
      </div>

      {/* Icon */}
      <div className="flex flex-col gap-1">
        <label htmlFor={iconInputId} className="text-[11px] text-slate-400">아이콘</label>
        <input
          id={iconInputId}
          type="text"
          value={data.icon ?? ""}
          onChange={(e) => handleChange({ icon: e.target.value })}
          onBlur={flush}
          placeholder="예: 🎭"
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
        />
      </div>

      {/* Color */}
      <div className="flex flex-col gap-1">
        <label htmlFor={colorInputId} className="text-[11px] text-slate-400">표시 색상</label>
        <input
          id={colorInputId}
          type="text"
          value={data.color ?? ""}
          onChange={(e) => handleChange({ color: e.target.value })}
          onBlur={flush}
          placeholder="예: amber, emerald, rose"
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
        />
      </div>
    </div>
  );
}
