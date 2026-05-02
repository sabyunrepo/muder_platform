import { useMemo, useState, type ReactNode } from 'react';
import { GitBranch, Puzzle, UserRound } from 'lucide-react';
import { Accordion, Badge } from '@/shared/components/ui';
import { CharacterDetailPanel } from '@/features/editor/components/design/CharacterDetailPanel';
import type { Mission } from '@/features/editor/components/design/MissionEditor';
import { StartingClueAssigner } from '@/features/editor/components/design/StartingClueAssigner';
import {
  readCharacterStartingClueMap,
  readCluePlacement,
  writeCharacterStartingClueMap,
  writeCluePlacement,
  writeModuleEnabled,
} from '@/features/editor/utils/configShape';

const characters = [
  { id: 'char-1', name: '홍길동' },
  { id: 'char-2', name: '김철수' },
];

const clues = [
  { id: 'clue-1', name: '피 묻은 칼', location: '서재', round: 1, tag: '물증' },
  { id: 'clue-2', name: '비밀 편지', location: '부엌', round: 1, tag: '문서' },
  { id: 'clue-3', name: '찢어진 초대장', location: '현관', round: 2, tag: '문서' },
  { id: 'clue-4', name: '깨진 시계', location: '거실', round: 2, tag: '물증' },
  { id: 'clue-5', name: '녹음 파일', location: '서재', round: 3, tag: '미디어' },
  { id: 'clue-6', name: '검은 장갑', location: '창고', round: 3, tag: '물증' },
];

const initialConfig = writeCluePlacement(
  writeCharacterStartingClueMap(
    writeModuleEnabled({ modules: ['starting_clue'] }, 'hidden_mission', true),
    { 'char-1': ['clue-1'] },
  ),
  { 'clue-1': 'library', 'clue-2': 'kitchen' },
);

function PreviewCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 shadow-2xl shadow-slate-950/30">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-amber-400/80">
        {title}
      </h2>
      {children}
    </section>
  );
}

function createMissionId(existingIds: Set<string>) {
  let id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `mission-${Date.now()}`;
  let suffix = 1;
  while (existingIds.has(id)) {
    id = `mission-${Date.now()}-${suffix}`;
    suffix += 1;
  }
  return id;
}

export default function Phase24EditorPreviewPage() {
  const [config, setConfig] = useState(initialConfig);
  const [missions, setMissions] = useState<Mission[]>([
    {
      id: 'mission-1',
      type: 'possess',
      description: '비밀 편지를 마지막까지 보유하세요',
      points: 10,
      targetClueId: 'clue-2',
    },
  ]);

  const startingClues = useMemo(() => readCharacterStartingClueMap(config), [config]);
  const cluePlacement = useMemo(() => readCluePlacement(config), [config]);
  const charOneClueIds = startingClues['char-1'] ?? [];

  function updateCharOneClues(next: string[]) {
    setConfig(writeCharacterStartingClueMap(config, { ...startingClues, 'char-1': next }));
  }

  function toggleStartingClue(clueId: string, checked: boolean) {
    const next = checked
      ? Array.from(new Set([...charOneClueIds, clueId]))
      : charOneClueIds.filter((id) => id !== clueId);
    updateCharOneClues(next);
  }

  function addMission() {
    setMissions((prev) => [
      ...prev,
      {
        id: createMissionId(new Set(prev.map((mission) => mission.id))),
        type: 'kill',
        description: '',
        points: 10,
      },
    ]);
  }

  function changeMission(missionId: string, field: keyof Mission, value: string | number) {
    setMissions((prev) =>
      prev.map((mission) =>
        mission.id === missionId ? { ...mission, [field]: value } : mission,
      ),
    );
  }

  function deleteMission(missionId: string) {
    setMissions((prev) => prev.filter((mission) => mission.id !== missionId));
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20 p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="warning">DEV ONLY</Badge>
            <Badge variant="default">Phase 24 PR-2</Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">
            에디터 작업 미리보기 — split 단서 배정 제안
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            좌측에서 전체 단서를 검색·탐색하고, 클릭하면 우측 캐릭터 시작 단서에 추가됩니다.
            오른쪽 JSON은 canonical config shape를 즉시 반영합니다.
          </p>
        </header>

        <PreviewCard title="추천 구조 — split clue assigner">
          <StartingClueAssigner
            characterName={characters[0].name}
            clues={clues}
            selectedIds={charOneClueIds}
            onClueToggle={toggleStartingClue}
          />
        </PreviewCard>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]">
          <PreviewCard title="현재 적용 컴포넌트 비교용">
            <div className="mb-4 flex items-center gap-2 text-sm text-slate-300">
              <UserRound className="h-4 w-4 text-amber-400" />
              기존 checkbox 방식. 단서가 적을 때는 빠르지만, 많아지면 위 split assigner가 유리합니다.
            </div>
            <CharacterDetailPanel
              selectedChar={characters[0]}
              characters={characters}
              clues={clues}
              charClueIds={charOneClueIds}
              charMissions={missions}
              onClueToggle={toggleStartingClue}
              onAddMission={addMission}
              onChangeMission={changeMission}
              onDeleteMission={deleteMission}
            />
          </PreviewCard>

          <div className="space-y-6">
            <PreviewCard title="Accordion 독립 상태">
              <Accordion
                storageKey="phase24-preview:accordion"
                items={[
                  {
                    id: 'base',
                    title: '베이스 섹션',
                    subtitle: 'forceOpen: 항상 펼침',
                    forceOpen: true,
                    children: <p className="text-sm text-slate-400">기본 정보 섹션은 닫히지 않습니다.</p>,
                  },
                  {
                    id: 'module',
                    title: '활성 모듈 섹션',
                    subtitle: 'localStorage로 펼침 상태 저장',
                    defaultOpen: true,
                    children: <p className="text-sm text-slate-400">새로고침해도 접힘 상태가 유지됩니다.</p>,
                  },
                ]}
              />
            </PreviewCard>

            <PreviewCard title="저장될 canonical config">
              <div className="mb-3 flex items-center gap-2 text-xs text-slate-400">
                <Puzzle className="h-3.5 w-3.5 text-amber-400" />
                legacy key 없이 백엔드 PR-1 shape로 저장됩니다.
              </div>
              <pre className="max-h-[26rem] overflow-auto rounded-lg bg-slate-950 p-3 text-[11px] leading-5 text-slate-300">
                {JSON.stringify(config, null, 2)}
              </pre>
            </PreviewCard>

            <PreviewCard title="단서 배치 파생 뷰">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <GitBranch className="h-3.5 w-3.5 text-amber-400" />
                <span>{Object.keys(cluePlacement).length}개 단서가 장소에 연결됨</span>
              </div>
            </PreviewCard>
          </div>
        </div>
      </div>
    </main>
  );
}
