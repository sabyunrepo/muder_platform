import { useRef, useEffect } from "react";
import type { Node } from "@xyflow/react";
import { useUpdateFlowNode } from "../../flowApi";
import type { FlowNodeData } from "../../flowTypes";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PhaseNodePanelProps {
  node: Node;
  themeId: string;
  onUpdate: (id: string, data: Partial<FlowNodeData>) => void;
}

const PHASE_TYPES = [
  { value: "investigation", label: "수사" },
  { value: "discussion", label: "토론" },
  { value: "voting", label: "투표" },
  { value: "free", label: "자유" },
  { value: "intermission", label: "인터미션" },
];

// ---------------------------------------------------------------------------
// PhaseNodePanel — 페이즈 노드 편집 패널
// ---------------------------------------------------------------------------

export function PhaseNodePanel({ node, themeId, onUpdate }: PhaseNodePanelProps) {
  const updateNode = useUpdateFlowNode(themeId);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const data = node.data as FlowNodeData;

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChange = (patch: Partial<FlowNodeData>) => {
    onUpdate(node.id, patch);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateNode.mutate({ nodeId: node.id, body: { data: { ...data, ...patch } } });
    }, 500);
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        페이즈 설정
      </h3>

      {/* Label */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-slate-400">라벨</label>
        <input
          type="text"
          value={data.label ?? ""}
          onChange={(e) => handleChange({ label: e.target.value })}
          placeholder="페이즈 이름"
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:border-amber-500 focus:outline-none"
        />
      </div>

      {/* Phase type */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-slate-400">타입</label>
        <select
          value={data.phase_type ?? ""}
          onChange={(e) => handleChange({ phase_type: e.target.value })}
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
        >
          <option value="">선택 안 함</option>
          {PHASE_TYPES.map((pt) => (
            <option key={pt.value} value={pt.value}>
              {pt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Duration */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-slate-400">시간 (분)</label>
        <input
          type="number"
          min={0}
          value={data.duration ?? ""}
          onChange={(e) =>
            handleChange({ duration: e.target.value ? Number(e.target.value) : undefined })
          }
          placeholder="0"
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:border-amber-500 focus:outline-none"
        />
      </div>

      {/* Rounds */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-slate-400">라운드 수</label>
        <input
          type="number"
          min={1}
          value={data.rounds ?? ""}
          onChange={(e) =>
            handleChange({ rounds: e.target.value ? Number(e.target.value) : undefined })
          }
          placeholder="1"
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:border-amber-500 focus:outline-none"
        />
      </div>
    </div>
  );
}
