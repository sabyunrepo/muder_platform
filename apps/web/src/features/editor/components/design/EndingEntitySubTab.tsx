import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import type { Node } from "@xyflow/react";
import { useFlowData } from "../../hooks/useFlowData";
import type { FlowNodeData } from "../../flowTypes";
import { EndingEntityDetail } from "./EndingEntityDetail";

interface EndingEntitySubTabProps {
  themeId: string;
}

function getEndingLabel(node: Node) {
  const data = node.data as FlowNodeData;
  return data.label || "이름 없는 결말";
}

function getEndingDescription(node: Node) {
  const data = node.data as FlowNodeData;
  return data.description || "결말 설명을 작성해 주세요.";
}

export function EndingEntitySubTab({ themeId }: EndingEntitySubTabProps) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { nodes, isLoading, addNode, updateNodeData } = useFlowData(themeId);

  const endingNodes = useMemo(
    () => nodes.filter((node) => node.type === "ending"),
    [nodes],
  );

  const filteredNodes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return endingNodes;
    return endingNodes.filter((node) => {
      const data = node.data as FlowNodeData;
      return [data.label, data.description, data.endingContent]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [endingNodes, query]);

  const selectedNode =
    filteredNodes.find((node) => node.id === selectedId) ?? filteredNodes[0] ?? null;

  const handleAddEnding = () => {
    addNode("ending", { x: 360 + endingNodes.length * 40, y: 220 });
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-slate-400">
        결말 목록을 불러오는 중입니다...
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto bg-slate-950 p-4 lg:p-6">
      <header className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            결말 entity
          </p>
          <h2 className="text-xl font-semibold text-slate-100">결말 목록</h2>
          <p className="max-w-3xl text-sm leading-6 text-slate-400">
            Flow의 엔딩 노드를 결말 목록으로 모아 보여줍니다. 분기 매트릭스는 다음 PR에서 연결하고,
            여기서는 플레이어에게 공개될 결말 이름과 본문을 먼저 정리합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddEnding}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 text-sm font-medium text-amber-200 transition hover:bg-amber-500/20 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
        >
          <Plus className="h-4 w-4" />
          결말 추가
        </button>
      </header>

      {endingNodes.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-8 text-center">
          <div className="max-w-md space-y-3">
            <h3 className="text-lg font-semibold text-slate-100">아직 결말이 없습니다</h3>
            <p className="text-sm leading-6 text-slate-400">
              Flow에서 결말 노드를 추가하면 이곳에서 결말 내용을 작성할 수 있어요.
              바로 시작하려면 위의 “결말 추가” 버튼을 눌러도 됩니다.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(260px,360px)_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="결말 검색"
                className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </label>

            <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
              {filteredNodes.length === 0 ? (
                <p className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
                  검색 결과가 없습니다.
                </p>
              ) : (
                filteredNodes.map((node) => {
                  const data = node.data as FlowNodeData;
                  const selected = selectedNode?.id === node.id;
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => setSelectedId(node.id)}
                      className={`rounded-xl border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-amber-400/60 ${
                        selected
                          ? "border-amber-500/70 bg-amber-500/10"
                          : "border-slate-800 bg-slate-950 hover:border-slate-600"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span aria-hidden="true">{data.icon || "🎭"}</span>
                        <span className="font-medium text-slate-100">{getEndingLabel(node)}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">
                        {getEndingDescription(node)}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {selectedNode && (
            <EndingEntityDetail node={selectedNode} themeId={themeId} onChange={updateNodeData} />
          )}
        </div>
      )}
    </div>
  );
}
