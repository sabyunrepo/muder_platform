import { useEffect, useMemo, useState } from "react";
import { Link2, Unlink } from "lucide-react";
import type { Edge, Node } from "@xyflow/react";

interface NodeConnectionPanelProps {
  node: Node;
  nodes: Node[];
  edges: Edge[];
  onConnectNodes: (sourceId: string, targetId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
}

function nodeLabel(node: Node | undefined): string {
  if (!node) return "알 수 없는 장면";
  const label = node.data?.label;
  return typeof label === "string" && label.trim() ? label.trim() : node.id;
}

export function NodeConnectionPanel({
  node,
  nodes,
  edges,
  onConnectNodes,
  onDeleteEdge,
}: NodeConnectionPanelProps) {
  const [targetId, setTargetId] = useState("");
  const outgoingEdges = useMemo(
    () => edges.filter((edge) => edge.source === node.id),
    [edges, node.id],
  );
  const connectedTargetIds = useMemo(
    () => new Set(outgoingEdges.map((edge) => edge.target)),
    [outgoingEdges],
  );
  const targetOptions = useMemo(
    () => nodes.filter((candidate) => candidate.id !== node.id && !connectedTargetIds.has(candidate.id)),
    [connectedTargetIds, node.id, nodes],
  );

  useEffect(() => {
    setTargetId("");
  }, [node.id]);

  const handleConnect = () => {
    if (!targetId) return;
    onConnectNodes(node.id, targetId);
    setTargetId("");
  };

  return (
    <section className="border-t border-slate-800 p-3">
      <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-slate-300">
        <Link2 className="h-3.5 w-3.5 text-amber-400" />
        다음 장면 연결
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <select
            aria-label="연결할 다음 장면"
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
            className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
          >
            <option value="">다음 장면 선택</option>
            {targetOptions.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {nodeLabel(candidate)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleConnect}
            disabled={!targetId}
            className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            연결
          </button>
        </div>
        {targetOptions.length === 0 ? (
          <p className="text-[11px] leading-5 text-slate-500">연결 가능한 다음 장면이 없습니다.</p>
        ) : null}
      </div>

      <div className="mt-3 space-y-2">
        <p className="text-[11px] font-medium text-slate-500">현재 연결</p>
        {outgoingEdges.length > 0 ? (
          outgoingEdges.map((edge) => (
            <div
              key={edge.id}
              className="flex items-center justify-between gap-2 rounded border border-slate-800 bg-slate-950/70 px-2 py-1.5"
            >
              <span className="min-w-0 truncate text-xs text-slate-300">
                {nodeLabel(nodes.find((candidate) => candidate.id === edge.target))}
              </span>
              <button
                type="button"
                onClick={() => onDeleteEdge(edge.id)}
                aria-label={`${nodeLabel(nodes.find((candidate) => candidate.id === edge.target))} 연결 해제`}
                className="inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-[11px] text-slate-400 hover:bg-red-950/40 hover:text-red-200"
              >
                <Unlink className="h-3 w-3" />
                해제
              </button>
            </div>
          ))
        ) : (
          <p className="text-[11px] leading-5 text-slate-500">
            아직 다음 장면이 없습니다. 위 선택창으로 이어질 장면을 연결하세요.
          </p>
        )}
      </div>
    </section>
  );
}
