import { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Boxes,
  FileText,
  KeyRound,
  Link2,
  Trash2,
  Upload,
} from 'lucide-react';
import { backlinkRows, clueSelectOptions, type CluePreviewRow } from './Phase24ClueEntityPreviewData';
import { LabeledInput, LabeledSelect, SearchableCluePicker, SectionTitle, SegmentedChoice, ToggleCard } from './Phase24ClueEntityPreviewControls';

type UseMode = 'instant' | 'password';
type EffectType = 'grant_clue' | 'unlock_clue' | 'view_player_clue' | 'steal_clue' | 'unlock_condition';
type AfterUse = 'keep' | 'consume_after_effect';
type CombinationOperator = 'AND' | 'OR';
type PlayerTargetMode = 'runtime_select' | 'creator_fixed';
type TargetClueScope = 'random_one' | 'creator_pick';

const EFFECT_OPTIONS: { value: EffectType; label: string; desc: string }[] = [
  { value: 'grant_clue', label: '새 단서 지급', desc: '성공하면 새 물품/정보 단서를 줍니다.' },
  { value: 'unlock_clue', label: '잠긴 단서 공개', desc: '숨겨진 단서를 읽을 수 있게 엽니다.' },
  { value: 'view_player_clue', label: '다른 플레이어 단서 보기', desc: '대상의 단서를 열람합니다.' },
  { value: 'steal_clue', label: '다른 플레이어 단서 가져오기', desc: '대상 단서가 내 단서함으로 이동합니다.' },
  { value: 'unlock_condition', label: '조건 해제', desc: '장소, 페이즈, 결말 분기 조건을 풉니다.' },
];


export function ClueDetailPanel({
  clue,
  imageName,
  onImageNameChange,
}: {
  clue: CluePreviewRow;
  imageName: string;
  onImageNameChange: (value: string) => void;
}) {
  return (
    <article className="min-w-0 space-y-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-3 sm:p-4">
      <div className="flex flex-col gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">선택 단서</p>
          <h2 className="mt-1 text-xl font-bold text-slate-50">{clue.name}</h2>
          <p className="mt-1 text-sm text-slate-400">기본 정보, 발견 컨텐츠, 공유 정책, 사용 효과, 조합 조건을 실제 폼처럼 설정합니다.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950">저장</button>
          <button type="button" aria-label="단서 삭제" className="rounded-xl border border-rose-500/30 px-3 py-2 text-sm text-rose-200"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>

      <BaseInfoSection clue={clue} imageName={imageName} onImageNameChange={onImageNameChange} />
      <DiscoveryContentSection />
      <SharePolicySettings />
      <ClueActionSettings />
      <CombinationSettings />
      <BacklinkSection />
      <DeleteWarning usageCount={clue.usageCount} />
    </article>
  );
}

function BaseInfoSection({ clue, imageName, onImageNameChange }: { clue: CluePreviewRow; imageName: string; onImageNameChange: (value: string) => void }) {
  return (
    <section className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem]">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <SectionTitle icon={<BookOpen className="h-4 w-4" />} title="베이스" desc="제작자가 이해할 수 있는 이름과 설명만 기본 화면에 둡니다." />
        <div className="mt-4 grid gap-3">
          <LabeledInput label="단서 이름" defaultValue={clue.name} />
          <LabeledInput label="짧은 설명" defaultValue="검은 잉크가 묻은 오래된 일기장" />
        </div>
      </div>
      <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/70 p-4 text-center hover:border-amber-500/50">
        <Upload className="h-7 w-7 text-amber-300" />
        <span className="mt-2 text-sm font-semibold text-slate-100">단서 이미지</span>
        <span className="mt-1 break-all text-xs text-slate-500">{imageName}</span>
        <input type="file" accept="image/*" className="sr-only" onChange={(event) => onImageNameChange(event.target.files?.[0]?.name ?? imageName)} />
      </label>
    </section>
  );
}

function DiscoveryContentSection() {
  return (
    <section className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
      <SectionTitle icon={<FileText className="h-4 w-4" />} title="발견 시 표시 내용" desc="플레이어가 이 단서를 발견했을 때 읽는 본문입니다." />
      <textarea
        defaultValue={'## 검은 잉크 일기장\n\n표지 안쪽에 검은 잉크가 번져 있다. 마지막 페이지에는 *그를 죽일 수밖에 없었다* 라는 문장이 남아 있다.'}
        className="mt-4 min-h-36 w-full rounded-2xl border border-amber-500/20 bg-slate-950/80 px-4 py-3 text-sm leading-6 text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
      />
    </section>
  );
}

function SharePolicySettings() {
  const [canShow, setCanShow] = useState(true);
  const [canTransfer, setCanTransfer] = useState(true);
  return (
    <section className="rounded-2xl border border-sky-500/25 bg-sky-500/10 p-4">
      <SectionTitle icon={<Link2 className="h-4 w-4" />} title="단서 공유 정책 설정" desc="플레이어가 이 단서를 다른 사람과 어떻게 공유할 수 있는지 정합니다." />
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <ToggleCard checked={canShow} onChange={setCanShow} title="다른 플레이어에게 보여줄 수 있음" desc="상대가 내용을 볼 수 있지만, 단서는 내 단서함에 그대로 남습니다." />
        <ToggleCard checked={canTransfer} onChange={setCanTransfer} title="다른 플레이어에게 넘길 수 있음" desc="단서가 상대에게 이동하고, 내 단서함에서는 사라집니다." />
      </div>
      <p className="mt-3 rounded-xl bg-slate-950/70 px-3 py-2 text-xs text-slate-400">현재 미리보기: {canShow ? '보여주기 허용' : '보여주기 금지'} · {canTransfer ? '넘기기 허용' : '넘기기 금지'}</p>
    </section>
  );
}

function ClueActionSettings() {
  const [useMode, setUseMode] = useState<UseMode>('password');
  const [effectType, setEffectType] = useState<EffectType>('grant_clue');
  const [afterUse, setAfterUse] = useState<AfterUse>('keep');
  const effectLabel = EFFECT_OPTIONS.find((option) => option.value === effectType)?.label ?? '새 단서 지급';

  return (
    <section className="rounded-2xl border border-fuchsia-500/25 bg-fuchsia-500/10 p-4">
      <SectionTitle icon={<KeyRound className="h-4 w-4" />} title="단서 사용 효과 설정" desc="플레이어가 이 단서를 사용했을 때 어떤 일이 생기는지 정합니다." />
      <div className="mt-4 grid gap-4">
        <SegmentedChoice<UseMode>
          label="사용 방식"
          value={useMode}
          onChange={setUseMode}
          options={[
            { value: 'instant', label: '바로 사용' },
            { value: 'password', label: '비밀번호/정답 입력' },
          ]}
        />

        {useMode === 'password' && (
          <div className="grid gap-3 sm:grid-cols-3">
            <LabeledInput label="정답" defaultValue="0427" helper="실제 구현에서는 백엔드에서만 검증" />
            <LabeledInput label="실패 메시지" defaultValue="번호가 맞지 않는다." />
            <LabeledInput label="시도 제한" defaultValue="3" />
          </div>
        )}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-200/80">효과 선택</p>
          <div className="grid gap-2 md:grid-cols-2">
            {EFFECT_OPTIONS.map((option) => (
              <button key={option.value} type="button" onClick={() => setEffectType(option.value)} className={`rounded-2xl border p-3 text-left transition ${effectType === option.value ? 'border-fuchsia-400/60 bg-fuchsia-500/20' : 'border-fuchsia-500/15 bg-slate-950/70 hover:border-fuchsia-400/40'}`}>
                <span className="block text-sm font-semibold text-slate-100">{option.label}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{option.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <ActionEffectFields effectType={effectType} />

        <SegmentedChoice<AfterUse>
          label="사용 후 처리"
          value={afterUse}
          onChange={setAfterUse}
          options={[
            { value: 'keep', label: '사용 후에도 유지' },
            { value: 'consume_after_effect', label: '효과 발동 후 소모' },
          ]}
        />
        <p className="rounded-xl bg-slate-950/70 px-3 py-2 text-xs leading-5 text-slate-400">플레이어 미리보기: {effectLabel} 효과가 성공하면 {afterUse === 'consume_after_effect' ? '이 단서는 단서함에서 사라집니다.' : '이 단서는 단서함에 남습니다.'}</p>
      </div>
    </section>
  );
}


function ActionEffectFields({ effectType }: { effectType: EffectType }) {
  const [selectedClueId, setSelectedClueId] = useState(effectType === 'unlock_clue' ? 'basement-photo' : 'box-letter');
  const [playerTargetMode, setPlayerTargetMode] = useState<PlayerTargetMode>('runtime_select');
  const [targetClueScope, setTargetClueScope] = useState<TargetClueScope>('random_one');
  const [targetClueId, setTargetClueId] = useState('safe-code');
  const selectedClue = clueSelectOptions.find((item) => item.id === selectedClueId);

  if (effectType === 'view_player_clue' || effectType === 'steal_clue') {
    return (
      <div className="space-y-3 rounded-2xl border border-fuchsia-500/20 bg-slate-950/70 p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <SegmentedChoice<PlayerTargetMode>
            label="대상 플레이어"
            value={playerTargetMode}
            onChange={setPlayerTargetMode}
            options={[
              { value: 'runtime_select', label: '플레이어가 사용 시 선택' },
              { value: 'creator_fixed', label: '제작자가 대상 캐릭터 지정' },
            ]}
          />
          {playerTargetMode === 'creator_fixed' ? (
            <LabeledSelect label="대상 캐릭터" defaultValue="김철수" options={['김철수', '박영희', '오민수', '한지아']} />
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3 text-xs leading-5 text-slate-400">플레이어가 단서를 사용할 때 대상 플레이어를 직접 고릅니다.</div>
          )}
        </div>
        <SegmentedChoice<TargetClueScope>
          label={effectType === 'steal_clue' ? '가져올 단서 범위' : '볼 단서 범위'}
          value={targetClueScope}
          onChange={setTargetClueScope}
          options={[
            { value: 'random_one', label: '대상 보유 단서 중 무작위 1개' },
            { value: 'creator_pick', label: '제작자가 지정한 단서' },
          ]}
        />
        {targetClueScope === 'creator_pick' && (
          <SearchableCluePicker
            label={effectType === 'steal_clue' ? '가져올 단서 지정' : '볼 단서 지정'}
            placeholder="대상 단서 검색"
            selectedId={targetClueId}
            onSelect={(option) => setTargetClueId(option.id)}
          />
        )}
      </div>
    );
  }

  if (effectType === 'unlock_condition') {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <LabeledSelect label="해제할 조건 타입" defaultValue="장소 입장 조건" options={['장소 입장 조건', '페이즈 진행 조건', '결말 분기 조건']} />
        <LabeledSelect label="해제할 대상" defaultValue="지하실 문" options={['지하실 문', '3라운드 진입', '진범 엔딩 분기']} />
      </div>
    );
  }

  return (
    <SearchableCluePicker
      label={effectType === 'grant_clue' ? '지급할 단서' : '공개할 잠긴 단서'}
      placeholder="단서명/태그 검색"
      selectedId={selectedClue?.id ?? selectedClueId}
      onSelect={(option) => setSelectedClueId(option.id)}
      lockedOnly={effectType === 'unlock_clue'}
    />
  );
}

function CombinationSettings() {
  const [operator, setOperator] = useState<CombinationOperator>('AND');
  const [selectedIds, setSelectedIds] = useState(['diary', 'knife', 'letter']);
  const [rewardId, setRewardId] = useState('truth');
  const [consumeInputs, setConsumeInputs] = useState(false);
  const selectedClues = clueSelectOptions.filter((item) => selectedIds.includes(item.id));
  const rewardClue = clueSelectOptions.find((item) => item.id === rewardId);
  const canRemove = selectedIds.length > 2;

  return (
    <section className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
      <SectionTitle icon={<Boxes className="h-4 w-4" />} title="조합 조건 설정" desc="필요 단서 → 조건 방식 → 성공 보상 순서로 읽히도록 나눴습니다." />
      <div className="mt-4 grid gap-3">
        <div className="rounded-2xl border border-emerald-500/20 bg-slate-950/70 p-4">
          <StepTitle index="1" title="조합에 필요한 단서" desc="최소 2개 이상 선택합니다. 많아지면 검색으로 추가합니다." />
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedClues.map((item) => (
              <button key={item.id} type="button" disabled={!canRemove} onClick={() => setSelectedIds((current) => current.filter((value) => value !== item.id))} className="rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-100 disabled:cursor-not-allowed disabled:opacity-70">
                {item.name}{canRemove ? ' ×' : ''}
              </button>
            ))}
          </div>
          <div className="mt-3">
            <SearchableCluePicker label="필요 단서 추가" placeholder="단서명/태그 검색 후 추가" selectedId={null} excludeIds={selectedIds} onSelect={(option) => setSelectedIds((current) => [...current, option.id])} />
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-slate-950/70 p-4">
          <StepTitle index="2" title="조합 성공 조건" desc="모두 모아야 하는지, 하나만 있어도 되는지 정합니다." />
          <div className="mt-3 grid gap-3">
            <SegmentedChoice<CombinationOperator> label="조건 방식" value={operator} onChange={setOperator} options={[{ value: 'AND', label: '선택한 단서 모두 필요' }, { value: 'OR', label: '선택한 단서 중 하나 이상' }]} />
            <ToggleCard checked={consumeInputs} onChange={setConsumeInputs} title="재료 단서 소모" desc="조합 성공 후 필요한 단서를 단서함에서 제거합니다." compact />
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-slate-950/70 p-4">
          <StepTitle index="3" title="성공 시 지급 단서" desc="조합에 성공했을 때 새로 얻는 단서를 검색해 선택합니다." />
          <div className="mt-3">
            <SearchableCluePicker label="성공 시 지급" placeholder="지급할 단서 검색" selectedId={rewardId} onSelect={(option) => setRewardId(option.id)} />
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-950/40 p-4 text-xs leading-5 text-emerald-50/80">
          <p className="font-semibold text-emerald-100">플레이어 흐름 미리보기</p>
          <p className="mt-1">
            {selectedIds.length}개 단서 {operator === 'AND' ? '모두를' : '중 하나 이상을'} 가진 플레이어가 조합하면
            <strong> {rewardClue?.name ?? '선택한 단서'} </strong>를 얻습니다. 재료 단서는 {consumeInputs ? '성공 후 사라집니다.' : '그대로 유지됩니다.'}
          </p>
        </div>
      </div>
    </section>
  );
}

function StepTitle({ index, title, desc }: { index: string; title: string; desc: string }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-200">{index}</span>
      <span>
        <span className="block text-sm font-semibold text-slate-100">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">{desc}</span>
      </span>
    </div>
  );
}

function BacklinkSection() {
  return (
    <section className="rounded-2xl border border-violet-500/25 bg-violet-500/10 p-4">
      <SectionTitle icon={<Link2 className="h-4 w-4" />} title="이 단서가 쓰이는 곳" desc="장소, 캐릭터, 조합에서 이 단서를 쓰면 자동으로 모아 보여줍니다." />
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {backlinkRows.map((row) => (
          <button key={`${row.type}-${row.label}`} type="button" className="rounded-2xl border border-violet-500/20 bg-slate-950/70 p-3 text-left hover:border-violet-400/50">
            <span className="text-[11px] font-semibold text-violet-200">{row.type}</span>
            <span className="mt-1 block text-sm font-semibold text-slate-100">{row.label}</span>
            <span className="mt-1 block text-xs text-slate-500">{row.relation}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function DeleteWarning({ usageCount }: { usageCount: number }) {
  return (
    <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-100/85">
      <p className="flex items-center gap-2 font-semibold text-rose-100"><AlertTriangle className="h-4 w-4" /> 삭제 전 경고</p>
      <p className="mt-1 leading-6">이 단서는 현재 {usageCount}곳에서 사용 중입니다. 실제 구현에서는 삭제 시 참조 제거 범위를 확인 다이얼로그로 보여줍니다.</p>
    </div>
  );
}

export function ClueInspectorPanel({ clue }: { clue: CluePreviewRow }) {
  const isUnused = clue.usageCount === 0;
  return (
    <aside className="min-w-0 space-y-3 rounded-2xl border border-slate-800 bg-slate-950/80 p-3 xl:sticky xl:top-4 xl:self-start">
      <SectionTitle icon={<Boxes className="h-4 w-4" />} title="제작 검수" desc="지금 판단에 필요한 요약만 보여줍니다." />

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs leading-5 text-slate-400">
        <p className="font-semibold text-slate-100">사용 상태</p>
        <p className="mt-1">{isUnused ? '아직 어디에도 연결되지 않은 단서입니다.' : `현재 ${clue.usageCount}곳에서 사용 중입니다.`}</p>
        <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] ${isUnused ? 'bg-rose-500/10 text-rose-200' : 'bg-emerald-500/10 text-emerald-200'}`}>
          {isUnused ? '미사용 단서' : '사용 중'}
        </span>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
        <p className="text-xs font-semibold text-slate-100">연결된 곳</p>
        <div className="mt-2 space-y-2">
          {backlinkRows.map((row) => (
            <div key={`${row.type}-${row.label}`} className="rounded-lg bg-slate-950/70 px-3 py-2 text-xs leading-5">
              <p className="font-semibold text-slate-200">{row.label}</p>
              <p className="text-slate-500">{row.relation}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
        <p className="text-xs font-semibold text-slate-100">이 단서에 켜진 기능</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {['공유/넘기기', '사용 효과', '조합 조건', '선행 조건'].map((label) => (
            <span key={label} className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-100">{label}</span>
          ))}
        </div>
      </div>

      {!isUnused && (
        <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-xs leading-5 text-rose-100/85">
          <p className="font-semibold text-rose-100">삭제 주의</p>
          <p className="mt-1">이 단서를 삭제하면 연결된 장소, 캐릭터, 조합 조건에 영향이 있습니다.</p>
        </div>
      )}
    </aside>
  );
}

export function MobileFlowNote() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 text-xs leading-5 text-slate-400 lg:hidden">
      모바일에서는 목록 → 상세 → 검수 패널 순서로 세로 배치됩니다. 가로 스크롤 없이 핵심 편집을 끝낼 수 있게 유지합니다.
    </div>
  );
}
