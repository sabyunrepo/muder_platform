import { useId, useState } from "react";
import type { Node } from "@xyflow/react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useDebouncedMutation } from "@/hooks/useDebouncedMutation";
import { RichContentEditor } from "@/features/editor/components/content/RichContentEditor";
import type { MediaType } from "@/features/editor/mediaApi";
import { useUpdateFlowNode } from "../../flowApi";
import {
  flowKeys,
  type FlowGraphResponse,
  type FlowNodeData,
} from "../../flowTypes";

interface EndingEntityDetailProps {
  node: Node;
  themeId: string;
  onChange: (nodeId: string, patch: Partial<FlowNodeData>) => void;
}

const SAVE_DEBOUNCE_MS = 1000;

export function EndingEntityDetail({
  node,
  themeId,
  onChange,
}: EndingEntityDetailProps) {
  const fieldIdPrefix = useId();
  const [pickerType, setPickerType] = useState<MediaType | null>(null);
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
          투표·질문·조건 결과는 서버가 판정하므로, 여기에는 플레이어에게 보여줄 내용만 적으면 됩니다.
        </p>
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

      <div className="min-w-0 space-y-2">
        <p className="text-sm font-medium text-slate-300" id={`${fieldIdPrefix}-content-label`}>
          결말 본문
        </p>
        <RichContentEditor
          themeId={themeId}
          markdown={data.endingContent ?? ""}
          onChange={(markdown) => handleChange({ endingContent: markdown })}
          pickerType={pickerType}
          onOpenPicker={setPickerType}
          onClosePicker={() => setPickerType(null)}
          ariaLabel="결말 본문 작성기"
          imageButtonLabel="결말 이미지 삽입"
          videoButtonLabel="결말 영상 삽입"
          imagePickerTitle="결말 이미지 선택"
          videoPickerTitle="결말 영상 선택"
          onBlurCapture={() => debouncer.flush()}
        />
        <p className="text-xs leading-5 text-slate-500">
          Markdown과 미디어 블록을 사용할 수 있습니다. 플레이어에게 보일 문장만 작성하면 됩니다.
        </p>
      </div>
    </section>
  );
}
