import { useRef, useEffect } from "react";
import type { Node } from "@xyflow/react";
import { useUpdateFlowNode } from "../../flowApi";
import type { FlowNodeData } from "../../flowTypes";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EndingNodePanelProps {
  node: Node;
  themeId: string;
  onUpdate: (id: string, data: Partial<FlowNodeData>) => void;
}

// ---------------------------------------------------------------------------
// EndingNodePanel — 엔딩 노드 편집 패널
// ---------------------------------------------------------------------------

export function EndingNodePanel({
  node,
  themeId,
  onUpdate,
}: EndingNodePanelProps) {
  const updateNode = useUpdateFlowNode(themeId);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const data = node.data as FlowNodeData;

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChange = (patch: Partial<FlowNodeData>) => {
    onUpdate(node.id, patch);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateNode.mutate({
        nodeId: node.id,
        body: { data: { ...data, ...patch } },
      });
    }, 500);
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
          placeholder="엔딩 이름"
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:border-amber-500 focus:outline-none"
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-slate-400">설명</label>
        <textarea
          value={data.description ?? ""}
          onChange={(e) => handleChange({ description: e.target.value })}
          placeholder="엔딩 설명"
          rows={3}
          className="resize-none rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:border-amber-500 focus:outline-none"
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
          placeholder="1.0"
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:border-amber-500 focus:outline-none"
        />
      </div>
    </div>
  );
}
