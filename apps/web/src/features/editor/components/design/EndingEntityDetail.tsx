import type { Node } from "@xyflow/react";
import type { FlowNodeData } from "../../flowTypes";

interface EndingEntityDetailProps {
  node: Node;
  onChange: (nodeId: string, patch: Partial<FlowNodeData>) => void;
}

export function EndingEntityDetail({ node, onChange }: EndingEntityDetailProps) {
  const data = node.data as FlowNodeData;

  const handleChange = (patch: Partial<FlowNodeData>) => {
    onChange(node.id, patch);
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
        <label className="text-sm font-medium text-slate-300" htmlFor={`ending-icon-${node.id}`}>
          아이콘
        </label>
        <input
          id={`ending-icon-${node.id}`}
          type="text"
          value={data.icon ?? ""}
          onChange={(event) => handleChange({ icon: event.target.value })}
          placeholder="예: 🎭"
          className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-[96px_1fr]">
        <label className="text-sm font-medium text-slate-300" htmlFor={`ending-label-${node.id}`}>
          결말 이름
        </label>
        <input
          id={`ending-label-${node.id}`}
          type="text"
          value={data.label ?? ""}
          onChange={(event) => handleChange({ label: event.target.value })}
          placeholder="예: 진실, 자비, 오판"
          className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-[96px_1fr]">
        <label className="text-sm font-medium text-slate-300" htmlFor={`ending-color-${node.id}`}>
          표시 색상
        </label>
        <input
          id={`ending-color-${node.id}`}
          type="text"
          value={data.color ?? ""}
          onChange={(event) => handleChange({ color: event.target.value })}
          placeholder="예: amber, emerald, rose"
          className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-[96px_1fr]">
        <label className="text-sm font-medium text-slate-300" htmlFor={`ending-description-${node.id}`}>
          공개 설명
        </label>
        <textarea
          id={`ending-description-${node.id}`}
          value={data.description ?? ""}
          onChange={(event) => handleChange({ description: event.target.value })}
          placeholder="결말 목록에서 제작자가 구분하기 쉬운 짧은 설명"
          rows={3}
          className="resize-y rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm leading-6 text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300" htmlFor={`ending-content-${node.id}`}>
          결말 본문
        </label>
        <textarea
          id={`ending-content-${node.id}`}
          value={data.endingContent ?? ""}
          onChange={(event) => handleChange({ endingContent: event.target.value })}
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
