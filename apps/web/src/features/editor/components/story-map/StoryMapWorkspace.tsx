import { FlowCanvas } from "../design/FlowCanvas";

interface StoryMapWorkspaceProps {
  themeId: string;
}

export function StoryMapWorkspace({ themeId }: StoryMapWorkspaceProps) {
  return (
    <section
      aria-label="게임 진행 플로우"
      className="flex h-full min-h-[calc(100vh-9.75rem)] flex-col overflow-y-auto bg-slate-950 text-slate-100 lg:overflow-hidden"
    >
      <div className="border-b border-slate-800 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">
              Game Flow
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-50">게임 진행 플로우</h2>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 text-xs text-slate-300 [scrollbar-width:none] sm:grid sm:grid-cols-4 sm:overflow-visible sm:pb-0 lg:flex [&::-webkit-scrollbar]:hidden">
            <span className="shrink-0 rounded-md border border-slate-800 bg-slate-900 px-3 py-2">
              진행 단계
            </span>
            <span className="shrink-0 rounded-md border border-slate-800 bg-slate-900 px-3 py-2">
              라운드
            </span>
            <span className="shrink-0 rounded-md border border-slate-800 bg-slate-900 px-3 py-2">
              투표
            </span>
            <span className="shrink-0 rounded-md border border-slate-800 bg-slate-900 px-3 py-2">
              엔딩
            </span>
          </div>
        </div>
      </div>

      <main className="min-h-[560px] min-w-0 flex-1 overflow-hidden">
        <FlowCanvas themeId={themeId} />
      </main>
    </section>
  );
}
