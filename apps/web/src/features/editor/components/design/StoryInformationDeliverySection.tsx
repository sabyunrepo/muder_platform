import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useUpdateFlowNode } from "../../flowApi";
import type {
  FlowGraphResponse,
  FlowNodeData,
  FlowNodeResponse,
} from "../../flowTypes";
import { toPhaseEditorViewModel } from "../../entities/phase/phaseEntityAdapter";
import { InformationDeliveryPanel } from "./InformationDeliveryPanel";

interface StoryInformationDeliverySectionProps {
  themeId: string;
  graph: FlowGraphResponse | undefined;
}

export function StoryInformationDeliverySection({
  themeId,
  graph,
}: StoryInformationDeliverySectionProps) {
  const scenes = useMemo(() => getSceneNodes(graph), [graph]);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const updateNode = useUpdateFlowNode(themeId);
  const selectedScene = scenes.find((scene) => scene.id === (selectedSceneId ?? scenes[0]?.id));

  const updateScene = (patch: Partial<FlowNodeData>) => {
    if (!selectedScene) return;
    updateNode.mutate(
      {
        nodeId: selectedScene.id,
        body: { data: { ...selectedScene.data, ...patch } },
      },
      {
        onError: () => toast.error("정보 공개 설정 저장에 실패했습니다"),
      },
    );
  };

  return (
    <section className="space-y-4 border-t border-slate-800 px-5 py-6">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            정보 공개
          </p>
          <h3 className="mt-1 text-sm font-semibold text-slate-100">
            장면별 정보 공개 설정
          </h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">
            스토리 정보 묶음을 장면에 연결하고, 전체 플레이어 또는 캐릭터별 공개 대상을 정합니다.
          </p>
        </div>
        <SceneCountBadge count={scenes.length} />
      </div>

      {scenes.length === 0 ? (
        <div className="rounded border border-dashed border-slate-800 bg-slate-950/50 px-3 py-4 text-xs leading-5 text-slate-400">
          스토리 진행에서 장면을 추가하면 정보 공개 대상을 설정할 수 있습니다.
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(220px,300px)_minmax(0,1fr)]">
          <SceneSelector
            scenes={scenes}
            selectedSceneId={selectedScene?.id}
            onSelect={setSelectedSceneId}
          />
          {selectedScene && (
            <InformationDeliveryPanel
              key={selectedScene.id}
              themeId={themeId}
              phaseData={selectedScene.data}
              onChange={updateScene}
            />
          )}
        </div>
      )}
    </section>
  );
}

function getSceneNodes(graph: FlowGraphResponse | undefined): FlowNodeResponse[] {
  return (graph?.nodes ?? [])
    .filter((node) => node.type === "phase")
    .sort((left, right) => {
      if (left.position_y !== right.position_y) return left.position_y - right.position_y;
      if (left.position_x !== right.position_x) return left.position_x - right.position_x;
      return left.id.localeCompare(right.id);
    });
}

function SceneCountBadge({ count }: { count: number }) {
  return (
    <div className="w-fit rounded border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs">
      <p className="text-[10px] text-slate-500">설정 가능 장면</p>
      <p className="mt-0.5 whitespace-nowrap text-slate-100">{count}개</p>
    </div>
  );
}

interface SceneSelectorProps {
  scenes: FlowNodeResponse[];
  selectedSceneId: string | undefined;
  onSelect: (sceneId: string) => void;
}

function SceneSelector({ scenes, selectedSceneId, onSelect }: SceneSelectorProps) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
      <p className="px-2 py-1 text-[11px] font-medium text-slate-400">장면 선택</p>
      <div className="mt-1 grid gap-1">
        {scenes.map((scene) => {
          const viewModel = toPhaseEditorViewModel(scene.data, []);
          const selected = scene.id === selectedSceneId;
          return (
            <button
              key={scene.id}
              type="button"
              onClick={() => onSelect(scene.id)}
              aria-pressed={selected}
              className={`rounded px-3 py-2 text-left text-xs transition-colors ${
                selected
                  ? "bg-amber-500/15 text-amber-100 ring-1 ring-amber-500/40"
                  : "bg-slate-900 text-slate-300 hover:bg-slate-800"
              }`}
            >
              <span className="block truncate font-medium">{viewModel.title}</span>
              <span className="mt-0.5 block truncate text-[10px] text-slate-400">
                {viewModel.phaseTypeLabel} · {viewModel.informationDeliveryCount}개 정보 공개
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
