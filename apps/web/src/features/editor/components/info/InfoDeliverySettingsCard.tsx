import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent } from "react";
import { CheckCircle2, Users } from "lucide-react";
import { toast } from "sonner";

import { useEditorCharacters } from "@/features/editor/api";
import { SceneSelectField } from "@/features/editor/components/SceneSelectField";
import { OptionList, type OptionItem } from "@/features/editor/components/design/InformationDeliveryOptionList";
import { useFlowGraph, useUpdateFlowNode } from "@/features/editor/flowApi";
import type { FlowNodeResponse } from "@/features/editor/flowTypes";
import { editorDesignClassNames } from "@/features/editor/design-system/editorDesignTokens";
import {
  normalizeTarget,
  readInfoDeliveryTarget,
  targetsEqual,
  writeInfoDeliveryTarget,
  type InfoDeliveryTargetDraft,
} from "@/features/editor/entities/info/infoDeliverySettingsAdapter";
import { useDebouncedMutation } from "@/hooks/useDebouncedMutation";

interface InfoDeliverySettingsCardProps {
  themeId: string;
  storyInfoId: string;
}

interface PhaseOption {
  id: string;
  label: string;
  node: FlowNodeResponse;
}

interface AutosaveBody {
  phaseId: string;
  target: InfoDeliveryTargetDraft;
}

const INFO_DELIVERY_AUTOSAVE_MS = 1500;
const INFO_DELIVERY_AUTOSAVE_TOAST_ID = "info-delivery-autosave";
const ALL_CHARACTERS_ID = "__all_characters__";

export function InfoDeliverySettingsCard({
  themeId,
  storyInfoId,
}: InfoDeliverySettingsCardProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
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
  const sceneOptions = useMemo(
    () => phaseOptions.map((phase) => ({ value: phase.id, label: phase.label })),
    [phaseOptions],
  );
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const selectedPhase = useMemo(
    () => phaseOptions.find((phase) => phase.id === selectedPhaseId) ?? phaseOptions[0] ?? null,
    [phaseOptions, selectedPhaseId],
  );
  const savedTarget = useMemo(
    () => selectedPhase ? readInfoDeliveryTarget(selectedPhase.node.data, storyInfoId) : { mode: "none" as const, characterIds: [] },
    [selectedPhase, storyInfoId],
  );
  const [draftTarget, setDraftTarget] = useState<InfoDeliveryTargetDraft>(savedTarget);
  const normalizedDraft = normalizeTarget(draftTarget);
  const deliveryItems = useMemo<OptionItem[]>(
    () => [
      { id: ALL_CHARACTERS_ID, name: "전체 캐릭터", summary: "장면 시작 시 모든 캐릭터에게 배포" },
      ...characters.map((character) => ({ id: character.id, name: character.name })),
    ],
    [characters],
  );
  const selectedDeliveryIds = useMemo(() => {
    if (normalizedDraft.mode === "all_players") return [ALL_CHARACTERS_ID];
    if (normalizedDraft.mode === "characters") return normalizedDraft.characterIds;
    return [];
  }, [normalizedDraft]);

  const isLoading = flowLoading || charactersLoading;
  const isError = flowError || charactersError;

  useEffect(() => {
    if (selectedPhaseId && phaseOptions.some((phase) => phase.id === selectedPhaseId)) return;
    setSelectedPhaseId(phaseOptions[0]?.id ?? null);
  }, [phaseOptions, selectedPhaseId]);

  useEffect(() => {
    setDraftTarget(savedTarget);
  }, [savedTarget]);

  const saveBody = useCallback(
    (body: AutosaveBody, opts?: { onError?: (error?: unknown) => void }) => {
      const phase = phaseOptions.find((item) => item.id === body.phaseId);
      if (!phase) {
        opts?.onError?.(new Error("Selected phase is no longer available"));
        return;
      }

      toast.loading("정보 배포 설정 저장 중...", { id: INFO_DELIVERY_AUTOSAVE_TOAST_ID });
      updateNode.mutateAsync({
        nodeId: phase.id,
        body: {
          data: {
            ...phase.node.data,
            ...writeInfoDeliveryTarget(phase.node.data, storyInfoId, normalizeTarget(body.target)),
          },
        },
      }).then(() => {
        toast.success("정보 배포 설정이 자동저장되었습니다", {
          id: INFO_DELIVERY_AUTOSAVE_TOAST_ID,
          duration: 1200,
        });
      }).catch((error) => {
        opts?.onError?.(error);
      });
    },
    [phaseOptions, storyInfoId, updateNode],
  );

  const showFailureToast = useCallback((body: AutosaveBody) => {
    toast.error("정보 배포 설정 저장에 실패했습니다", {
      id: INFO_DELIVERY_AUTOSAVE_TOAST_ID,
      duration: 6000,
      action: {
        label: "재시도",
        onClick: () => {
          saveBody(body, { onError: () => showFailureToast(body) });
        },
      },
    });
  }, [saveBody]);

  const { schedule, flush, cancel } = useDebouncedMutation<AutosaveBody>({
    debounceMs: INFO_DELIVERY_AUTOSAVE_MS,
    mutate: (body, opts) => {
      saveBody(body, {
        onError: (error) => {
          opts.onError(error);
          showFailureToast(body);
        },
      });
    },
  });

  const updateDraftTarget = useCallback(
    (target: InfoDeliveryTargetDraft) => {
      if (!selectedPhase) return;
      const normalized = normalizeTarget(target);
      setDraftTarget(normalized);
      if (!targetsEqual(savedTarget, normalized)) {
        schedule({ phaseId: selectedPhase.id, target: normalized });
      } else {
        cancel();
      }
    },
    [cancel, savedTarget, schedule, selectedPhase],
  );

  const handleSceneChange = useCallback(
    (sceneId: string | null) => {
      flush();
      setSelectedPhaseId(sceneId);
    },
    [flush],
  );

  const handleBlur = useCallback((event: FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && panelRef.current?.contains(nextTarget)) return;
    flush();
  }, [flush]);

  const handleDeliveryToggle = useCallback(
    (id: string) => {
      if (id === ALL_CHARACTERS_ID) {
        updateDraftTarget(
          normalizedDraft.mode === "all_players"
            ? { mode: "none", characterIds: [] }
            : { mode: "all_players", characterIds: [] },
        );
        return;
      }
      const currentIds = normalizedDraft.mode === "characters" ? normalizedDraft.characterIds : [];
      const nextIds = toggleId(currentIds, id);
      updateDraftTarget({ mode: nextIds.length > 0 ? "characters" : "none", characterIds: nextIds });
    },
    [normalizedDraft, updateDraftTarget],
  );

  return (
    <section className={`p-4 ${editorDesignClassNames.panel}`} aria-label="정보 배포 설정">
      <div className="flex flex-col gap-2 border-b border-[var(--mmp-editor-color-hairline)] pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--mmp-editor-color-charcoal)]">장면 시작 배포</h3>
          <p className="mt-1 text-xs text-[var(--mmp-editor-color-slate)]">
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
            className={`self-start px-3 py-1.5 text-xs ${editorDesignClassNames.secondaryAction}`}
          >
            다시 불러오기
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <p className="py-4 text-xs text-[var(--mmp-editor-color-slate)]">장면과 캐릭터를 불러오는 중입니다.</p>
      ) : isError ? (
        <p className="py-4 text-xs text-rose-300">배포 설정을 불러오지 못했습니다.</p>
      ) : phaseOptions.length === 0 ? (
        <p className="py-4 text-xs text-[var(--mmp-editor-color-slate)]">
          게임 진행 플로우에 장면을 먼저 추가하면 이 정보를 배포할 수 있습니다.
        </p>
      ) : (
        <div ref={panelRef} onBlur={handleBlur} className="mt-3 space-y-4">
          <SceneSelectField
            label="배포 장면"
            selectedId={selectedPhase?.id ?? null}
            options={sceneOptions}
            onChange={handleSceneChange}
            emptyLabel="장면 선택"
            allowClear={false}
            disabled={updateNode.isPending}
          />

          <div className={`p-3 ${editorDesignClassNames.subtlePanel}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h4 className="text-sm font-medium text-[var(--mmp-editor-color-charcoal)]">
                  {selectedPhase?.label ?? "장면 선택"}
                </h4>
                <p className="mt-0.5 text-xs text-[var(--mmp-editor-color-slate)]">
                  {targetSummary(normalizedDraft, characters)}
                </p>
              </div>
              <span className={`inline-flex items-center gap-1 self-start px-2 py-1 text-[11px] ${editorDesignClassNames.tag}`}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                변경하면 자동저장
              </span>
            </div>

            <div className="mt-3 grid gap-3">
              <button
                type="button"
                onClick={() => updateDraftTarget({ mode: "none", characterIds: [] })}
                aria-pressed={normalizedDraft.mode === "none"}
                className={`flex min-h-10 items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                  normalizedDraft.mode === "none"
                    ? editorDesignClassNames.listItemActive
                    : editorDesignClassNames.listItem
                }`}
              >
                <Users className="h-4 w-4 text-[var(--mmp-editor-color-slate)]" />
                배포하지 않음
              </button>
              <OptionList
                title="배포 대상"
                emptyText="등록된 캐릭터가 없습니다."
                items={deliveryItems}
                selectedIds={selectedDeliveryIds}
                getMeta={(item) => item.id === ALL_CHARACTERS_ID ? "전체" : undefined}
                onToggle={handleDeliveryToggle}
                allItems={deliveryItems}
              />
            </div>
          </div>
        </div>
      )}
    </section>
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

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
}
