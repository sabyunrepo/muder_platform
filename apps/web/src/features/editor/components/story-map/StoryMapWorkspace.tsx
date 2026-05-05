import {
  BookOpen,
  Clapperboard,
  KeyRound,
  Library,
  MapPin,
  MessageSquare,
  Search,
  Users,
} from "lucide-react";
import { FlowCanvas } from "../design/FlowCanvas";

interface StoryMapWorkspaceProps {
  themeId: string;
}

const LIBRARY_GROUPS = [
  { label: "스토리", icon: BookOpen, items: ["장면", "분기", "엔딩"] },
  { label: "인물", icon: Users, items: ["PC 캐릭터", "NPC 캐릭터", "역할지"] },
  { label: "조사", icon: Search, items: ["단서", "장소", "조사권"] },
  { label: "진행", icon: MessageSquare, items: ["토론방", "조건", "트리거"] },
  { label: "연출", icon: Clapperboard, items: ["미디어", "공개 타이밍", "화면 전환"] },
] as const;

const INSPECTOR_GROUPS = [
  { label: "장면 내용", value: "스토리 본문과 공개 정보를 확인합니다." },
  { label: "연결 항목", value: "등장인물, 단서, 장소를 장면 흐름에 맞춰 연결합니다." },
  { label: "진행 조건", value: "조사권, 토론방, 트리거를 장면 전환 기준으로 정리합니다." },
] as const;

export function StoryMapWorkspace({ themeId }: StoryMapWorkspaceProps) {
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
        <aside className="border-b border-slate-800 bg-slate-950 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
            <Library className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-slate-100">제작 라이브러리</h3>
          </div>
          <div className="space-y-3 p-4">
            {LIBRARY_GROUPS.map((group) => (
              <div
                key={group.label}
                className="rounded-md border border-slate-800 bg-slate-900/70 p-3"
              >
                <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
                  <group.icon className="h-4 w-4 text-amber-400" />
                  {group.label}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <span
                      key={item}
                      className="rounded-sm border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-300"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

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
                선택한 장면
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                장면을 선택하면 이곳에서 공개 정보, 연결된 단서, 진행 조건을 한 번에 확인합니다.
              </p>
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
