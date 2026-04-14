import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Play } from "lucide-react";

// ---------------------------------------------------------------------------
// StartNode — 시작점 커스텀 노드 (출력 핸들만, 삭제 불가)
// ---------------------------------------------------------------------------

export function StartNode(_props: NodeProps) {
  return (
    <div className="relative flex items-center justify-center rounded-full bg-emerald-600 p-3 shadow-md">
      <Play className="h-5 w-5 text-white" />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-emerald-400"
      />
    </div>
  );
}
