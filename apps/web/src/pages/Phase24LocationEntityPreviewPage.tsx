import { useState } from 'react';
import { ChevronDown, ChevronRight, MapPin, Plus, Search, Sparkles } from 'lucide-react';
import { Badge } from '@/shared/components/ui';
import { locationRows } from './Phase24LocationEntityPreviewData';
import {
  LocationDetailPanel,
  LocationInspectorPanel,
  MobileFlowNote,
} from './Phase24LocationEntityPreviewSections';
export default function Phase24LocationEntityPreviewPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(245,158,11,0.14),transparent_32%),radial-gradient(circle_at_80%_0%,rgba(14,165,233,0.10),transparent_28%)]" />
      <div className="relative mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <PageHeader />
        <LocationEntityWorkspace />
      </div>
    </main>
  );
}
function PageHeader() {
  return (
    <header className="mb-5 overflow-hidden rounded-3xl border border-amber-500/20 bg-slate-900/80 shadow-2xl shadow-slate-950/40">
      <div className="border-b border-slate-800 bg-gradient-to-r from-amber-500/10 via-slate-900 to-sky-500/10 px-5 py-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant="warning">DEV ONLY</Badge>
          <Badge variant="default">Phase 24 PR-3F</Badge>
          <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">
            모바일 우선 장소 entity
          </span>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-300/80">
              <Sparkles className="h-4 w-4" /> Location Entity Preview
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
              장소 엔티티 설계 목업
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              장소를 트리로 찾고, 상세에서 입장 메시지·장소 이미지·접근 제한·장소 단서를 한 흐름으로
              편집하는 화면입니다.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 text-xs leading-5 text-slate-400">
            <p className="font-semibold text-slate-200">변경 반영</p>
            <p className="mt-1">
              부모 장소 입력은 제거했습니다. 위치 관계는 장소 트리와 경로에서만 확인하고, +
              버튼/이미지 업로드/단서 추가 동작을 볼 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
function LocationEntityWorkspace() {
  const [isAddingLocation, setIsAddingLocation] = useState(false);
  const [draftLocationName, setDraftLocationName] = useState('');
  const [mockLocationName, setMockLocationName] = useState<string | null>(null);
  const [locationImageName, setLocationImageName] = useState('study.webp');
  const [locationImagePreview, setLocationImagePreview] = useState<string | null>(null);
  const [selectedClueIds, setSelectedClueIds] = useState(['knife', 'receipt', 'safe-code']);

  function handleCreateDraftLocation() {
    const next = draftLocationName.trim();
    if (!next) return;
    setMockLocationName(next);
    setDraftLocationName('');
    setIsAddingLocation(false);
  }

  function handleClueToggle(clueId: string, checked: boolean) {
    setSelectedClueIds((current) => {
      if (checked && !current.includes(clueId)) return [...current, clueId];
      if (!checked) return current.filter((id) => id !== clueId);
      return current;
    });
  }
  return (
    <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/60 p-3 shadow-2xl shadow-slate-950/30 sm:p-4">
      <EntityModeBar />
      <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)_22rem]">
        <LocationTreePanel
          isAddingLocation={isAddingLocation}
          draftLocationName={draftLocationName}
          mockLocationName={mockLocationName}
          onAddClick={() => setIsAddingLocation((current) => !current)}
          onDraftLocationNameChange={setDraftLocationName}
          onCreateDraftLocation={handleCreateDraftLocation}
        />
        <LocationDetailPanel
          locationImageName={locationImageName}
          locationImagePreview={locationImagePreview}
          selectedClueIds={selectedClueIds}
          onLocationImageChange={(name, preview) => {
            setLocationImageName(name);
            setLocationImagePreview(preview);
          }}
          onClueToggle={handleClueToggle}
        />
        <LocationInspectorPanel selectedClueCount={selectedClueIds.length} />
      </div>
      <MobileFlowNote />
    </section>
  );
}
function EntityModeBar() {
  return (
    <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="entity 타입 선택">
      {[
        { label: '캐릭터', count: '5명', active: false },
        { label: '장소', count: '8곳', active: true },
        { label: '단서', count: '12개', active: false },
      ].map((item) => (
        <button
          key={item.label}
          type="button"
          className={`rounded-2xl border px-4 py-3 text-left transition ${item.active ? 'border-amber-500/40 bg-amber-500/10 text-amber-100 shadow-lg shadow-amber-950/20' : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-700'}`}
        >
          <span className="block text-sm font-semibold">{item.label}</span>
          <span className="mt-1 block text-xs text-slate-500">{item.count} entity</span>
        </button>
      ))}
    </div>
  );
}
function LocationTreePanel({
  isAddingLocation,
  draftLocationName,
  mockLocationName,
  onAddClick,
  onDraftLocationNameChange,
  onCreateDraftLocation,
}: {
  isAddingLocation: boolean;
  draftLocationName: string;
  mockLocationName: string | null;
  onAddClick: () => void;
  onDraftLocationNameChange: (value: string) => void;
  onCreateDraftLocation: () => void;
}) {
  return (
    <aside className="min-w-0 space-y-3 rounded-2xl border border-slate-800 bg-slate-950/80 p-3 lg:sticky lg:top-4 lg:self-start">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/80">
            장소 트리
          </p>
          <p className="mt-1 text-xs text-slate-500">중첩 장소를 접고 펼치며 선택합니다.</p>
        </div>
        <button
          type="button"
          className="rounded-xl bg-amber-500/10 p-2 text-amber-300 hover:bg-amber-500/20"
          aria-label="장소 추가"
          onClick={onAddClick}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-500">
        <Search className="h-3.5 w-3.5 shrink-0" />
        <input
          className="min-w-0 flex-1 bg-transparent text-slate-200 outline-none placeholder:text-slate-600"
          placeholder="장소 검색"
        />
      </label>

      {isAddingLocation && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="text-xs font-semibold text-amber-100">새 장소 추가</p>
          <p className="mt-1 text-[11px] leading-4 text-amber-100/70">
            현재 목업에서는 ‘1층’ 아래에 추가되는 동작만 보여줍니다.
          </p>
          <input
            value={draftLocationName}
            onChange={(event) => onDraftLocationNameChange(event.target.value)}
            placeholder="예: 응접실"
            aria-label="새 장소 이름"
            className="mt-2 w-full rounded-lg border border-amber-500/30 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none placeholder:text-slate-600 focus-visible:ring-2 focus-visible:ring-amber-500/60"
          />
          <button
            type="button"
            onClick={onCreateDraftLocation}
            disabled={!draftLocationName.trim()}
            className="mt-2 w-full rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            목업에 추가되는 동작 보기
          </button>
        </div>
      )}

      <div className="space-y-1" aria-label="장소 목록">
        {locationRows.map((row) => (
          <button
            key={row.id}
            type="button"
            className={`flex w-full min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${row.status === 'selected' ? 'border-amber-500/40 bg-amber-500/10 text-amber-100' : 'border-transparent bg-slate-900/50 text-slate-300 hover:border-slate-700'}`}
            style={{ paddingLeft: `${12 + row.depth * 18}px` }}
          >
            {row.depth < 2 ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-600" />
            )}
            <MapPin className="h-3.5 w-3.5 shrink-0 text-amber-400/80" />
            <span className="min-w-0 flex-1 truncate">{row.name}</span>
            <span className="rounded-full bg-slate-950 px-2 py-0.5 text-[11px] text-slate-500">
              {row.count}
            </span>
          </button>
        ))}
        {mockLocationName && (
          <button
            type="button"
            className="flex w-full min-w-0 items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 pl-[48px] text-left text-sm text-emerald-100"
          >
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
            <span className="min-w-0 flex-1 truncate">{mockLocationName}</span>
            <span className="rounded-full bg-slate-950 px-2 py-0.5 text-[11px] text-emerald-300">
              new
            </span>
          </button>
        )}
      </div>
    </aside>
  );
}
