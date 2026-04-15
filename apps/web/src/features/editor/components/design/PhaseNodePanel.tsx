import { useRef, useEffect, useCallback } from "react";
import type { Node } from "@xyflow/react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useUpdateFlowNode } from "../../flowApi";
import type {
  FlowGraphResponse,
  FlowNodeData,
  PhaseAction,
} from "../../flowTypes";
import { flowKeys } from "../../flowTypes";
import { ActionListEditor } from "./ActionListEditor";

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

/** Debounce window for flow-node saves (W2 PR-5: 500→1500ms). */
const SAVE_DEBOUNCE_MS = 1500;

// ---------------------------------------------------------------------------
// PhaseNodePanel — 페이즈 노드 편집 패널
// ---------------------------------------------------------------------------

export function PhaseNodePanel({ node, themeId, onUpdate }: PhaseNodePanelProps) {
  const updateNode = useUpdateFlowNode(themeId);
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<FlowNodeData | null>(null);
  const rollbackRef = useRef<FlowGraphResponse | undefined>(undefined);
  const data = node.data as FlowNodeData;

  /** Send the pending network write immediately and cancel the debounce timer. */
  const flush = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (!pendingRef.current) return;
    const body = pendingRef.current;
    pendingRef.current = null;

    // Optimistic update: patch the node inside the flow-graph cache so other
    // subscribers (canvas) see the latest data without waiting for the PATCH
    // response. Snapshot the previous graph for rollback on error.
    const cacheKey = flowKeys.graph(themeId);
    const previous = queryClient.getQueryData<FlowGraphResponse>(cacheKey);
    if (previous) {
      rollbackRef.current = previous;
      queryClient.setQueryData<FlowGraphResponse>(cacheKey, {
        ...previous,
        nodes: previous.nodes.map((n) =>
          n.id === node.id ? { ...n, data: { ...n.data, ...body } } : n,
        ),
      });
    }

    updateNode.mutate(
      { nodeId: node.id, body: { data: body } },
      {
        onError: () => {
          if (rollbackRef.current) {
            queryClient.setQueryData(cacheKey, rollbackRef.current);
          }
          toast.error("저장에 실패했습니다");
        },
      },
    );
  }, [node.id, queryClient, themeId, updateNode]);

  useEffect(() => {
    return () => {
      // Fire any pending save on unmount so the user doesn't lose edits when
      // they switch nodes or close the panel within the debounce window.
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (pendingRef.current) {
        updateNode.mutate({ nodeId: node.id, body: { data: pendingRef.current } });
        pendingRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (patch: Partial<FlowNodeData>) => {
    onUpdate(node.id, patch);
    const merged = { ...data, ...(pendingRef.current ?? {}), ...patch };
    pendingRef.current = merged;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      flush();
    }, SAVE_DEBOUNCE_MS);
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
          onBlur={flush}
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
          onBlur={flush}
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
          onBlur={flush}
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
          onBlur={flush}
          placeholder="1"
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:border-amber-500 focus:outline-none"
        />
      </div>

      {/* Auto-advance toggle */}
      <div className="flex items-center justify-between">
        <label className="text-[11px] text-slate-400">자동 진행</label>
        <button
          type="button"
          role="switch"
          aria-checked={data.autoAdvance ?? false}
          onClick={() => handleChange({ autoAdvance: !data.autoAdvance })}
          className={`relative h-5 w-9 rounded-full transition-colors ${
            data.autoAdvance ? "bg-amber-600" : "bg-slate-700"
          }`}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
              data.autoAdvance ? "translate-x-4" : ""
            }`}
          />
        </button>
      </div>

      {/* Warning timer — only when autoAdvance */}
      {data.autoAdvance && (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-slate-400">경고 타이머 (초)</label>
          <input
            type="number"
            min={0}
            value={data.warningAt ?? ""}
            onChange={(e) =>
              handleChange({ warningAt: e.target.value ? Number(e.target.value) : undefined })
            }
            onBlur={flush}
            placeholder="30"
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:border-amber-500 focus:outline-none"
          />
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-slate-800" />

      {/* onEnter / onExit actions */}
      <ActionListEditor
        label="진입 액션 (onEnter)"
        actions={(data.onEnter as PhaseAction[]) ?? []}
        onChange={(actions) => handleChange({ onEnter: actions })}
      />
      <ActionListEditor
        label="퇴장 액션 (onExit)"
        actions={(data.onExit as PhaseAction[]) ?? []}
        onChange={(actions) => handleChange({ onExit: actions })}
      />
    </div>
  );
}
