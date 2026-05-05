import {
  KeyRound,
  MapPin,
} from "lucide-react";
import { useState } from "react";
import { FlowCanvas } from "../design/FlowCanvas";
import {
  EditorEntityLibrary,
  type StoryLibraryEntity,
} from "./EditorEntityLibrary";

interface StoryMapWorkspaceProps {
  themeId: string;
}

const INSPECTOR_GROUPS = [
  { label: "장면 내용", value: "스토리 본문과 공개 정보를 확인합니다." },
  { label: "연결 항목", value: "등장인물, 단서, 장소를 장면 흐름에 맞춰 연결합니다." },
  { label: "진행 조건", value: "조사권, 토론방, 트리거를 장면 전환 기준으로 정리합니다." },
] as const;

export function StoryMapWorkspace({ themeId }: StoryMapWorkspaceProps) {
  const [selectedEntity, setSelectedEntity] = useState<StoryLibraryEntity | null>(null);

  return (
    <section
      aria-label="스토리 진행 제작"
      className="flex min-h-[calc(100vh-9.5rem)] flex-col bg-slate-950 text-slate-100"
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

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[17rem_minmax(0,1fr)_20rem]">
        <EditorEntityLibrary
          themeId={themeId}
          selectedEntity={selectedEntity}
          onSelectEntity={setSelectedEntity}
        />

        <main className="min-h-[620px] min-w-0 border-b border-slate-800 lg:border-b-0">
          <FlowCanvas themeId={themeId} />
        </main>

        <aside className="bg-slate-950">
          <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
            <MapPin className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-slate-100">장면 속성</h3>
          </div>
          <div className="space-y-3 p-4">
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
            {INSPECTOR_GROUPS.map((group) => (
              <div
                key={group.label}
                className="rounded-md border border-slate-800 bg-slate-900/70 p-3"
              >
                <h4 className="text-sm font-medium text-slate-200">{group.label}</h4>
                <p className="mt-2 text-xs leading-5 text-slate-400">{group.value}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
