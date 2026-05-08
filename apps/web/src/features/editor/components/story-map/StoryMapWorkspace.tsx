import { FlowCanvas } from "../design/FlowCanvas";

interface StoryMapWorkspaceProps {
  themeId: string;
}

export function StoryMapWorkspace({ themeId }: StoryMapWorkspaceProps) {
  return (
    <section
      aria-label="게임 진행 플로우"
      className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-950 text-slate-100"
    >
      <div className="border-b border-slate-800 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">
              Game Flow
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-50">게임 진행 플로우</h2>
          </div>
        </div>
      </div>

      <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <FlowCanvas themeId={themeId} />
      </main>
    </section>
  );
}
