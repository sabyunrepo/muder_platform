import type { Edge, Node } from "@xyflow/react";
import {
  toStorySceneFlowSummary,
  type StorySceneFlowSummary,
} from "../../entities/story/storySceneAdapter";

interface StorySceneSummaryProps {
  nodes?: Node[];
  edges?: Edge[];
  summary?: StorySceneFlowSummary;
}

export function StorySceneSummary({
  nodes = [],
  edges = [],
  summary,
}: StorySceneSummaryProps) {
  const resolvedSummary = summary ?? toStorySceneFlowSummary(nodes, edges);
  const previewScenes = resolvedSummary.scenes.slice(0, 4);

  return (
    <section className="border-b border-slate-800 bg-slate-900/60 px-4 py-3 lg:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            스토리 구성
          </p>
          <h3 className="mt-1 text-sm font-semibold text-slate-100">스토리 장면 구성</h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">
            장면은 플레이어가 실제로 지나가는 진행 단위입니다. 이 화면에서 장면 순서,
            조건 이동, 정보 공개, 시작/마무리 변화를 함께 점검합니다.
          </p>
        </div>

        <div className="grid min-w-0 grid-cols-3 gap-2 text-xs">
          <SummaryPill label="장면" value={resolvedSummary.sceneCountLabel} />
          <SummaryPill label="이동" value={resolvedSummary.transitionCountLabel} />
          <SummaryPill label="조건" value={resolvedSummary.conditionalTransitionCountLabel} />
        </div>
      </div>

      {previewScenes.length > 0 ? (
        <div className="mt-3 grid gap-2 md:grid-cols-2 lg:hidden">
          {previewScenes.map((scene) => (
            <article
              key={scene.id}
              className="min-w-0 rounded border border-slate-800 bg-slate-950/70 p-3"
            >
              <div className="flex min-w-0 items-center justify-between gap-2">
                <h4 className="truncate text-xs font-semibold text-slate-100">
                  {scene.title}
                </h4>
                <span className="shrink-0 rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                  {scene.typeLabel}
                </span>
              </div>
              <dl className="mt-2 grid gap-1 text-[11px] leading-5 text-slate-400">
                <SceneFact label="정보" value={scene.informationLabel} />
                <SceneFact label="이동" value={scene.transitionLabel} />
                <SceneFact label="시작 변화" value={scene.startActionLabel} />
                <SceneFact label="마무리 변화" value={scene.endActionLabel} />
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded border border-dashed border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-500 lg:hidden">
          장면을 추가하면 스토리 진행 구성이 여기에 표시됩니다.
        </div>
      )}
    </section>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-950/70 px-3 py-2">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="mt-0.5 whitespace-nowrap text-slate-100">{value}</p>
    </div>
  );
}

function SceneFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="truncate text-slate-300">{value}</dd>
    </div>
  );
}
