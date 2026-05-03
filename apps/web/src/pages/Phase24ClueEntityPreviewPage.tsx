import { useMemo, useState } from 'react';
import { Plus, Search, Sparkles } from 'lucide-react';
import { Badge } from '@/shared/components/ui';
import { clueRows, type CluePreviewRow } from './Phase24ClueEntityPreviewData';
import { ClueDetailPanel, ClueInspectorPanel, MobileFlowNote } from './Phase24ClueEntityPreviewSections';

export default function Phase24ClueEntityPreviewPage() {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('diary');
  const [showNewClue, setShowNewClue] = useState(false);
  const [imageName, setImageName] = useState('diary-cover.webp');

  const filteredClues = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return clueRows;
    return clueRows.filter((clue) =>
      `${clue.name} ${clue.tags.join(' ')}`.toLowerCase().includes(normalized),
    );
  }, [query]);
  const selectedClue = clueRows.find((clue) => clue.id === selectedId) ?? clueRows[0];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(245,158,11,0.16),transparent_30%),radial-gradient(circle_at_92%_8%,rgba(34,197,94,0.10),transparent_26%)]" />
      <div className="relative mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <PageHeader />
        <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/65 p-3 shadow-2xl shadow-slate-950/30 sm:p-4">
          <EntityModeBar />
          <div className="grid gap-4 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)] xl:grid-cols-[minmax(20rem,25rem)_minmax(0,1fr)_20rem]">
            <ClueListPanel
              clues={filteredClues}
              selectedId={selectedClue.id}
              query={query}
              showNewClue={showNewClue}
              onQueryChange={setQuery}
              onSelect={setSelectedId}
              onNewClueToggle={() => setShowNewClue((current) => !current)}
            />
            <ClueDetailPanel clue={selectedClue} imageName={imageName} onImageNameChange={setImageName} />
            <ClueInspectorPanel clue={selectedClue} />
          </div>
          <MobileFlowNote />
        </section>
      </div>
    </main>
  );
}

function PageHeader() {
  return (
    <header className="mb-5 overflow-hidden rounded-3xl border border-amber-500/20 bg-slate-900/80 shadow-2xl shadow-slate-950/40">
      <div className="border-b border-slate-800 bg-gradient-to-r from-amber-500/10 via-slate-900 to-emerald-500/10 px-5 py-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant="warning">DEV ONLY</Badge>
          <Badge variant="default">Phase 24 PR-3G</Badge>
          <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">
            모바일 우선 단서 화면
          </span>
        </div>
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-300/80">
          <Sparkles className="h-4 w-4" /> Clue Entity Preview
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
          단서 엔티티 설계 목업
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          단서는 한 곳에서 만들고, 어느 캐릭터·장소·조합에서 쓰이는지 제작자가 바로 확인합니다.
          상세에서는 발견 내용, 공유 방식, 사용 효과, 조합 조건을 한 흐름으로 검수합니다.
        </p>
      </div>
    </header>
  );
}

function EntityModeBar() {
  return (
    <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="편집 대상 선택">
      {[
        { label: '캐릭터', count: '5명', active: false },
        { label: '장소', count: '8곳', active: false },
        { label: '단서', count: '12개', active: true },
      ].map((item) => (
        <button
          key={item.label}
          type="button"
          className={`rounded-2xl border px-4 py-3 text-left transition ${item.active ? 'border-amber-500/40 bg-amber-500/10 text-amber-100 shadow-lg shadow-amber-950/20' : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-700'}`}
        >
          <span className="block text-sm font-semibold">{item.label}</span>
          <span className="mt-1 block text-xs text-slate-500">{item.count}</span>
        </button>
      ))}
    </div>
  );
}

function ClueListPanel({
  clues,
  selectedId,
  query,
  showNewClue,
  onQueryChange,
  onSelect,
  onNewClueToggle,
}: {
  clues: CluePreviewRow[];
  selectedId: string;
  query: string;
  showNewClue: boolean;
  onQueryChange: (value: string) => void;
  onSelect: (id: string) => void;
  onNewClueToggle: () => void;
}) {
  return (
    <aside className="min-w-0 space-y-3 rounded-2xl border border-slate-800 bg-slate-950/80 p-3 lg:sticky lg:top-4 lg:self-start">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/80">단서 목록</p>
          <p className="mt-1 text-xs text-slate-500">사용처/미사용 상태가 자동으로 붙습니다.</p>
        </div>
        <button
          type="button"
          onClick={onNewClueToggle}
          className="rounded-xl bg-amber-500/10 p-2 text-amber-300 hover:bg-amber-500/20"
          aria-label="새 단서 추가"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-500">
        <Search className="h-3.5 w-3.5 shrink-0" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-slate-200 outline-none placeholder:text-slate-600"
          placeholder="단서명 또는 태그 검색"
        />
      </label>
      {showNewClue && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100/80">
          <p className="font-semibold text-amber-100">새 단서 추가 흐름</p>
          <p className="mt-1 leading-5">실제 구현에서는 단서 생성 후 오른쪽 상세가 바로 열립니다.</p>
          <input className="mt-2 w-full rounded-lg border border-amber-500/30 bg-slate-950 px-3 py-2 text-slate-100 outline-none" placeholder="예: 금고 비밀번호" />
        </div>
      )}
      <div className="space-y-2" aria-label="단서 카드 목록">
        {clues.map((clue) => (
          <button
            key={clue.id}
            type="button"
            onClick={() => onSelect(clue.id)}
            className={`w-full rounded-2xl border p-3 text-left transition ${selectedId === clue.id ? 'border-amber-500/40 bg-amber-500/10' : 'border-slate-800 bg-slate-900/55 hover:border-slate-700'}`}
          >
            <span className="flex items-start justify-between gap-2">
              <span className="min-w-0 text-sm font-semibold text-slate-100">{clue.name}</span>
              <UsageBadge clue={clue} />
            </span>
            <span className="mt-2 block truncate text-xs text-slate-500">{clue.usage}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

function UsageBadge({ clue }: { clue: CluePreviewRow }) {
  if (clue.status === 'unused') {
    return <span className="rounded-full bg-rose-500/10 px-2 py-1 text-[11px] text-rose-200">미사용</span>;
  }
  return <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200">{clue.usageCount}곳</span>;
}
