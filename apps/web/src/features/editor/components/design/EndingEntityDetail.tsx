import { useId } from "react";
import type { Node } from "@xyflow/react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useDebouncedMutation } from "@/hooks/useDebouncedMutation";
import { useUpdateFlowNode } from "../../flowApi";
import { flowKeys, type FlowGraphResponse, type FlowNodeData } from "../../flowTypes";

interface EndingEntityDetailProps {
  node: Node;
  themeId: string;
  onChange: (nodeId: string, patch: Partial<FlowNodeData>) => void;
}

const SAVE_DEBOUNCE_MS = 1000;

export function EndingEntityDetail({ node, themeId, onChange }: EndingEntityDetailProps) {
  const fieldIdPrefix = useId();
  const data = node.data as FlowNodeData;
  const updateNode = useUpdateFlowNode(themeId);
  const queryClient = useQueryClient();

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
        nodes: previous.nodes.map((flowNode) =>
          flowNode.id === node.id
            ? { ...flowNode, data: { ...flowNode.data, ...body } }
            : flowNode,
        ),
      });
      return () => queryClient.setQueryData(cacheKey, previous);
    },
    onError: () => toast.error("결말 저장에 실패했습니다"),
  });

  const handleChange = (patch: Partial<FlowNodeData>) => {
    onChange(node.id, patch);
    debouncer.schedule(
      { ...data, ...patch },
      (prev) => ({ ...data, ...(prev ?? {}), ...patch }),
    );
  };

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 lg:p-5">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
          결말 상세
        </p>
        <h3 className="text-lg font-semibold text-slate-100">
          {data.label || "새 결말"}
        </h3>
        <p className="text-sm leading-6 text-slate-400">
          게임이 끝났을 때 모두에게 공개할 결말 이름과 본문을 작성합니다.
          점수 배율은 사용하지 않고 모든 결말은 같은 기준으로 계산됩니다.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[96px_1fr]">
        <label className="text-sm font-medium text-slate-300" htmlFor={`${fieldIdPrefix}-icon`}>
          아이콘
        </label>
        <input
          id={`${fieldIdPrefix}-icon`}
          type="text"
          value={data.icon ?? ""}
          onChange={(event) => handleChange({ icon: event.target.value })}
          onBlur={debouncer.flush}
          placeholder="예: 🎭"
          className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-[96px_1fr]">
        <label className="text-sm font-medium text-slate-300" htmlFor={`${fieldIdPrefix}-label`}>
          결말 이름
        </label>
        <input
          id={`${fieldIdPrefix}-label`}
          type="text"
          value={data.label ?? ""}
          onChange={(event) => handleChange({ label: event.target.value })}
          onBlur={debouncer.flush}
          placeholder="예: 진실, 자비, 오판"
          className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-[96px_1fr]">
        <label className="text-sm font-medium text-slate-300" htmlFor={`${fieldIdPrefix}-color`}>
          표시 색상
        </label>
        <input
          id={`${fieldIdPrefix}-color`}
          type="text"
          value={data.color ?? ""}
          onChange={(event) => handleChange({ color: event.target.value })}
          onBlur={debouncer.flush}
          placeholder="예: amber, emerald, rose"
          className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-[96px_1fr]">
        <label className="text-sm font-medium text-slate-300" htmlFor={`${fieldIdPrefix}-description`}>
          공개 설명
        </label>
        <textarea
          id={`${fieldIdPrefix}-description`}
          value={data.description ?? ""}
          onChange={(event) => handleChange({ description: event.target.value })}
          onBlur={debouncer.flush}
          placeholder="결말 목록에서 제작자가 구분하기 쉬운 짧은 설명"
          rows={3}
          className="resize-y rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm leading-6 text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300" htmlFor={`${fieldIdPrefix}-content`}>
          결말 본문
        </label>
        <textarea
          id={`${fieldIdPrefix}-content`}
          value={data.endingContent ?? ""}
          onChange={(event) => handleChange({ endingContent: event.target.value })}
          onBlur={debouncer.flush}
          placeholder="사건의 전말을 Markdown으로 작성하세요. 플레이어에게 공개되는 내용입니다."
          rows={8}
          className="min-h-44 w-full resize-y rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm leading-6 text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
        />
        <p className="text-xs leading-5 text-slate-500">
          Markdown 문법을 사용할 수 있습니다. 플레이어에게 보일 문장만 작성하고 내부 코드나 저장 키는 쓰지 않아도 됩니다.
        </p>
      </div>
    </section>
  );
}
