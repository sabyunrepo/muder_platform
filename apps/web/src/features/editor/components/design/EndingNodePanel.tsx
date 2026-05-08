import type { Node } from "@xyflow/react";
import type { FlowNodeData } from "../../flowTypes";
import { toEndingEditorViewModel } from "../../entities/ending/endingEntityAdapter";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EndingNodePanelProps {
  node: Node;
  themeId: string;
  edges?: { target: string }[];
  onUpdate: (id: string, data: Partial<FlowNodeData>) => void;
}

// ---------------------------------------------------------------------------
// EndingNodePanel — flow 안에서는 결말 연결 요약만 보여준다.
// ---------------------------------------------------------------------------

export function EndingNodePanel({
  node,
  edges = [],
  themeId: _themeId,
  onUpdate: _onUpdate,
}: EndingNodePanelProps) {
  const incomingCount = edges.filter((edge) => edge.target === node.id).length;
  const viewModel = toEndingEditorViewModel(node, incomingCount);

  return (
    <div className="flex flex-col gap-3 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        결말 연결
      </h3>

      <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300/80">
          플로우 진행 노드
        </p>
        <h4 className="mt-1 text-sm font-semibold text-slate-100">{viewModel.name}</h4>
        <p className="mt-1 text-xs leading-5 text-slate-400">{viewModel.contentPreview}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {viewModel.badges.map((badge) => (
            <span key={badge} className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
              {badge}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-5 text-slate-500">
          상세 본문, 공개 범위, 캐릭터별 결과 카드는 결말 관리 탭에서 편집합니다.
        </p>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
        <h4 className="text-xs font-semibold text-slate-200">편집 위치</h4>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          이 노드는 장면 흐름이 결말로 이어지는 위치만 나타냅니다. 결말 이름, 본문,
          공개 범위, 결과 카드는 왼쪽 탭의 결말 관리에서 수정하세요.
        </p>
      </section>
    </div>
  );
}
