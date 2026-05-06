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
import type { Node } from "@xyflow/react";
import type { FlowNodeData } from "@/features/editor/flowTypes";
import type { StoryLibraryEntity } from "./EditorEntityLibrary";
import { formatDiscussionRoomSummary } from "@/features/editor/entities/phase/discussionRoomPolicyAdapter";

interface SceneInspectorProps {
  selectedScene: Node<FlowNodeData> | null;
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

function describeSceneType(type?: string): string {
  if (type === "phase") return "스토리 장면";
  if (type === "branch") return "분기";
  if (type === "ending") return "엔딩";
  if (type === "start") return "시작 지점";
  return "스토리 항목";
}

function countActions(actions?: FlowNodeData["onEnter"]): string {
  const count = actions?.length ?? 0;
  return count > 0 ? `${count}개 설정됨` : "설정 없음";
}

function hasAction(data: FlowNodeData, keyword: string): boolean {
  return (data.onEnter ?? []).some((action) => action.type.includes(keyword));
}

function buildRows(scene: Node<FlowNodeData> | null): InspectorRow[] {
  if (!scene) return EMPTY_ROWS;
  const data = scene.data;
  return [
    {
      label: "정보 공개",
      value: data.description ? "장면 설명 있음" : "공개 설명 없음",
    },
    {
      label: "단서 배포",
      value: hasAction(data, "clue") ? "입장 시 단서 동작 있음" : "연결된 단서 동작 없음",
    },
    {
      label: "장소",
      value: hasAction(data, "location") ? "장소 동작 있음" : "장소 동작 없음",
    },
    {
      label: "조사권",
      value: hasAction(data, "investigation") ? "조사권 동작 있음" : "조사권 동작 없음",
    },
    {
      label: "토론방",
      value: formatDiscussionRoomSummary(data.discussionRoomPolicy),
    },
    {
      label: "연출",
      value: data.icon || data.color ? "표시 설정 있음" : "기본 표시",
    },
    {
      label: "조건",
      value: data.autoAdvance ? "자동 진행" : "수동 또는 연결선 조건",
    },
    {
      label: "액션",
      value: `입장 ${countActions(data.onEnter)} · 퇴장 ${countActions(data.onExit)}`,
    },
  ];
}

export function SceneInspector({ selectedScene, selectedEntity }: SceneInspectorProps) {
  const rows = buildRows(selectedScene);
  const sceneTitle = selectedScene?.data.label ?? "선택한 장면 없음";

  return (
    <aside className="bg-slate-950 lg:min-h-0 lg:overflow-y-auto">
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
        <MapPin className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-slate-100">장면 속성</h3>
      </div>
      <div className="space-y-3 p-4">
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

        <div className="space-y-2">
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
