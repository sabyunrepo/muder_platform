import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RelationEdgeData {
  mode?: "AND" | "OR";
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// RelationEdge
// ---------------------------------------------------------------------------

export function RelationEdge(props: EdgeProps) {
  const {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    style,
  } = props;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const edgeData = data as RelationEdgeData | undefined;
  const mode = edgeData?.mode ?? "AND";
  const isAnd = mode === "AND";

  const edgeStyle: React.CSSProperties = {
    ...style,
    stroke: isAnd ? "#f59e0b" : "#60a5fa",
    strokeDasharray: isAnd ? undefined : "5 5",
  };

  return (
    <>
      <BaseEdge path={edgePath} style={edgeStyle} />
      <EdgeLabelRenderer>
        <div
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
          className="pointer-events-auto rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300"
        >
          {mode}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
