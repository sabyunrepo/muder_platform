import { useRef, type ChangeEvent, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  EyeOff,
  Image,
  KeyRound,
  Layers3,
  Link2,
  LockKeyhole,
  ShieldCheck,
  TreePine,
} from 'lucide-react';
import { StartingClueAssigner } from '@/features/editor/components/design/StartingClueAssigner';
import { allLocationClues, restrictedCharacters } from './Phase24LocationEntityPreviewData';

const auditItems = [
  { icon: CheckCircle2, text: '부모 장소가 자기 자신을 가리키지 않음', tone: 'ok' },
  { icon: AlertTriangle, text: '2층 하위 장소 1개가 아직 단서 없음', tone: 'warn' },
  { icon: ShieldCheck, text: '접근 제한 캐릭터 2명 설정됨', tone: 'ok' },
];

export function LocationDetailPanel({
  locationImageName,
  locationImagePreview,
  selectedClueIds,
  onLocationImageChange,
  onClueToggle,
}: {
  locationImageName: string;
  locationImagePreview: string | null;
  selectedClueIds: string[];
  onLocationImageChange: (name: string, preview: string | null) => void;
  onClueToggle: (clueId: string, checked: boolean) => void;
}) {
  return (
    <section className="min-w-0 space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] p-4 sm:p-5">
        <div className="space-y-3 sm:flex sm:items-start sm:justify-between sm:gap-4 sm:space-y-0">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-300/80">
              Selected location
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-50">서재</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              별장 / 1층 / 서재 — 플레이어가 조사와 단서 발견을 수행하는 핵심 공간
            </p>
          </div>
          <span className="inline-flex rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">
            ID · loc-study
          </span>
        </div>
      </div>

      <BaseLocationForm
        locationImageName={locationImageName}
        locationImagePreview={locationImagePreview}
        onLocationImageChange={onLocationImageChange}
      />
      <AccessPolicyCard />
      <LocationClueCard selectedClueIds={selectedClueIds} onClueToggle={onClueToggle} />
    </section>
  );
}
function BaseLocationForm({
  locationImageName,
  locationImagePreview,
  onLocationImageChange,
}: {
  locationImageName: string;
  locationImagePreview: string | null;
  onLocationImageChange: (name: string, preview: string | null) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleImageFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    onLocationImageChange(file.name, URL.createObjectURL(file));
    event.target.value = '';
  }
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
      <SectionTitle
        icon={Building2}
        title="장소 기본 정보"
        description="이름, 입장 메시지, 장소 이미지를 편집합니다. 부모 관계는 좌측 장소 트리에서만 관리합니다."
      />
      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem]">
        <label className="space-y-1 text-xs text-slate-400">
          <span>장소 이름</span>
          <input
            value="서재"
            readOnly
            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
          <p className="text-xs text-slate-500">트리 경로</p>
          <p className="mt-1 truncate text-sm text-slate-200">별장 / 1층 / 서재</p>
        </div>
      </div>
      <label className="mt-3 block space-y-1 text-xs text-slate-400">
        <span>입장 메시지 Markdown</span>
        <textarea
          readOnly
          value="문을 열자 낡은 책 냄새가 밀려옵니다. 책상 위에는 아직 식지 않은 홍차가 놓여 있습니다."
          className="min-h-28 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm leading-6 text-slate-200"
        />
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="group relative flex min-h-36 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-700 bg-slate-900 text-slate-600 hover:border-amber-500/50 hover:text-amber-200"
          aria-label="장소 이미지 업로드"
        >
          {locationImagePreview ? (
            <img
              src={locationImagePreview}
              alt="업로드한 장소 이미지 미리보기"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex flex-col items-center gap-2 text-xs">
              <Image className="h-8 w-8" />
              장소 이미지 업로드
            </span>
          )}
          <span className="absolute inset-x-2 bottom-2 rounded-lg bg-slate-950/80 px-2 py-1 text-center text-[11px] text-slate-300 opacity-0 transition group-hover:opacity-100">
            클릭해서 변경
          </span>
        </button>
        <div className="space-y-2 text-xs text-slate-400">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={handleImageFile}
            aria-label="장소 이미지 파일 선택"
          />
          <p className="font-semibold text-slate-200">장소 이미지</p>
          <p className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100">
            {locationImageName}
          </p>
          <p className="leading-5 text-slate-500">
            실제 구현에서는 장소 이미지도 기존 이미지 업로드 API 흐름으로 저장합니다. 여기서는 선택
            즉시 미리보기만 보여줍니다.
          </p>
        </div>
      </div>
    </div>
  );
}
function AccessPolicyCard() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
      <SectionTitle
        icon={LockKeyhole}
        title="접근 제한"
        description="특정 캐릭터만 이 장소에 들어오지 못하게 막습니다."
      />
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {restrictedCharacters.map((character) => (
          <label
            key={character.name}
            className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-sm"
          >
            <span className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={character.checked}
                readOnly
                className="mt-1 accent-amber-500"
              />
              <span className="min-w-0">
                <span className="block truncate font-semibold text-slate-200">
                  {character.name}
                </span>
                <span className="block text-xs text-slate-500">{character.role}</span>
              </span>
            </span>
          </label>
        ))}
      </div>
      <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100">
        저장 shape 후보: 기존 restricted_characters CSV와 호환하되, UI에서는 체크박스로 보여줍니다.
      </p>
    </div>
  );
}
function LocationClueCard({
  selectedClueIds,
  onClueToggle,
}: {
  selectedClueIds: string[];
  onClueToggle: (clueId: string, checked: boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
      <SectionTitle
        icon={KeyRound}
        title="장소 단서 추가"
        description="캐릭터 시작 단서와 같은 좌측 전체 목록 + 우측 선택 목록 패턴으로 연결합니다."
      />
      <div className="mt-4">
        <StartingClueAssigner
          characterName="서재"
          selectedTitle="이 장소의 단서"
          clues={allLocationClues}
          selectedIds={selectedClueIds}
          onClueToggle={onClueToggle}
        />
      </div>
    </div>
  );
}
export function LocationInspectorPanel({ selectedClueCount }: { selectedClueCount: number }) {
  return (
    <aside className="min-w-0 space-y-3 lg:sticky lg:top-4 lg:self-start">
      <InspectorCard icon={TreePine} title="트리 미리보기">
        <div className="space-y-1 text-xs text-slate-400">
          <p>별장</p>
          <p className="pl-4">└ 1층</p>
          <p className="pl-8 text-amber-200">└ 서재</p>
          <p className="pl-8">└ 부엌</p>
        </div>
      </InspectorCard>
      <InspectorCard icon={Link2} title="Backlink / 사용처">
        <div className="space-y-2 text-xs">
          <BacklinkRow label="캐릭터 접근 제한" value="김철수 · 이영희" />
          <BacklinkRow label="단서 연결" value={`${selectedClueCount}개`} />
          <BacklinkRow label="진행 조건" value="round_clue 후보" />
        </div>
      </InspectorCard>
      <InspectorCard icon={EyeOff} title="검수 상태">
        <div className="space-y-2">
          {auditItems.map(({ icon: Icon, text, tone }) => (
            <div
              key={text}
              className="flex gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs leading-5 text-slate-400"
            >
              <Icon
                className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${tone === 'ok' ? 'text-emerald-300' : 'text-amber-300'}`}
              />
              <span>{text}</span>
            </div>
          ))}
        </div>
      </InspectorCard>
    </aside>
  );
}
export function MobileFlowNote() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-xs leading-6 text-slate-400">
      <p className="flex items-center gap-2 font-semibold text-slate-200">
        <Layers3 className="h-4 w-4 text-amber-400" /> 모바일 흐름
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-2">
        장소 검색 <ArrowRight className="h-3.5 w-3.5" /> 상세 편집{' '}
        <ArrowRight className="h-3.5 w-3.5" /> 접근 제한 <ArrowRight className="h-3.5 w-3.5" /> 연결
        단서 <ArrowRight className="h-3.5 w-3.5" /> 검수
      </p>
    </div>
  );
}
function SectionTitle({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
      <div>
        <p className="text-sm font-semibold text-slate-100">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>
    </div>
  );
}
function InspectorCard({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
        <Icon className="h-4 w-4 text-amber-400" />
        {title}
      </div>
      {children}
    </section>
  );
}
function BacklinkRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
      <p className="text-slate-500">{label}</p>
      <p className="mt-1 text-slate-200">{value}</p>
    </div>
  );
}
