import { useId } from "react";
import type { Node } from "@xyflow/react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useDebouncedMutation } from "@/hooks/useDebouncedMutation";
import { useUpdateFlowNode } from "../../flowApi";
import {
  flowKeys,
  type EndingVisibility,
  type FlowGraphResponse,
  type FlowNodeData,
} from "../../flowTypes";
import {
  endingVisibilityLabel,
  normalizeEndingVisibility,
  type EndingCharacterEndcardSummary,
} from "../../entities/ending/endingEntityAdapter";

interface EndingEntityDetailProps {
  node: Node;
  themeId: string;
  endcardSummary: EndingCharacterEndcardSummary;
  onChange: (nodeId: string, patch: Partial<FlowNodeData>) => void;
}

const SAVE_DEBOUNCE_MS = 1000;

export function EndingEntityDetail({
  node,
  themeId,
  endcardSummary,
  onChange,
}: EndingEntityDetailProps) {
  const fieldIdPrefix = useId();
  const data = node.data as FlowNodeData;
  const visibility = normalizeEndingVisibility(data.endingVisibility);
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
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-slate-300">
            공개 범위: {endingVisibilityLabel(visibility)}
          </span>
          <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-slate-300">
            캐릭터 결과 카드 {endcardSummary.readyCount}/{endcardSummary.totalCount}명 작성
          </span>
        </div>
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

      <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
        <label className="text-sm font-medium text-slate-300" htmlFor={`${fieldIdPrefix}-visibility`}>
          공개 범위
        </label>
        <select
          id={`${fieldIdPrefix}-visibility`}
          value={visibility}
          onChange={(event) => handleChange({ endingVisibility: event.target.value as EndingVisibility })}
          onBlur={debouncer.flush}
          className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
        >
          <option value="public">전체 공개</option>
          <option value="players_only">참가자에게만 공개</option>
          <option value="private_note">제작자 메모</option>
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
        <label className="text-sm font-medium text-slate-300" htmlFor={`${fieldIdPrefix}-spoiler`}>
          스포일러 안내
        </label>
        <textarea
          id={`${fieldIdPrefix}-spoiler`}
          value={data.endingSpoilerWarning ?? ""}
          onChange={(event) => handleChange({ endingSpoilerWarning: event.target.value })}
          onBlur={debouncer.flush}
          placeholder="예: 스포일러 주의: 게임 종료 후 공개되는 결말입니다."
          rows={2}
          className="resize-y rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm leading-6 text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
        <label className="text-sm font-medium text-slate-300" htmlFor={`${fieldIdPrefix}-share`}>
          감상 공유 문구
        </label>
        <textarea
          id={`${fieldIdPrefix}-share`}
          value={data.endingShareText ?? ""}
          onChange={(event) => handleChange({ endingShareText: event.target.value })}
          onBlur={debouncer.flush}
          placeholder="예: 오늘의 추리는 진실에 가까웠나요?"
          rows={3}
          className="resize-y rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm leading-6 text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
        />
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-100">캐릭터별 결과 카드 작성 현황</h4>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              상세 문구는 등장인물 관리의 결과 카드에서 작성합니다. 이곳에서는 누락된 캐릭터를 확인합니다.
            </p>
          </div>
          <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-amber-100">
            {endcardSummary.readyCount}/{endcardSummary.totalCount}
          </span>
        </div>
        {endcardSummary.totalCount === 0 ? (
          <p className="mt-3 rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-400">
            등록된 등장인물이 없습니다.
          </p>
        ) : endcardSummary.missingNames.length === 0 ? (
          <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-100">
            모든 캐릭터의 결과 카드가 작성되었습니다.
          </p>
        ) : (
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
            결과 카드가 비어 있는 캐릭터: {endcardSummary.missingNames.join(", ")}
          </p>
        )}
      </section>
    </section>
  );
}
