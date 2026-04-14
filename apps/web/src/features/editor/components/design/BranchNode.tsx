import { Handle, Position, type NodeProps } from "@xyflow/react";
import { GitBranch } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BranchNodeData {
  label?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nodeClasses(selected: boolean): string {
  const base =
    "relative flex items-center justify-center h-16 w-16 rotate-45 rounded-md border bg-violet-900/80 shadow-md";
  const selectedStyle = "border-amber-500 ring-1 ring-amber-500/30";
  const defaultStyle = "border-violet-600";
  return `${base} ${selected ? selectedStyle : defaultStyle}`;
}

// ---------------------------------------------------------------------------
// BranchNode
// ---------------------------------------------------------------------------

export function BranchNode({ data, selected }: NodeProps) {
  const nodeData = data as BranchNodeData;

  return (
    <div className={nodeClasses(selected ?? false)}>
      {/* Inner content — counter-rotated so text is readable */}
      <div className="-rotate-45 flex flex-col items-center">
        <GitBranch className="h-4 w-4 text-violet-300" />
        <span className="mt-0.5 max-w-[50px] truncate text-[9px] text-violet-200">
          {nodeData.label ?? "분기"}
        </span>
      </div>

      {/* Target handle — top (in rotated frame) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-violet-400"
      />

      {/* Source handles — default bottom, branch-1 right, branch-2 left */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="default"
        className="!bg-violet-400"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="branch-1"
        className="!bg-violet-400"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="branch-2"
        className="!bg-violet-400"
      />
    </div>
  );
}
