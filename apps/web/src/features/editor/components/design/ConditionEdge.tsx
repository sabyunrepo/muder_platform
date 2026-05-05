import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConditionEdgeData {
  condition?: Record<string, unknown> | null;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// ConditionEdge
// ---------------------------------------------------------------------------

export function ConditionEdge(props: EdgeProps) {
  const {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    label,
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

  const edgeData = data as ConditionEdgeData | undefined;
  const isDefault = !edgeData?.condition;

  const edgeStyle: React.CSSProperties = {
    ...style,
    strokeDasharray: isDefault ? "5 5" : undefined,
    stroke: isDefault ? "#64748b" : "#8b5cf6",
  };

  return (
    <>
      <BaseEdge path={edgePath} style={edgeStyle} />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
            className="pointer-events-auto rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
