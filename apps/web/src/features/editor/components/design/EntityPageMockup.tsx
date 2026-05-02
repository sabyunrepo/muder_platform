import {
  BookOpen,
  Boxes,
  ChevronRight,
  FileText,
  Fingerprint,
  GitBranch,
  KeyRound,
  Link2,
  MapPin,
  Package,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  UserRound,
} from 'lucide-react';

const entityTabs = [
  { icon: UserRound, label: '캐릭터', count: 5, active: true },
  { icon: MapPin, label: '장소', count: 8 },
  { icon: Package, label: '단서', count: 12 },
];

const characterRows = [
  { id: 'char-1', name: '김철수', role: '상속자', active: true, status: '범인 후보' },
  { id: 'char-2', name: '홍길동', role: '탐정', status: '시작 단서 1' },
  { id: 'char-3', name: '이영희', role: '비서', status: '접근 제한 1' },
];

const clueRows = [
  { code: 'c1', name: '피 묻은 칼', refs: ['김철수 시작 단서', '서재 장소 단서'], tone: 'active' },
  { code: 'c2', name: '비밀 편지', refs: ['홍길동 시작 단서'], tone: 'active' },
  { code: 'c3', name: '담배꽁초', refs: [], tone: 'unused' },
];

function EntityTypeTabs() {
  return (
    <nav aria-label="Entity type" className="grid gap-2 sm:grid-cols-3">
      {entityTabs.map(({ icon: Icon, label, count, active }) => (
        <button
          key={label}
          type="button"
          className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
            active
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
              : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-700 hover:text-slate-200'
          }`}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{label}</span>
            <span className="block text-xs text-slate-500">{count}개 entity</span>
          </span>
          {active && <ChevronRight className="hidden h-4 w-4 sm:block" />}
        </button>
      ))}
    </nav>
  );
}

function CharacterPicker() {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-500">
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">캐릭터 검색 또는 필터</span>
        </div>
        <button className="rounded-xl bg-amber-500/10 p-2 text-amber-300" type="button" aria-label="캐릭터 추가">
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        {characterRows.map((row) => (
          <button
            key={row.id}
            type="button"
            className={`rounded-xl border px-3 py-3 text-left transition ${
              row.active
                ? 'border-amber-500/30 bg-amber-500/10'
                : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <UserRound className={row.active ? 'h-4 w-4 text-amber-300' : 'h-4 w-4 text-slate-500'} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-100">{row.name}</p>
                <p className="text-xs text-slate-500">{row.role}</p>
              </div>
            </div>
            <p className="mt-2 rounded-full bg-slate-950 px-2 py-1 text-[11px] text-slate-500">{row.status}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

function ModuleToggleStrip() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-300">
        <Boxes className="h-4 w-4 text-amber-400" />
        캐릭터 적용 모듈
      </div>
      <div className="flex flex-wrap gap-2">
        {['starting_clue', 'hidden_mission'].map((id) => (
          <button
            key={id}
            type="button"
            className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200"
          >
            켜짐 · {id}
          </button>
        ))}
      </div>
    </div>
  );
}

function CharacterDetail() {
  return (
    <section className="rounded-2xl border border-slate-800 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.12),transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96))] p-4 sm:p-5">
      <div className="mb-4 space-y-3 sm:flex sm:items-start sm:justify-between sm:gap-3 sm:space-y-0">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-400/80">Character entity</p>
          <h2 className="mt-1 text-xl font-bold text-slate-100">김철수</h2>
          <p className="mt-1 text-sm text-slate-500">모바일에서는 위에서 아래로: 선택 → 베이스 → 모듈 → 참조 순서로 읽습니다.</p>
        </div>
        <div className="inline-flex rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">시스템 ID · char-1</div>
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Fingerprint className="h-4 w-4 text-amber-400" />
            베이스
          </div>
          <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
            <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950 text-xs text-slate-600">사진</div>
            <div className="space-y-2 text-sm">
              <p className="text-slate-200">김철수 <span className="ml-2 rounded bg-red-500/10 px-2 py-0.5 text-xs text-red-300">범인 후보</span></p>
              <p className="rounded-xl bg-slate-950 p-3 text-xs leading-5 text-slate-400">
                오래된 저택의 상속자. 모두에게 친절하지만 사건 당일 행적이 불분명하다.
              </p>
            </div>
          </div>
        </div>

        <ModuleToggleStrip />

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
              <BookOpen className="h-4 w-4 text-amber-400" />
              역할지 Markdown
            </div>
            <pre className="min-h-36 whitespace-pre-wrap rounded-xl bg-slate-950 p-3 text-xs leading-5 text-slate-400">## 당신의 비밀{`\n`}사건 전날, 당신은 서재에서 피해자와 다퉜다.</pre>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
              <KeyRound className="h-4 w-4 text-amber-400" />
              starting_clue
            </div>
            <div className="space-y-2 text-xs text-slate-400">
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-amber-200">피 묻은 칼</div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">+ 단서 entity 목록에서 클릭 추가</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ReferencePanels() {
  return (
    <section className="grid gap-3 lg:grid-cols-3">
      <InfoCard icon={GitBranch} title="참조 상태">
        <p>시작 단서: 피 묻은 칼</p>
        <p>장소 접근 제한: 서재 차단</p>
        <p>미션: 비밀 편지를 보유하세요</p>
      </InfoCard>
      <InfoCard icon={MapPin} title="장소 tree-ready">
        <p>별장</p>
        <p className="pl-3">└ 1층</p>
        <p className="pl-6 text-amber-200">└ 서재</p>
        <p className="pl-6">└ 부엌</p>
      </InfoCard>
      <InfoCard icon={Package} title="단서 backlink">
        {clueRows.map((row) => (
          <div key={row.code} className="border-b border-slate-800 py-2 last:border-b-0 first:pt-0 last:pb-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-slate-600">{row.code}</span>
              <span className="flex-1 text-slate-200">{row.name}</span>
              <span className={row.tone === 'unused' ? 'text-slate-600' : 'text-amber-300'}>
                {row.refs.length || '미사용'}
              </span>
            </div>
            {row.refs.length > 0 && <p className="mt-1 text-slate-500">{row.refs.join(' · ')}</p>}
          </div>
        ))}
      </InfoCard>
    </section>
  );
}

function InfoCard({ icon: Icon, title, children }: { icon: typeof GitBranch; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-xs leading-6 text-slate-400">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
        <Icon className="h-4 w-4 text-amber-400" />
        {title}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function StatusBar() {
  return (
    <div className="grid gap-3 text-xs text-slate-400 md:grid-cols-3">
      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
        <ShieldAlert className="mr-1 inline h-3.5 w-3.5 text-red-300" />
        장소 접근 제한은 기존 CSV API와 호환
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
        <FileText className="mr-1 inline h-3.5 w-3.5 text-amber-300" />
        역할지/발견 컨텐츠는 content key로 저장
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
        <Link2 className="mr-1 inline h-3.5 w-3.5 text-amber-300" />
        단서 사용처는 config에서 자동 계산
      </div>
    </div>
  );
}

export function EntityPageMockup() {
  return (
    <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/50 p-4 shadow-2xl shadow-slate-950/40 sm:p-5">
      <div className="space-y-3 border-b border-slate-800 pb-4 sm:flex sm:items-center sm:justify-between sm:gap-3 sm:space-y-0">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-amber-400/80">
          <Sparkles className="h-4 w-4" />
          Phase 24 PR-3 entity workspace
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          <span className="rounded-full border border-slate-800 px-3 py-1">모바일 우선 세로 흐름</span>
          <span className="rounded-full border border-slate-800 px-3 py-1">저장 shape: canonical config</span>
        </div>
      </div>

      <EntityTypeTabs />
      <CharacterPicker />
      <CharacterDetail />
      <ReferencePanels />
      <StatusBar />
    </section>
  );
}
