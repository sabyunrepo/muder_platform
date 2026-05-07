import type { Edge, Node } from "@xyflow/react";
import { useCallback, useEffect, useState } from "react";
import type { FlowNodeData } from "@/features/editor/flowTypes";
import { FlowCanvas } from "../design/FlowCanvas";
import {
  EditorEntityLibrary,
  type StoryLibraryEntity,
} from "./EditorEntityLibrary";
import { RoundVisibilityPreviewPanel } from "./RoundVisibilityPreviewPanel";
import { SceneInspector } from "./SceneInspector";

interface StoryMapWorkspaceProps {
  themeId: string;
}

export function StoryMapWorkspace({ themeId }: StoryMapWorkspaceProps) {
  const [selectedEntity, setSelectedEntity] = useState<StoryLibraryEntity | null>(null);
  const [selectedScene, setSelectedScene] = useState<Node<FlowNodeData> | null>(null);
  const [selectedSceneEdges, setSelectedSceneEdges] = useState<Edge[]>([]);

  useEffect(() => {
    setSelectedEntity(null);
    setSelectedScene(null);
    setSelectedSceneEdges([]);
  }, [themeId]);

  const handleSelectedNodeChange = useCallback(
    (node: Node | null, context: { outgoingEdges: Edge[] }) => {
      setSelectedScene(node as Node<FlowNodeData> | null);
      setSelectedSceneEdges(context.outgoingEdges);
    },
    [],
  );

  return (
    <section
      aria-label="스토리 진행 제작"
      className="flex h-full min-h-[calc(100vh-9.5rem)] flex-col overflow-y-auto bg-slate-950 text-slate-100 lg:overflow-hidden"
    >
      <div className="border-b border-slate-800 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">
              Story Flow
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-50">스토리 진행 제작</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 sm:flex">
            <span className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2">
              장면 흐름
            </span>
            <span className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2">
              단서 연결
            </span>
            <span className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2">
              진행 조건
            </span>
            <span className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2">
              연출 점검
            </span>
          </div>
        </div>
      </div>

      <RoundVisibilityPreviewPanel themeId={themeId} />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:overflow-hidden">
        <EditorEntityLibrary
          themeId={themeId}
          selectedEntity={selectedEntity}
          onSelectEntity={setSelectedEntity}
        />

        <main className="min-h-[520px] min-w-0 flex-1 border-b border-slate-800 lg:min-h-0 lg:overflow-hidden lg:border-b-0">
          <FlowCanvas themeId={themeId} onSelectedNodeChange={handleSelectedNodeChange} />
        </main>

        <SceneInspector
          selectedScene={selectedScene}
          selectedSceneEdges={selectedSceneEdges}
          selectedEntity={selectedEntity}
        />
      </div>
    </section>
  );
}
