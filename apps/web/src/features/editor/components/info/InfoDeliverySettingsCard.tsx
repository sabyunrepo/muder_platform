import { useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";

import { useEditorCharacters } from "@/features/editor/api";
import { useFlowGraph, useUpdateFlowNode } from "@/features/editor/flowApi";
import type { FlowNodeResponse } from "@/features/editor/flowTypes";
import {
  normalizeTarget,
  readInfoDeliveryTarget,
  targetsEqual,
  writeInfoDeliveryTarget,
  type InfoDeliveryTargetDraft,
  type InfoDeliveryTargetMode,
} from "@/features/editor/entities/info/infoDeliverySettingsAdapter";

interface InfoDeliverySettingsCardProps {
  themeId: string;
  storyInfoId: string;
}

interface PhaseOption {
  id: string;
  label: string;
  node: FlowNodeResponse;
}

export function InfoDeliverySettingsCard({
  themeId,
  storyInfoId,
}: InfoDeliverySettingsCardProps) {
  const { data: flowGraph, isLoading: flowLoading, isError: flowError, refetch: refetchFlow } =
    useFlowGraph(themeId);
  const {
    data: characters = [],
    isLoading: charactersLoading,
    isError: charactersError,
    refetch: refetchCharacters,
  } = useEditorCharacters(themeId);
  const updateNode = useUpdateFlowNode(themeId);

  const phaseOptions = useMemo(
    () =>
      (flowGraph?.nodes ?? [])
        .filter((node) => node.type === "phase")
        .map((node, index): PhaseOption => ({
          id: node.id,
          label: node.data.label?.trim() || `장면 ${index + 1}`,
          node,
        })),
    [flowGraph?.nodes],
  );

  const isLoading = flowLoading || charactersLoading;
  const isError = flowError || charactersError;

  return (
    <section className="rounded border border-slate-800 bg-slate-950 p-4" aria-label="정보 배포 설정">
      <div className="flex flex-col gap-2 border-b border-slate-800 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">장면 시작 배포</h3>
          <p className="mt-1 text-xs text-slate-400">
            선택한 장면이 시작될 때 이 정보를 누구에게 보여줄지 정합니다.
          </p>
        </div>
        {isError ? (
          <button
            type="button"
            onClick={() => {
              if (flowError) void refetchFlow();
              if (charactersError) void refetchCharacters();
            }}
            className="self-start rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500"
          >
            다시 불러오기
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <p className="py-4 text-xs text-slate-500">장면과 캐릭터를 불러오는 중입니다.</p>
      ) : isError ? (
        <p className="py-4 text-xs text-rose-300">배포 설정을 불러오지 못했습니다.</p>
      ) : phaseOptions.length === 0 ? (
        <p className="py-4 text-xs text-slate-500">
          게임 진행 플로우에 장면을 먼저 추가하면 이 정보를 배포할 수 있습니다.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {phaseOptions.map((phase) => (
            <InfoDeliveryPhaseRow
              key={phase.id}
              phase={phase}
              storyInfoId={storyInfoId}
              characters={characters}
              isSaving={updateNode.isPending}
              onSave={(target) =>
                updateNode.mutateAsync({
                  nodeId: phase.id,
                  body: {
                    data: {
                      ...phase.node.data,
                      ...writeInfoDeliveryTarget(phase.node.data, storyInfoId, target),
                    },
                  },
                })
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

function InfoDeliveryPhaseRow({
  phase,
  storyInfoId,
  characters,
  isSaving,
  onSave,
}: {
  phase: PhaseOption;
  storyInfoId: string;
  characters: Array<{ id: string; name: string }>;
  isSaving: boolean;
  onSave: (target: InfoDeliveryTargetDraft) => Promise<unknown>;
}) {
  const savedTarget = useMemo(
    () => readInfoDeliveryTarget(phase.node.data, storyInfoId),
    [phase.node.data, storyInfoId],
  );
  const [draftTarget, setDraftTarget] = useState(savedTarget);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "failed">("idle");

  useEffect(() => {
    setDraftTarget(savedTarget);
    setSaveState("idle");
  }, [savedTarget]);

  const normalizedDraft = normalizeTarget(draftTarget);
  const isDirty = !targetsEqual(savedTarget, draftTarget);
  const hasCharacters = characters.length > 0;
  const canApply = draftTarget.mode !== "characters" || draftTarget.characterIds.length > 0;

  async function handleSave() {
    setSaveState("idle");
    try {
      await onSave(normalizedDraft);
      setSaveState("saved");
    } catch {
      setSaveState("failed");
    }
  }

  return (
    <article className="rounded-lg border border-slate-800 bg-slate-900/55 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-sm font-medium text-slate-100">{phase.label}</h4>
          <p className="mt-0.5 text-xs text-slate-500">{targetSummary(savedTarget, characters)}</p>
        </div>
        <div className="flex items-center gap-2">
          {saveState === "saved" ? <span className="text-xs text-emerald-300">저장됨</span> : null}
          {saveState === "failed" ? <span className="text-xs text-rose-300">저장 실패</span> : null}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!isDirty || !canApply || isSaving}
            className="inline-flex items-center gap-1 rounded bg-amber-500 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500"
          >
            <Save className="h-3.5 w-3.5" />
            {isSaving ? "적용 중..." : "배포 적용"}
          </button>
        </div>
      </div>

      <fieldset className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
        <legend className="sr-only">{phase.label} 배포 대상</legend>
        {(["none", "all_players", "characters"] as InfoDeliveryTargetMode[]).map((mode) => (
          <label
            key={mode}
            className="flex items-center gap-2 rounded border border-slate-800 bg-slate-950/70 px-3 py-2"
          >
            <input
              type="radio"
              name={`info-delivery-${phase.id}`}
              value={mode}
              checked={draftTarget.mode === mode}
              disabled={mode === "characters" && !hasCharacters}
              onChange={() => setDraftTarget(mode === "characters" ? { mode, characterIds: [] } : { mode, characterIds: [] })}
            />
            {modeLabel(mode)}
          </label>
        ))}
      </fieldset>

      {draftTarget.mode === "characters" ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {characters.map((character) => (
            <label
              key={character.id}
              className="flex items-center gap-2 rounded border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-200"
            >
              <input
                type="checkbox"
                checked={draftTarget.characterIds.includes(character.id)}
                onChange={() =>
                  setDraftTarget({
                    mode: "characters",
                    characterIds: toggleId(draftTarget.characterIds, character.id),
                  })
                }
              />
              <span className="truncate">{character.name}</span>
            </label>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function targetSummary(target: InfoDeliveryTargetDraft, characters: Array<{ id: string; name: string }>): string {
  const normalized = normalizeTarget(target);
  if (normalized.mode === "all_players") return "현재 전체 캐릭터에게 공개됩니다.";
  if (normalized.mode === "characters") {
    const names = normalized.characterIds
      .map((id) => characters.find((character) => character.id === id)?.name ?? "이름 없는 캐릭터")
      .join(", ");
    return `현재 ${names}에게 공개됩니다.`;
  }
  return "현재 이 장면에서는 공개되지 않습니다.";
}

function modeLabel(mode: InfoDeliveryTargetMode): string {
  if (mode === "all_players") return "전체 캐릭터";
  if (mode === "characters") return "캐릭터 선택";
  return "배포 안 함";
}

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
}
