import { Badge } from '@/shared/components/ui';
import { EntityPageMockup } from '@/features/editor/components/design/EntityPageMockup';

export default function Phase24EditorPreviewPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-6 py-6">
        <header className="mb-4 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20 p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="warning">DEV ONLY</Badge>
            <Badge variant="default">Phase 24 PR-3</Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">
            에디터 Entity Page Preview
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            이전 PR-2 비교 UI는 제거하고, 실제 에디터의 캐릭터·장소·단서 entity 화면처럼
            한 화면에서 탐색·목록·상세·참조 정보를 확인하는 목업만 표시합니다.
          </p>
        </header>

        <EntityPageMockup />
      </div>
    </main>
  );
}
