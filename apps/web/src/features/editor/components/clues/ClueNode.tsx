import { Handle, Position, type NodeProps } from "@xyflow/react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClueNodeData {
  label?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// ClueNode
// ---------------------------------------------------------------------------

export function ClueNode({ data, selected }: NodeProps) {
  const nodeData = data as ClueNodeData;

  const borderClass = selected
    ? "border-amber-500 ring-1 ring-amber-500/30"
    : "border-slate-600";

  return (
    <div
      className={`relative min-w-[120px] rounded border bg-slate-800 px-3 py-2 shadow-md ${borderClass}`}
    >
      {/* Target handle — top */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-amber-400"
      />

      {/* Content */}
      <div className="flex flex-col gap-0.5">
        <span className="max-w-[140px] truncate text-xs font-medium text-slate-100">
          {nodeData.label ?? "단서"}
        </span>
      </div>

      {/* Source handle — bottom */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-amber-400"
      />
    </div>
  );
}
