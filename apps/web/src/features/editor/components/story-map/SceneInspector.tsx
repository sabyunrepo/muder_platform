import {
  Clapperboard,
  Eye,
  GitBranch,
  KeyRound,
  Link2,
  MapPin,
  MessageSquare,
  Search,
  Zap,
} from "lucide-react";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData, PhaseAction } from "@/features/editor/flowTypes";
import type { StoryLibraryEntity } from "./EditorEntityLibrary";
import { formatDiscussionRoomSummary } from "@/features/editor/entities/phase/discussionRoomPolicyAdapter";
import { toPhaseEditorViewModel } from "@/features/editor/entities/phase/phaseEntityAdapter";
import {
  flowNodeToInformationDeliveries,
  isInformationDeliveryAction,
} from "@/features/editor/entities/shared/informationDeliveryAdapter";
import {
  getCreatorActionLabel,
  toCreatorActionLabels,
} from "@/features/editor/entities/shared/actionAdapter";

interface SceneInspectorProps {
  selectedScene: Node<FlowNodeData> | null;
  selectedSceneEdges?: Edge[];
  selectedEntity: StoryLibraryEntity | null;
}

interface InspectorRow {
  label: string;
  value: string;
}

const EMPTY_ROWS: InspectorRow[] = [
  { label: "정보 공개", value: "장면을 선택하면 공개할 정보를 확인합니다." },
  { label: "단서 배포", value: "장면을 선택하면 연결된 단서를 확인합니다." },
  { label: "장소", value: "장면을 선택하면 열리는 장소를 확인합니다." },
  { label: "조사권", value: "장면을 선택하면 조사권 사용 기준을 확인합니다." },
  { label: "토론방", value: "장면을 선택하면 대화 공간 정책을 확인합니다." },
  { label: "연출", value: "장면을 선택하면 미디어와 화면 전환을 확인합니다." },
  { label: "조건", value: "장면을 선택하면 전환 조건을 확인합니다." },
  { label: "액션", value: "장면을 선택하면 실행 동작을 확인합니다." },
];

const ROW_ICONS = [
  Eye,
  Search,
  MapPin,
  KeyRound,
  MessageSquare,
  Clapperboard,
  GitBranch,
  Zap,
] as const;

const PRESENTATION_ACTION_TYPES = new Set([
  "SET_BGM",
  "PLAY_SOUND",
  "PLAY_MEDIA",
  "STOP_AUDIO",
  "SET_BACKGROUND",
  "SET_THEME_COLOR",
  "play_bgm",
  "play_sound",
  "play_media",
  "stop_bgm",
  "set_background",
  "set_theme_color",
]);

function describeSceneType(type?: string): string {
  if (type === "phase") return "스토리 장면";
  if (type === "branch") return "분기";
  if (type === "ending") return "엔딩";
  if (type === "start") return "시작 지점";
  return "스토리 항목";
}

function countKeywordActions(data: FlowNodeData, keywords: string[]): number {
  return (data.onEnter ?? []).filter((action) =>
    keywords.some((keyword) => action.type.toLowerCase().includes(keyword)),
  ).length;
}

function splitActions(actions: PhaseAction[]) {
  const presentation = actions.filter((action) => PRESENTATION_ACTION_TYPES.has(action.type));
  const trigger = actions.filter(
    (action) =>
      !PRESENTATION_ACTION_TYPES.has(action.type) &&
      !isInformationDeliveryAction(action),
  );
  return { presentation, trigger };
}

function formatInformationDelivery(data: FlowNodeData): string {
  const deliveries = flowNodeToInformationDeliveries(data);
  if (deliveries.length === 0) return "정보 공개 설정 없음";
  const readingCount = deliveries.reduce(
    (sum, delivery) => sum + delivery.readingSectionIds.length,
    0,
  );
  const infoCount = deliveries.reduce(
    (sum, delivery) => sum + delivery.storyInfoIds.length,
    0,
  );
  return `공개 설정 ${deliveries.length}개 · 읽기 대사 ${readingCount}개 · 스토리 정보 ${infoCount}개`;
}

function formatPresentation(data: FlowNodeData): string {
  const { presentation } = splitActions(data.onEnter ?? []);
  const visualLabels = [data.icon ? "아이콘" : null, data.color ? "색상" : null].filter(Boolean);
  const actionLabels = presentation.map((action) => getCreatorActionLabel(action.type));
  const labels = [...visualLabels, ...actionLabels];
  return labels.length > 0 ? labels.join(", ") : "연출 설정 없음";
}

function formatTriggerActions(data: FlowNodeData): string {
  const enter = splitActions(data.onEnter ?? []).trigger;
  const exit = data.onExit ?? [];
  const enterLabel = enter.length > 0
    ? enter.map((action) => getCreatorActionLabel(action.type)).join(", ")
    : "시작 트리거 없음";
  const exitLabel = exit.length > 0
    ? toCreatorActionLabels(exit).join(", ")
    : "종료 트리거 없음";
  return `시작: ${enterLabel} · 종료: ${exitLabel}`;
}

function buildRows(scene: Node<FlowNodeData> | null, outgoingEdges: Edge[]): InspectorRow[] {
  if (!scene) return EMPTY_ROWS;
  const data = scene.data;
  const phaseSummary = toPhaseEditorViewModel(data, outgoingEdges);
  const clueActionCount = countKeywordActions(data, ["clue"]);
  const locationActionCount = countKeywordActions(data, ["location"]);
  const investigationActionCount = countKeywordActions(data, ["investigation", "token"]);
  return [
    {
      label: "정보 공개",
      value: formatInformationDelivery(data),
    },
    {
      label: "단서 배포",
      value: clueActionCount > 0 ? `단서 실행 ${clueActionCount}개` : "연결된 단서 실행 없음",
    },
    {
      label: "장소",
      value: locationActionCount > 0 ? `장소 실행 ${locationActionCount}개` : "장소 열림/잠금 실행 없음",
    },
    {
      label: "조사권",
      value: investigationActionCount > 0
        ? `조사권 실행 ${investigationActionCount}개`
        : "조사권 실행 없음",
    },
    {
      label: "토론방",
      value: formatDiscussionRoomSummary(data.discussionRoomPolicy),
    },
    {
      label: "연출",
      value: formatPresentation(data),
    },
    {
      label: "조건",
      value: `${phaseSummary.autoAdvanceLabel} · ${phaseSummary.defaultTransitionLabel} · 조건 이동 ${phaseSummary.conditionalTransitionCount}개`,
    },
    {
      label: "액션",
      value: formatTriggerActions(data),
    },
  ];
}

export function SceneInspector({
  selectedScene,
  selectedSceneEdges = [],
  selectedEntity,
}: SceneInspectorProps) {
  const rows = buildRows(selectedScene, selectedSceneEdges);
  const sceneTitle = selectedScene?.data.label ?? "선택한 장면 없음";

  return (
    <aside className="bg-slate-950 lg:min-h-0 lg:w-80 lg:shrink-0 lg:overflow-y-auto">
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
        <MapPin className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-slate-100">장면 속성</h3>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:block lg:space-y-3">
        <div className="rounded-md border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
            <Link2 className="h-4 w-4 text-amber-400" />
            선택한 장면
          </div>
          <div className="mt-3 rounded-md border border-slate-800 bg-slate-950 p-3">
            <p className="text-sm font-medium text-slate-100">{sceneTitle}</p>
            <p className="mt-1 text-xs text-slate-400">
              {selectedScene
                ? describeSceneType(selectedScene.type)
                : "중앙 흐름에서 장면을 선택하세요."}
            </p>
          </div>
        </div>

        <div className="rounded-md border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
            <KeyRound className="h-4 w-4 text-amber-400" />
            선택한 연결 대상
          </div>
          {selectedEntity ? (
            <div className="mt-3 rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
              <p className="text-sm font-medium text-amber-100">{selectedEntity.title}</p>
              <p className="mt-1 text-xs text-amber-200/80">
                {selectedEntity.section} · {selectedEntity.detail}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-400">
              왼쪽 라이브러리에서 항목을 선택하면 장면에 붙일 연결 대상으로 표시합니다.
            </p>
          )}
        </div>

        <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2 lg:block lg:space-y-2">
          {rows.map((row, index) => {
            const Icon = ROW_ICONS[index];
            return (
              <div
                key={row.label}
                className="rounded-md border border-slate-800 bg-slate-900/70 p-3"
              >
                <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                  <Icon className="h-4 w-4 text-amber-400" />
                  {row.label}
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">{row.value}</p>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
